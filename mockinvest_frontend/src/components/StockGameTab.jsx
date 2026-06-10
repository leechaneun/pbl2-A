import { useEffect, useMemo, useRef, useState } from 'react';
import RealtimePriceChart from './RealtimePriceChart';

function buildRealtimeSocketUrls() {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();

  if (!baseUrl) {
    return [];
  }

  try {
    const url = new URL(baseUrl);
    const socketProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const socketOrigin = `${socketProtocol}//${url.host}`;
    return [
      `${socketOrigin}/ws/matchmaking`,
      `${socketOrigin}/ws/match`,
      `${socketOrigin}/matchmaking/ws`,
    ];
  } catch (_error) {
    return [];
  }
}

function getMatchedPayload(eventData) {
  const status = String(eventData?.status ?? eventData?.type ?? '').toUpperCase();
  if (
    status.includes('MATCHED') ||
    status.includes('FOUND') ||
    status.includes('COMPLETE') ||
    status.includes('READY') ||
    status === 'START'
  ) {
    return eventData;
  }
  return null;
}

const STARTING_CASH = 5000000;
const MATCH_SECONDS = 15 * 60;
const TOTAL_DAYS = 65;
const BASE_FEE_RATE = 0.005;
const DISCOUNT_FEE_RATE = 0.0025;
const FEE_DISCOUNT_DURATION_MS = 60000;
const ITEM_DEFINITIONS = [
  { key: 'FEE_DISCOUNT', name: '수수료 할인', price: 120000, description: '60초 동안 매매 수수료를 0.25%로 낮춥니다.' },
  { key: 'OPPONENT_TRADES', name: '상대 거래내역 보기', price: 90000, description: '상대의 최근 거래 내역을 확인합니다.' },
  { key: 'NEXT_SELL_BOOST', name: '다음 매도 수익률 증가', price: 140000, description: '다음 매도 시 수익 보너스 10%를 적용합니다.' },
];
const ITEM_NAME_MAP = Object.fromEntries(ITEM_DEFINITIONS.map((item) => [item.key, item.name]));

function getEffectLabel(effectKey) {
  if (effectKey === 'FEE_DISCOUNT') {
    return '수수료 0.25% 적용 중';
  }
  if (effectKey === 'NEXT_SELL_BOOST') {
    return '다음 매도 수익 보너스 10% 대기 중';
  }
  if (effectKey === 'OPPONENT_TRADES') {
    return '상대 거래내역 확인';
  }

  return ITEM_NAME_MAP[effectKey] || effectKey;
}

function formatEffectLabel(effect, now) {
  const baseLabel = getEffectLabel(effect.key);

  if (effect.key === 'FEE_DISCOUNT' && effect.expireAt) {
    const remainingSeconds = Math.max(0, Math.ceil((effect.expireAt - now) / 1000));
    return `${baseLabel} (${remainingSeconds}초)`;
  }

  return baseLabel;
}

function normalizeActiveEffect(effect, now, previousEffect) {
  if (!effect || typeof effect !== 'object') {
    return effect;
  }

  if (effect.key === 'FEE_DISCOUNT') {
    const previousExpireAt = Number(previousEffect?.expireAt ?? 0);
    if (Number.isFinite(previousExpireAt) && previousExpireAt > now) {
      return { ...effect, expireAt: previousExpireAt };
    }

    const expireAtValue = Number(effect.expireAt ?? 0);
    const cappedExpireAt =
      Number.isFinite(expireAtValue) && expireAtValue > now
        ? Math.min(expireAtValue, now + FEE_DISCOUNT_DURATION_MS)
        : now + FEE_DISCOUNT_DURATION_MS;

    return { ...effect, expireAt: cappedExpireAt };
  }

  return effect;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function generateMockMarket() {
  const headlines = [
    '반도체 업황 회복 기대감 확산',
    '원자재 가격 안정세로 제조업 부담 완화',
    '글로벌 금리 동결 기대에 기술주 강세',
    '기관 자금 유입으로 시장 변동성 축소',
    '신제품 출시 소식에 관련주 관심 집중',
    '수출 증가세로 수혜 기업 실적 개선',
    '경기지표 둔화 우려로 관망세 확대',
  ];

  const points = [];
  const openPrices = [];
  const highPrices = [];
  const lowPrices = [];
  const volumes = [];
  const news = [];
  let price = 100000;
  const baseDate = new Date();
  baseDate.setMonth(baseDate.getMonth() - 3);

  for (let day = 0; day < TOTAL_DAYS; day += 1) {
    const open = day === 0 ? price : points[day - 1];
    const noise = (Math.random() - 0.48) * 0.038;
    const momentum = Math.sin(day / 9) * 0.006;
    const close = Math.max(35000, Math.round(open * (1 + noise + momentum)));
    const upperWickRate = 0.002 + Math.random() * 0.018;
    const lowerWickRate = 0.002 + Math.random() * 0.018;
    const high = Math.max(open, close, Math.round(Math.max(open, close) * (1 + upperWickRate)));
    const low = Math.max(30000, Math.min(open, close, Math.round(Math.min(open, close) * (1 - lowerWickRate))));

    openPrices.push(open);
    highPrices.push(high);
    lowPrices.push(low);
    volumes.push(Math.max(120000, Math.round((0.75 + Math.random() * 1.25) * 1000000 * (1 + Math.abs(noise) * 6))));
    points.push(close);
    price = close;

    if (day % 4 === 0 || day === TOTAL_DAYS - 1) {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() + day);
      news.push({
        day,
        title: headlines[Math.floor(Math.random() * headlines.length)],
        dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
      });
    }
  }

  return { points, news, openPrices, highPrices, lowPrices, volumes };
}

function determineRankFromScore(score) {
  if (score >= 800) return '다이아';
  if (score >= 600) return '플래티넘';
  if (score >= 400) return '골드';
  if (score >= 200) return '실버';
  return '브론즈';
}

export default function StockGameTab({ loginId, initialRankScore = 0 }) {
  const [isDark, setIsDark] = useState(false);
  const [matchMode, setMatchMode] = useState('');
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [matchStatus, setMatchStatus] = useState('');
  const [countdownValue, setCountdownValue] = useState(null);
  const [introText, setIntroText] = useState('');
  const [isIntroActive, setIsIntroActive] = useState(false);
  const [isInGame, setIsInGame] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(MATCH_SECONDS);
  const [marketData, setMarketData] = useState(() => generateMockMarket());
  const [marketIndex, setMarketIndex] = useState(8);
  const [cash, setCash] = useState(STARTING_CASH);
  const [opponentCash, setOpponentCash] = useState(STARTING_CASH);
  const [opponentProfile, setOpponentProfile] = useState({
    loginId: 'opponent',
    nickname: '상대 플레이어',
    rank: '브론즈',
    rankScore: 0,
    totalAsset: STARTING_CASH,
    winRate: 0,
  });
  const [myRankScore, setMyRankScore] = useState(Math.max(0, Math.floor(initialRankScore)));
  const [myRank, setMyRank] = useState(determineRankFromScore(Math.max(0, Math.floor(initialRankScore))));
  const [opponents, setOpponents] = useState([]);
  const [holdingQty, setHoldingQty] = useState(0);
  const [avgPrice, setAvgPrice] = useState(0);
  const [gameMessage, setGameMessage] = useState('15분 동안 더 많은 수익을 만들어 보세요!');
  const [inventory, setInventory] = useState([]);
  const [activeEffects, setActiveEffects] = useState([]);
  const [gameLogs, setGameLogs] = useState([]);
  const [effectNow, setEffectNow] = useState(() => Date.now());
  const [isTradeLocked, setIsTradeLocked] = useState(false);
  const [tradeQuantity, setTradeQuantity] = useState(1);
  const [tradeDialog, setTradeDialog] = useState(null);
  const [opponentDialog, setOpponentDialog] = useState(null);
  const [tradeErrorPulse, setTradeErrorPulse] = useState(0);
  const [itemErrorPulseKey, setItemErrorPulseKey] = useState('');
  const [purchaseToast, setPurchaseToast] = useState(null);
  const [isItemPopupOpen, setIsItemPopupOpen] = useState(false);
  const [isServerDriven, setIsServerDriven] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [gameStockCode, setGameStockCode] = useState('');
  const [gameStockName, setGameStockName] = useState('');
  const [scenarioFrom, setScenarioFrom] = useState('');
  const [scenarioTo, setScenarioTo] = useState('');
  const [lookbackYears, setLookbackYears] = useState(1);
  const [currentHighPrice, setCurrentHighPrice] = useState(0);
  const [currentLowPrice, setCurrentLowPrice] = useState(0);
  const [openPrices, setOpenPrices] = useState([]);
  const [highPrices, setHighPrices] = useState([]);
  const [lowPrices, setLowPrices] = useState([]);
  const [volumes, setVolumes] = useState([]);
  const gameTimerRef = useRef(null);
  const marketTimerRef = useRef(null);
  const effectTimerRef = useRef(null);
  const [matchError, setMatchError] = useState('');
  const socketRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const introExitTimerRef = useRef(null);
  const purchaseToastTimerRef = useRef(null);
  const purchaseToastSequenceRef = useRef(0);
  const tradeErrorResetTimerRef = useRef(null);
  const itemErrorResetTimerRef = useRef(null);
  const shakeAnimationFrameRef = useRef(null);
  const transitionStartedRef = useRef(false);
  const remainingSecondsRef = useRef(MATCH_SECONDS);
  const previousHoldingQtyRef = useRef(0);
  const previousInventoryRef = useRef([]);
  const previousEffectsRef = useRef([]);
  const hasReceivedSnapshotRef = useRef(false);
  const socketUrls = useMemo(() => buildRealtimeSocketUrls(), []);

  function applyLocalMarketSnapshot(nextMarketData, nextMarketIndex) {
    setMarketData(nextMarketData);
    setMarketIndex(nextMarketIndex);
    setOpenPrices(nextMarketData.openPrices ?? []);
    setHighPrices(nextMarketData.highPrices ?? []);
    setLowPrices(nextMarketData.lowPrices ?? []);
    setVolumes(nextMarketData.volumes ?? []);
    setCurrentHighPrice(nextMarketData.highPrices?.[nextMarketIndex] ?? 0);
    setCurrentLowPrice(nextMarketData.lowPrices?.[nextMarketIndex] ?? 0);
  }

  function sendSocketAction(action, payload = {}) {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return false;
    }

    socketRef.current.send(
      JSON.stringify({
        action,
        roomId,
        loginId,
        ...payload,
      }),
    );
    return true;
  }

  useEffect(() => {
    remainingSecondsRef.current = remainingSeconds;
  }, [remainingSeconds]);

  function applyServerSnapshot(eventData) {
    const now = Date.now();
    const nextHoldingQty = typeof eventData.holdingQty === 'number' ? eventData.holdingQty : previousHoldingQtyRef.current;
    const nextInventory = Array.isArray(eventData.inventory) ? eventData.inventory : previousInventoryRef.current;
    const nextEffects = Array.isArray(eventData.activeEffects)
      ? eventData.activeEffects.map((effect) =>
          normalizeActiveEffect(
            effect,
            now,
            previousEffectsRef.current.find((previousEffect) => previousEffect?.key === effect?.key),
          ),
        )
      : previousEffectsRef.current;
    const isInitialSnapshot = !hasReceivedSnapshotRef.current;

    if (typeof eventData.remainingSeconds === 'number') {
      setRemainingSeconds(Math.max(0, Math.floor(eventData.remainingSeconds)));
    }
    if (typeof eventData.cash === 'number') {
      setCash(eventData.cash);
    }
    if (typeof eventData.opponentCash === 'number') {
      setOpponentCash(eventData.opponentCash);
    }
    if (eventData.opponent && typeof eventData.opponent === 'object') {
      setOpponentProfile((current) => ({
        ...current,
        loginId: String(eventData.opponent.loginId ?? current.loginId),
        nickname: String(eventData.opponent.nickname ?? current.nickname),
        rank: String(eventData.opponent.rank ?? current.rank),
        rankScore: Number(eventData.opponent.rankScore ?? current.rankScore),
        totalAsset: Number(eventData.opponent.totalAsset ?? eventData.opponent.cash ?? current.totalAsset),
        winRate: Number(eventData.opponent.winRate ?? current.winRate),
      }));
    }
    if (typeof eventData.rankScore === 'number' && Number.isFinite(eventData.rankScore)) {
      const nextScore = Math.max(0, Math.floor(eventData.rankScore));
      setMyRankScore(nextScore);
      setMyRank(typeof eventData.rank === 'string' && eventData.rank ? eventData.rank : determineRankFromScore(nextScore));
    } else if (typeof eventData.rank === 'string' && eventData.rank) {
      setMyRank(eventData.rank);
    }
    if (Array.isArray(eventData.opponents)) {
      const normalizedOpponents = eventData.opponents
        .map((opponent) => ({
          loginId: String(opponent?.loginId ?? ''),
          nickname: String(opponent?.nickname ?? opponent?.loginId ?? '상대 플레이어'),
          rank: String(opponent?.rank ?? '브론즈'),
          rankScore: Number(opponent?.rankScore ?? 0),
          totalAsset: Number(opponent?.totalAsset ?? opponent?.cash ?? 0),
          cash: Number(opponent?.cash ?? opponent?.totalAsset ?? 0),
          winRate: Number(opponent?.winRate ?? 0),
        }))
        .filter((opponent) => opponent.loginId);

      setOpponents(normalizedOpponents);
      if (normalizedOpponents.length > 0) {
        const leadOpponent = [...normalizedOpponents].sort((a, b) => b.totalAsset - a.totalAsset)[0];
        setOpponentProfile(leadOpponent);
        setOpponentCash(leadOpponent.cash || leadOpponent.totalAsset || STARTING_CASH);
      }
    }
    if (typeof eventData.holdingQty === 'number') {
      setHoldingQty(eventData.holdingQty);
    }
    if (typeof eventData.avgPrice === 'number') {
      setAvgPrice(eventData.avgPrice);
    }
    if (typeof eventData.tradeLocked === 'boolean') {
      setIsTradeLocked(eventData.tradeLocked);
    }
    if (typeof eventData.finished === 'boolean') {
      setGameFinished(eventData.finished);
    }
    if (typeof eventData.message === 'string' && eventData.message.trim()) {
      setGameMessage(eventData.message);
    }
    if (typeof eventData.stockCode === 'string') {
      setGameStockCode(eventData.stockCode);
    }
    if (typeof eventData.stockName === 'string') {
      setGameStockName(eventData.stockName);
    }
    if (typeof eventData.scenarioFrom === 'string') {
      setScenarioFrom(eventData.scenarioFrom);
    }
    if (typeof eventData.scenarioTo === 'string') {
      setScenarioTo(eventData.scenarioTo);
    }
    if (typeof eventData.lookbackYears === 'number' && Number.isFinite(eventData.lookbackYears)) {
      setLookbackYears(Math.max(1, Math.min(3, Math.floor(eventData.lookbackYears))));
    }
    if (typeof eventData.currentHighPrice === 'number' && Number.isFinite(eventData.currentHighPrice)) {
      setCurrentHighPrice(Math.round(eventData.currentHighPrice));
    }
    if (typeof eventData.currentLowPrice === 'number' && Number.isFinite(eventData.currentLowPrice)) {
      setCurrentLowPrice(Math.round(eventData.currentLowPrice));
    }
    if (Array.isArray(eventData.inventory)) {
      setInventory(eventData.inventory);
    }
    if (Array.isArray(eventData.activeEffects)) {
      setActiveEffects(nextEffects);
    }
    if (Array.isArray(eventData.news)) {
      setMarketData((current) => ({ ...current, news: eventData.news }));
    }
    if (Array.isArray(eventData.openPrices)) {
      setOpenPrices(eventData.openPrices.map((price) => Number(price)).filter((price) => Number.isFinite(price)));
    }
    if (Array.isArray(eventData.highPrices)) {
      setHighPrices(eventData.highPrices.map((price) => Number(price)).filter((price) => Number.isFinite(price)));
    }
    if (Array.isArray(eventData.lowPrices)) {
      setLowPrices(eventData.lowPrices.map((price) => Number(price)).filter((price) => Number.isFinite(price)));
    }
    if (Array.isArray(eventData.volumes)) {
      setVolumes(eventData.volumes.map((volume) => Number(volume)).filter((volume) => Number.isFinite(volume)));
    }
    if (Array.isArray(eventData.opponentTradeLogs) && eventData.opponentTradeLogs.length > 0) {
      appendGameLog(`상대 최근 거래: ${eventData.opponentTradeLogs.join(' | ')}`);
    }

    if (!isInitialSnapshot) {
      if (nextHoldingQty !== previousHoldingQtyRef.current) {
        appendGameLog(`보유 주식 수량 변경: ${previousHoldingQtyRef.current}주 -> ${nextHoldingQty}주`);
      }
    }

    previousHoldingQtyRef.current = nextHoldingQty;
    previousInventoryRef.current = Array.isArray(nextInventory) ? [...nextInventory] : [];
    previousEffectsRef.current = Array.isArray(nextEffects) ? [...nextEffects] : [];
    hasReceivedSnapshotRef.current = true;

    if (Array.isArray(eventData.prices) && eventData.prices.length > 1) {
      const normalizedPrices = eventData.prices.map((price) => Number(price)).filter((price) => Number.isFinite(price));
      if (normalizedPrices.length > 1) {
        setMarketData((current) => ({ ...current, points: normalizedPrices }));
        setMarketIndex(Math.max(0, normalizedPrices.length - 1));
        return;
      }
    }

    if (typeof eventData.currentPrice === 'number' && Number.isFinite(eventData.currentPrice)) {
      setMarketData((current) => {
        const nextPoints = [...current.points, Math.round(eventData.currentPrice)].slice(-TOTAL_DAYS);
        return { ...current, points: nextPoints };
      });
      setMarketIndex((current) => Math.min(current + 1, TOTAL_DAYS - 1));
    }
  }

  function handleServerGameEvent(eventData) {
    const eventType = String(eventData?.type ?? eventData?.status ?? '').toUpperCase();
    if (!eventType) {
      return;
    }

    if (
      eventType.includes('MATCHED') ||
      eventType.includes('FOUND') ||
      eventType.includes('COMPLETE') ||
      eventType.includes('READY')
    ) {
      const nextRoomId = String(eventData.roomId ?? eventData.matchId ?? '').trim();
      if (nextRoomId) {
        setRoomId(nextRoomId);
      }
      applyServerSnapshot(eventData);
      runCountdownAndEnterGame();
      return;
    }

    if (eventType.includes('GAME_START') || eventType === 'START') {
      runCountdownAndEnterGame();
      applyServerSnapshot(eventData);
      return;
    }

    if (eventType.includes('STATE') || eventType.includes('SNAPSHOT') || eventType.includes('TICK')) {
      applyServerSnapshot(eventData);
      return;
    }

    if (eventType.includes('TRADE_RESULT') || eventType.includes('ITEM_RESULT')) {
      applyServerSnapshot(eventData);
      return;
    }

    if (eventType.includes('GAME_END') || eventType.includes('FINISH')) {
      applyServerSnapshot({ ...eventData, finished: true, tradeLocked: true });
      setGameFinished(true);
      return;
    }
  }

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setIsDark(true);
    }, 120);

    return () => {
      window.clearTimeout(timerId);
      window.clearInterval(countdownTimerRef.current);
      window.clearTimeout(introExitTimerRef.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  function resetMatchFlowState() {
    setMatchStatus('');
    setCountdownValue(null);
    setIntroText('');
    setIsIntroActive(false);
    setMatchError('');
    setIsMatchmaking(false);
    setIsItemPopupOpen(false);
    transitionStartedRef.current = false;
    window.clearTimeout(introExitTimerRef.current);
  }

  function closeModal() {
    if (isMatchmaking) {
      return;
    }
    setMatchMode('');
    resetMatchFlowState();
  }

  function enterPreviewGame() {
    const previewMarket = generateMockMarket();

    window.clearInterval(countdownTimerRef.current);
    window.clearTimeout(introExitTimerRef.current);
    setMatchMode('');
    setIsMatchmaking(false);
    setMatchStatus('');
    setCountdownValue(null);
    setMatchError('');
    setIsServerDriven(false);
    setRoomId('');
    setIsInGame(true);
    setGameFinished(false);
    setRemainingSeconds(MATCH_SECONDS);
    applyLocalMarketSnapshot(previewMarket, 0);
    setCash(STARTING_CASH);
    setOpponentCash(STARTING_CASH);
    setOpponentProfile({
      loginId: 'opponent',
      nickname: '상대 플레이어',
      rank: '브론즈',
      rankScore: 0,
      totalAsset: STARTING_CASH,
      winRate: 0,
    });
    setMyRankScore(0);
    setMyRank('브론즈');
    setOpponents([]);
    setHoldingQty(0);
    setAvgPrice(0);
    setInventory([]);
    setActiveEffects([]);
    setGameLogs([]);
    setGameMessage('15분 동안 더 많은 수익을 만들어 보세요!');
    setIsTradeLocked(false);
    setTradeQuantity(1);
    setTradeDialog(null);
    setIsItemPopupOpen(false);
    setGameStockCode('PREVIEW');
    setGameStockName('미리보기 종목');
    previousHoldingQtyRef.current = 0;
    previousInventoryRef.current = [];
    previousEffectsRef.current = [];
    hasReceivedSnapshotRef.current = false;
    transitionStartedRef.current = false;
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  }

  function enterInGameState() {
    const previewMarket = generateMockMarket();

    setMatchMode('');
    setIsMatchmaking(false);
    setIsInGame(true);
    setGameFinished(false);
    setRemainingSeconds(MATCH_SECONDS);
    applyLocalMarketSnapshot(previewMarket, 8);
    setCash(STARTING_CASH);
    setOpponentCash(STARTING_CASH);
    setOpponents([]);
    setHoldingQty(0);
    setAvgPrice(0);
    setInventory([]);
    setActiveEffects([]);
    setGameLogs([]);
    setGameMessage('15분 동안 더 많은 수익을 만들어 보세요!');
    setIsTradeLocked(false);
    setTradeQuantity(1);
    setTradeDialog(null);
    setIsItemPopupOpen(false);
    previousHoldingQtyRef.current = 0;
    previousInventoryRef.current = [];
    previousEffectsRef.current = [];
    hasReceivedSnapshotRef.current = false;
    transitionStartedRef.current = false;
  }

  function runCountdownAndEnterGame() {
    if (transitionStartedRef.current) {
      return;
    }

    transitionStartedRef.current = true;
    setMatchStatus('매칭 완료');
    setIsIntroActive(true);
    setIntroText('3');
    setCountdownValue(3);

    countdownTimerRef.current = window.setInterval(() => {
      setCountdownValue((current) => {
        if (current === null) {
          return null;
        }

        if (current <= 1) {
          window.clearInterval(countdownTimerRef.current);
          setIntroText('게임 시작!');
          introExitTimerRef.current = window.setTimeout(() => {
            setIsIntroActive(false);
            setIntroText('');
            enterInGameState();
          }, 650);
          return null;
        }

        setIntroText(String(current - 1));
        return current - 1;
      });
    }, 700);
  }

  async function startMatchmaking() {
    if (!matchMode || isMatchmaking) {
      return;
    }

    setIsMatchmaking(true);
    setMatchError('');

    if (!socketUrls.length) {
      setIsMatchmaking(false);
      setMatchError('실시간 매치메이킹 주소가 설정되지 않았습니다. VITE_API_BASE_URL을 확인해 주세요.');
      return;
    }

    const requestPayload = { mode: matchMode, loginId };
    let connected = false;

    for (const socketUrl of socketUrls) {
      try {
        await new Promise((resolve, reject) => {
          const socket = new WebSocket(socketUrl);
          socketRef.current = socket;
          let hasResolved = false;

          const connectionTimeoutId = window.setTimeout(() => {
            if (hasResolved) {
              return;
            }
            hasResolved = true;
            socket.close();
            reject(new Error('timeout'));
          }, 30000);

          socket.onopen = () => {
            socket.send(JSON.stringify(requestPayload));
          };

          socket.onmessage = (event) => {
            try {
              const parsed = JSON.parse(event.data);
              handleServerGameEvent(parsed);
              const matched = getMatchedPayload(parsed);
              if (matched && !hasResolved) {
                window.clearTimeout(connectionTimeoutId);
                hasResolved = true;
                resolve(matched);
              }
            } catch (_error) {
              // Ignore non-JSON frames (heartbeat, etc.)
            }
          };

          socket.onerror = () => {
            if (!hasResolved) {
              window.clearTimeout(connectionTimeoutId);
              hasResolved = true;
              reject(new Error('socket-error'));
            }
          };

          socket.onclose = () => {
            if (!hasResolved) {
              window.clearTimeout(connectionTimeoutId);
              hasResolved = true;
              reject(new Error('socket-closed'));
            }
          };
        });

        connected = true;
        break;
      } catch (_error) {
        if (socketRef.current) {
          socketRef.current.close();
          socketRef.current = null;
        }
      }
    }

    if (!connected) {
      setIsMatchmaking(false);
      setMatchError('실시간 매치메이킹 서버에 연결하지 못했습니다.');
      return;
    }

    setIsServerDriven(true);
    setMatchStatus('매치메이킹 대기 중...');
  }

  useEffect(() => {
    if (!isInGame || gameFinished || isServerDriven) {
      return undefined;
    }

    gameTimerRef.current = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(gameTimerRef.current);
          setIsTradeLocked(true);
          finishGame();
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    marketTimerRef.current = window.setInterval(() => {
      setMarketIndex((current) => Math.min(current + 1, TOTAL_DAYS - 1));
      setOpponentCash((current) => {
        const nextValue = Math.max(0, Math.round(current * (1 + (Math.random() - 0.49) * 0.008)));
        setOpponentProfile((profile) => ({ ...profile, totalAsset: nextValue }));
        return nextValue;
      });
    }, 3000);

    return () => {
      window.clearInterval(gameTimerRef.current);
      window.clearInterval(marketTimerRef.current);
    };
  }, [isInGame, gameFinished, isServerDriven]);

  useEffect(() => {
    if (!isInGame || gameFinished) {
      return undefined;
    }

    effectTimerRef.current = window.setInterval(() => {
      setEffectNow(Date.now());
      setActiveEffects((current) => current.filter((effect) => !effect.expireAt || effect.expireAt > Date.now()));
    }, 250);

    return () => {
      window.clearInterval(effectTimerRef.current);
    };
  }, [isInGame, gameFinished]);

  useEffect(
    () => () => {
      window.clearTimeout(purchaseToastTimerRef.current);
      window.clearTimeout(tradeErrorResetTimerRef.current);
      window.clearTimeout(itemErrorResetTimerRef.current);
      window.cancelAnimationFrame(shakeAnimationFrameRef.current);
    },
    [],
  );

  function finishGame() {
    setGameFinished(true);

    const currentPrice = marketData.points[marketIndex] ?? marketData.points[0];
    const liquidationValue = holdingQty * currentPrice;
    const finalCash = cash + liquidationValue;
    setCash(finalCash);
    setHoldingQty(0);
    setAvgPrice(0);

    const result = finalCash > opponentCash ? '승리' : finalCash < opponentCash ? '패배' : '무승부';
    const summaryMessage = `제한시간 종료! 자동 매도 후 내 자금 ${formatCurrency(finalCash)} / 상대 자금 ${formatCurrency(opponentCash)} · ${result}`;
    setGameMessage(summaryMessage);
    appendGameLog(summaryMessage);
  }

  function hasEffect(effectKey) {
    return activeEffects.some((effect) => effect.key === effectKey && (!effect.expireAt || effect.expireAt > Date.now()));
  }

  function getCurrentFeeRate() {
    return hasEffect('FEE_DISCOUNT') ? DISCOUNT_FEE_RATE : BASE_FEE_RATE;
  }

  function handleTradeQuantityChange(value) {
    if (!Number.isFinite(value)) {
      setTradeQuantity(1);
      return;
    }

    setTradeQuantity(Math.max(1, Math.floor(value)));
  }

  function openTradeDialog(mode) {
    if (isTradeLocked || gameFinished) {
      return;
    }

    if (mode === 'sell' && holdingQty < 1) {
      return;
    }

    setTradeDialog(mode);
    setTradeQuantity(1);
  }

  function closeTradeDialog() {
    setTradeDialog(null);
    setTradeQuantity(1);
  }

  function formatElapsedLogTime() {
    const elapsedSeconds = Math.max(0, MATCH_SECONDS - remainingSecondsRef.current);
    const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
    const seconds = String(elapsedSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function appendGameLog(text) {
    const trimmedText = String(text ?? '').trim();
    if (!trimmedText) {
      return;
    }

    const timestamp = formatElapsedLogTime();

    setGameLogs((current) => [{ id: `${Date.now()}-${current.length}`, text: trimmedText, timestamp }, ...current].slice(0, 24));
  }

  function showPurchaseDeniedToast(target, message = '구매할 수 없습니다.') {
    window.clearTimeout(purchaseToastTimerRef.current);
    purchaseToastSequenceRef.current += 1;
    setPurchaseToast({
      id: purchaseToastSequenceRef.current,
      target,
      message,
    });
    purchaseToastTimerRef.current = window.setTimeout(() => {
      setPurchaseToast(null);
    }, 1600);
  }

  function triggerTradeDeniedFeedback(message = '구매할 수 없습니다.') {
    window.clearTimeout(tradeErrorResetTimerRef.current);
    window.cancelAnimationFrame(shakeAnimationFrameRef.current);
    setTradeErrorPulse(0);
    shakeAnimationFrameRef.current = window.requestAnimationFrame(() => {
      setTradeErrorPulse(Date.now());
      tradeErrorResetTimerRef.current = window.setTimeout(() => {
        setTradeErrorPulse(0);
      }, 460);
    });
    showPurchaseDeniedToast('trade', message);
  }

  function triggerItemDeniedFeedback(itemKey, actionType = 'buy', message = '구매할 수 없습니다.') {
    window.clearTimeout(itemErrorResetTimerRef.current);
    window.cancelAnimationFrame(shakeAnimationFrameRef.current);
    setItemErrorPulseKey('');
    shakeAnimationFrameRef.current = window.requestAnimationFrame(() => {
      setItemErrorPulseKey(`${itemKey}-${actionType}-${Date.now()}`);
      itemErrorResetTimerRef.current = window.setTimeout(() => {
        setItemErrorPulseKey('');
      }, 460);
    });
    showPurchaseDeniedToast('item', message);
  }

  function countItemsByKey(items) {
    return items.reduce((counts, itemKey) => {
      counts[itemKey] = (counts[itemKey] ?? 0) + 1;
      return counts;
    }, {});
  }

  function handleConfirmTrade() {
    if (!tradeDialog || isTradeLocked || gameFinished) {
      return;
    }

    const qty = Math.max(1, Math.floor(tradeQuantity));
    const currentPrice = marketData.points[marketIndex] ?? 0;
    const feeRate = getCurrentFeeRate();

    if (tradeDialog === 'buy') {
      const fee = Math.round(currentPrice * qty * feeRate);
      const totalCost = currentPrice * qty + fee;

      if (cash < totalCost) {
        setGameMessage('자금이 부족하여 매수할 수 없습니다.');
        triggerTradeDeniedFeedback('구매할 수 없습니다.');
        return;
      }
    }

    if (tradeDialog === 'sell' && holdingQty < qty) {
      setGameMessage('보유 수량보다 많이 매도할 수 없습니다.');
      triggerTradeDeniedFeedback('매도할 수 없습니다.');
      return;
    }

    if (isServerDriven) {
      const action = tradeDialog === 'buy' ? 'BUY' : 'SELL';
      const failureMessage =
        tradeDialog === 'buy' ? '서버에 매수 요청을 보내지 못했습니다.' : '서버에 매도 요청을 보내지 못했습니다.';
      const sent = sendSocketAction(action, { quantity: qty });
      if (!sent) {
        setGameMessage(failureMessage);
      } else {
        closeTradeDialog();
      }
      return;
    }

    if (tradeDialog === 'buy') {
      const fee = Math.round(currentPrice * qty * feeRate);
      const totalCost = currentPrice * qty + fee;

      const nextQty = holdingQty + qty;
      const weighted = holdingQty * avgPrice + qty * currentPrice;
      setCash((current) => current - totalCost);
      setHoldingQty(nextQty);
      setAvgPrice(Math.round(weighted / nextQty));
      const message = `${qty}주 매수 완료. 현재 보유 ${nextQty}주 / 수수료 ${formatCurrency(fee)}`;
      setGameMessage(message);
      appendGameLog(message);
      closeTradeDialog();
      return;
    }

    const gross = currentPrice * qty;
    const fee = Math.round(gross * feeRate);
    const profit = Math.max(0, (currentPrice - avgPrice) * qty);
    const boostBonus = hasEffect('NEXT_SELL_BOOST') ? Math.round(profit * 0.1) : 0;
    const net = gross - fee + boostBonus;
    const nextQty = holdingQty - qty;

    setCash((current) => current + net);
    setHoldingQty(nextQty);
    if (nextQty === 0) {
      setAvgPrice(0);
    }
    if (hasEffect('NEXT_SELL_BOOST')) {
      setActiveEffects((current) => current.filter((effect) => effect.key !== 'NEXT_SELL_BOOST'));
    }
    const message = `${qty}주 매도 완료. 현재 보유 ${nextQty}주 / 수수료 ${formatCurrency(fee)} / 보너스 ${formatCurrency(boostBonus)}`;
    setGameMessage(message);
    appendGameLog(message);
    closeTradeDialog();
  }

  function handleBuyItem(item) {
    if (cash < item.price) {
      setGameMessage('아이템 구매 자금이 부족합니다.');
      triggerItemDeniedFeedback(item.key, 'buy');
      return;
    }

    if (isServerDriven) {
      const sent = sendSocketAction('ITEM_BUY', { itemKey: item.key });
      if (!sent) {
        setGameMessage('서버에 아이템 구매 요청을 보내지 못했습니다.');
      }
      return;
    }

    setCash((current) => current - item.price);
    setInventory((current) => [...current, item.key]);
    const nextCount = (itemInventoryCounts[item.key] ?? 0) + 1;
    const message = `${item.name} 구매 완료. 보유 ${nextCount}개`;
    setGameMessage(message);
    appendGameLog(message);
  }

  function handleUseItem(itemKey) {
    const ownedCount = itemInventoryCounts[itemKey] ?? 0;
    if (ownedCount < 1) {
      setGameMessage('아이템을 사용할 수 없습니다.');
      triggerItemDeniedFeedback(itemKey, 'use', '아이템을 사용할 수 없습니다.');
      return;
    }

    if (isServerDriven) {
      const sent = sendSocketAction('ITEM_USE', { itemKey });
      if (!sent) {
        setGameMessage('서버에 아이템 사용 요청을 보내지 못했습니다.');
      }
      return;
    }

    const hasItem = inventory.includes(itemKey);
    if (!hasItem) {
      setGameMessage('보유 중인 아이템이 없습니다.');
      return;
    }

    setInventory((current) => {
      const next = [...current];
      const index = next.indexOf(itemKey);
      next.splice(index, 1);
      return next;
    });

    if (itemKey === 'OPPONENT_TRADES') {
      const message = '상대 거래내역 보기 아이템을 사용했습니다.';
      setGameMessage(message);
      return;
    }

    if (itemKey === 'FEE_DISCOUNT') {
      const durationMs = 60000;
      setActiveEffects((current) => [
        ...current.filter((effect) => effect.key !== itemKey),
        { key: itemKey, expireAt: Date.now() + durationMs },
      ]);
      const message = '수수료 할인이 60초 동안 적용됩니다. (0.25%)';
      setGameMessage(message);
      return;
    }

    if (itemKey === 'NEXT_SELL_BOOST') {
      setActiveEffects((current) => [
        ...current.filter((effect) => effect.key !== itemKey),
        { key: itemKey },
      ]);
      const message = '다음 매도 시 수익 보너스 10%가 적용됩니다.';
      setGameMessage(message);
    }
  }

  const currentPrice = marketData.points[marketIndex] ?? marketData.points[0];
  const displayedCurrentHighPrice = currentHighPrice || marketData.highPrices?.[marketIndex] || currentPrice;
  const displayedCurrentLowPrice = currentLowPrice || marketData.lowPrices?.[marketIndex] || currentPrice;
  const totalAsset = cash + holdingQty * currentPrice;
  const pnl = holdingQty > 0 ? (currentPrice - avgPrice) * holdingQty : 0;
  const returnRate = holdingQty > 0 && avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;
  const feeRate = getCurrentFeeRate();
  const normalizedTradeQuantity = Math.max(1, Math.floor(tradeQuantity));
  const estimatedBuyFee = Math.round(currentPrice * normalizedTradeQuantity * feeRate);
  const estimatedBuyCost = currentPrice * normalizedTradeQuantity + estimatedBuyFee;
  const estimatedSellFee = Math.round(currentPrice * normalizedTradeQuantity * feeRate);
  const estimatedSellBonus = hasEffect('NEXT_SELL_BOOST')
    ? Math.round(Math.max(0, (currentPrice - avgPrice) * normalizedTradeQuantity) * 0.1)
    : 0;
  const maxBuyQuantity = currentPrice > 0 ? Math.max(0, Math.floor(cash / (currentPrice * (1 + feeRate)))) : 0;
  const mm = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const ss = String(remainingSeconds % 60).padStart(2, '0');
  const currentRank = myRank || determineRankFromScore(myRankScore);
  const itemInventoryCounts = useMemo(
    () =>
      inventory.reduce((counts, itemKey) => {
        counts[itemKey] = (counts[itemKey] ?? 0) + 1;
        return counts;
      }, {}),
    [inventory],
  );
  const activeEffectLabels = useMemo(
    () =>
      activeEffects
        .filter((effect) => !effect.expireAt || effect.expireAt > Date.now())
        .map((effect) => formatEffectLabel(effect, effectNow)),
    [activeEffects, effectNow],
  );
  const gameChartPoints = useMemo(
    () =>
      marketData.points.map((value, index) => ({
        time: index + 1,
        value: Number(value),
      })),
    [marketData.points],
  );
  const gameCandlestickPoints = useMemo(
    () =>
      marketData.points.map((value, index) => {
        const open = Number(openPrices[index] ?? marketData.openPrices?.[index] ?? marketData.points[index - 1] ?? value);
        const close = Number(value);
        const high = Number(highPrices[index] ?? marketData.highPrices?.[index] ?? Math.max(open, close));
        const low = Number(lowPrices[index] ?? marketData.lowPrices?.[index] ?? Math.min(open, close));

        return {
          time: index + 1,
          open,
          high,
          low,
          close,
        };
      }),
    [highPrices, lowPrices, marketData.highPrices, marketData.lowPrices, marketData.openPrices, marketData.points, openPrices],
  );
  const gameVolumePoints = useMemo(
    () =>
      marketData.points.map((value, index) => {
        const open = Number(openPrices[index] ?? marketData.openPrices?.[index] ?? marketData.points[index - 1] ?? value);
        const close = Number(value);
        const volumeValue = Number(volumes[index] ?? marketData.volumes?.[index] ?? 0);

        return {
          time: index + 1,
          value: Math.max(0, volumeValue),
          color: close >= open ? '#ff6d6f' : '#2f74ec',
        };
      }),
    [marketData.openPrices, marketData.points, marketData.volumes, openPrices, volumes],
  );
  const isMultiOpponentMatch = opponents.length > 1;

  if (isInGame) {
    return (
      <section className={`stock-game-shell ${isDark ? 'dark' : ''}`}>
        <div className="stock-game-overlay" />
        <div className="stock-game-content ingame pvp-ingame">
          <header className="pvp-head">
            <div className="pvp-head-main">
              <div className="pvp-timer">{`${mm}:${ss}`}</div>
              <div className="pvp-summary pvp-summary--inline">
                <article>
                  <span>내 자금</span>
                  <strong>{formatCurrency(cash)}</strong>
                </article>
                <article>
                  <span>총 보유자산</span>
                  <strong>{formatCurrency(totalAsset)}</strong>
                </article>
                <article>
                  {isMultiOpponentMatch ? (
                    <button type="button" className="pvp-summary-button" onClick={() => setOpponentDialog('cash')}>
                      상대 자금
                    </button>
                  ) : (
                    <>
                      <span>상대 자금</span>
                      <strong>{formatCurrency(opponentCash)}</strong>
                    </>
                  )}
                </article>
              </div>
            </div>
            <article className="pvp-rank-card">
              <span>현재 랭크</span>
              <strong>{`${currentRank} (${myRankScore}점)`}</strong>
            </article>
          </header>

          <section className="pvp-layout">
            <div className="pvp-left">
              <div className="pvp-card pvp-chart">
                <div className="pvp-card-head">
                  <h2>{`${gameStockName || '게임 종목'} (${gameStockCode || '-'})`}</h2>
                  <p>
                    {`${gameStockCode === 'FALLBACK' ? '테스트' : '실제'} ${lookbackYears}년 구간 · ${scenarioFrom || '-'} ~ ${scenarioTo || '-'} · 현재가 ${formatCurrency(currentPrice)} · 고가 ${formatCurrency(displayedCurrentHighPrice)} · 저가 ${formatCurrency(displayedCurrentLowPrice)}`}
                  </p>
                </div>
                <RealtimePriceChart
                  companyName={gameStockName || gameStockCode || '게임 종목'}
                  points={gameChartPoints}
                  candlestickPoints={gameCandlestickPoints}
                  volumePoints={gameVolumePoints}
                  averagePrice={holdingQty > 0 ? avgPrice : 0}
                  pinFirstCandleLeft
                  currentPrice={currentPrice}
                  currentHighPrice={displayedCurrentHighPrice}
                  currentLowPrice={displayedCurrentLowPrice}
                  currentReturnRate={returnRate}
                  //changeRate={0}
                  isLoading={false}
                  statusMessage={'과거 6개월 데이터를 15분 배속으로 재생 중입니다.'}
                  statusTone="info"
                  tradeFeedback={gameMessage}
                  onBuyClick={() => openTradeDialog('buy')}
                  onSellClick={() => openTradeDialog('sell')}
                  onAuxClick={() => setIsItemPopupOpen(true)}
                  auxButtonLabel="아이템"
                  disableBuy={isTradeLocked || gameFinished}
                  disableSell={isTradeLocked || gameFinished || holdingQty < 1}
                  disableAuxButton={gameFinished}
                  hideFooterText
                />
              </div>

            </div>

            <div className="pvp-right">
              <div className="pvp-card pvp-log-panel">
                <div className="pvp-card-head">
                  <h2>게임 로그</h2>
                </div>
                <div className="pvp-log-summary">
                  <article>
                    <span>현재 보유</span>
                    <strong>{`${holdingQty}주`}</strong>
                  </article>
                  <article>
                    <span>사용 가능 아이템</span>
                    <strong>{`${inventory.length}개`}</strong>
                  </article>
                </div>
                <div className="pvp-log-effects">
                  <span>활성 효과</span>
                  <div>
                    {activeEffectLabels.length ? (
                      activeEffectLabels.map((label) => <em key={label}>{label}</em>)
                    ) : (
                      <em className="muted">활성 효과 없음</em>
                    )}
                  </div>
                </div>
                <ul className="pvp-log-list">
                  {gameLogs.length ? (
                    gameLogs.map((log) => (
                      <li key={log.id}>
                        <strong>{log.timestamp}</strong>
                        <span>{log.text}</span>
                      </li>
                    ))
                  ) : null}
                </ul>
              </div>

              <div className="pvp-card pvp-opponent">
                <div className="pvp-card-head">
                  <h2>상대 정보</h2>
                </div>
                {isMultiOpponentMatch ? (
                  <button type="button" className="pvp-opponent-open-button" onClick={() => setOpponentDialog('info')}>
                    상대 정보
                  </button>
                ) : (
                  <div className="pvp-opponent-body">
                    <p>{opponentProfile.nickname}</p>
                    <span>{`ID: ${opponentProfile.loginId}`}</span>
                    <strong>{opponentProfile.rank}</strong>
                    <small>{`랭크 점수 ${Math.max(0, Math.floor(opponentProfile.rankScore || 0))}점`}</small>
                    <em>{`보유자산 ${formatCurrency(opponentProfile.totalAsset || opponentCash)}`}</em>
                    <small>{`승률 ${Number.isFinite(opponentProfile.winRate) ? opponentProfile.winRate.toFixed(1) : '0.0'}%`}</small>
                  </div>
                )}
              </div>
            </div>
          </section>


          {isItemPopupOpen ? (
            <div className="pvp-item-popup-backdrop" role="presentation" onClick={() => setIsItemPopupOpen(false)}>
              <div className="pvp-item-popup" role="dialog" aria-modal="true" aria-label="아이템 사용 공간" onClick={(event) => event.stopPropagation()}>
                <div className="pvp-item-popup-header">
                  <div>
                    <h2>아이템 사용 공간</h2>
                    <p>구매 후 바로 사용하거나 보유 아이템을 확인할 수 있습니다.</p>
                  </div>
                  <button type="button" className="pvp-item-popup-close" aria-label="아이템 팝업 닫기" onClick={() => setIsItemPopupOpen(false)}>
                    ×
                  </button>
                </div>
                {purchaseToast?.target === 'item' ? (
                  <div key={purchaseToast.id} className="modal-floating-toast" role="status" aria-live="polite">
                    {purchaseToast.message}
                  </div>
                ) : null}
                <div className="pvp-item-list">
                  {ITEM_DEFINITIONS.map((item) => (
                    <article key={item.key}>
                      <div className="pvp-item-card-head">
                        <strong>{item.name}</strong>
                        <span className="pvp-item-count" aria-label={`${item.name} 보유 수량`}>
                          {itemInventoryCounts[item.key] ?? 0}개
                        </span>
                      </div>
                      <p>{item.description}</p>
                      <em>{formatCurrency(item.price)}</em>
                      <div className="pvp-item-actions">
                        <button
                          type="button"
                          className={[
                            'pvp-item-buy-btn',
                            itemErrorPulseKey.startsWith(`${item.key}-buy-`) ? 'is-denied-shake' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onClick={() => handleBuyItem(item)}
                          disabled={isTradeLocked}
                        >
                          구매
                        </button>
                        <button
                          type="button"
                          className={itemErrorPulseKey.startsWith(`${item.key}-use-`) ? 'is-denied-shake' : ''}
                          onClick={() => handleUseItem(item.key)}
                          disabled={isTradeLocked}
                        >
                          사용
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {tradeDialog ? (
            <div className="modal-backdrop" role="presentation" onClick={closeTradeDialog}>
              <div
                className="trade-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="stock-game-trade-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="trade-modal-head">
                  <div>
                    <p className="trade-modal-eyebrow">{gameStockName || gameStockCode || '게임 종목'}</p>
                    <h3 id="stock-game-trade-title">{tradeDialog === 'buy' ? '매수 주문' : '매도 주문'}</h3>
                  </div>
                  <button type="button" className="trade-close" onClick={closeTradeDialog}>
                    ×
                  </button>
                </div>

                <div className="trade-modal-body">
                  <div className="trade-price-box">
                    <span>현재가</span>
                    <strong>{formatCurrency(currentPrice)}</strong>
                  </div>

                  <label className="trade-field">
                    <span>수량</span>
                    <div className="trade-stepper">
                      <button type="button" onClick={() => handleTradeQuantityChange(Math.max(1, normalizedTradeQuantity - 1))}>
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={tradeQuantity}
                        onChange={(event) => handleTradeQuantityChange(Number(event.target.value))}
                      />
                      <button type="button" onClick={() => handleTradeQuantityChange(normalizedTradeQuantity + 1)}>
                        +
                      </button>
                    </div>
                  </label>

                  <div className="trade-summary">
                    <span>{tradeDialog === 'buy' ? '예상 매수 금액' : '예상 매도 정산'}</span>
                    <strong>
                      {tradeDialog === 'buy'
                        ? formatCurrency(estimatedBuyCost)
                        : formatCurrency(currentPrice * normalizedTradeQuantity - estimatedSellFee + estimatedSellBonus)}
                    </strong>
                  </div>

                  <p className="trade-limit">
                    {tradeDialog === 'buy'
                      ? `현재 자금 기준 최대 ${maxBuyQuantity}주까지 매수할 수 있습니다.`
                      : `현재 보유 ${holdingQty}주까지 매도할 수 있습니다.`}
                  </p>
                </div>

                {purchaseToast?.target === 'trade' ? (
                  <div key={purchaseToast.id} className="modal-floating-toast" role="status" aria-live="polite">
                    {purchaseToast.message}
                  </div>
                ) : null}
                <div className="trade-modal-actions">
                  <button type="button" className="secondary" onClick={closeTradeDialog}>
                    취소
                  </button>
                  <button
                    type="button"
                    className={[
                      tradeDialog === 'buy' ? 'primary buy' : 'primary sell',
                      tradeErrorPulse ? 'is-denied-shake' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={handleConfirmTrade}
                  >
                    {tradeDialog === 'buy' ? '매수 확정' : '매도 확정'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {opponentDialog ? (
            <div className="modal-backdrop" role="presentation" onClick={() => setOpponentDialog(null)}>
              <div
                className="trade-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="stock-game-opponent-dialog-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="trade-modal-head">
                  <div>
                    <p className="trade-modal-eyebrow">{`${opponents.length + 1}인 매치`}</p>
                    <h3 id="stock-game-opponent-dialog-title">
                      {opponentDialog === 'cash' ? '상대 자금' : '상대 정보'}
                    </h3>
                  </div>
                  <button type="button" className="trade-close" onClick={() => setOpponentDialog(null)}>
                    ×
                  </button>
                </div>

                <div className="trade-modal-body pvp-opponent-dialog-list">
                  {opponents.map((opponent) =>
                    opponentDialog === 'cash' ? (
                      <article key={opponent.loginId} className="pvp-opponent-dialog-item">
                        <strong>{opponent.nickname}</strong>
                        <span>{formatCurrency(opponent.totalAsset || opponent.cash || 0)}</span>
                      </article>
                    ) : (
                      <article key={opponent.loginId} className="pvp-opponent-dialog-item pvp-opponent-dialog-item-info">
                        <strong>{opponent.nickname}</strong>
                        <span>{`ID: ${opponent.loginId}`}</span>
                        <span>{`랭크: ${opponent.rank}`}</span>
                        <span>{`랭크 점수 ${Math.max(0, Math.floor(opponent.rankScore || 0))}점`}</span>
                        <em>{`보유자산 ${formatCurrency(opponent.totalAsset || opponent.cash || 0)}`}</em>
                        <span>{`승률 ${Number.isFinite(opponent.winRate) ? opponent.winRate.toFixed(1) : '0.0'}%`}</span>
                      </article>
                    ),
                  )}
                </div>
              </div>
            </div>
          ) : null}


        </div>
      </section>
    );
  }

  return (
    <section className={`stock-game-shell ${isDark ? 'dark' : ''} ${isIntroActive ? 'start-transition' : ''}`}>
      <div className="stock-game-overlay" />

      {!matchMode ? (
        <div className="stock-game-content stock-game-home">
          <h1>미니게임에 도전해 보세요</h1>
          <p>상대보다 더 많은 수익을 만들어 보세요.</p>

          <div className="stock-game-actions">
            <button type="button" onClick={() => setMatchMode('1vs1')}>
              1vs1
            </button>
            <button type="button" onClick={() => setMatchMode('1vsALL')}>
              1vsALL
            </button>
          </div>

          {!isInGame ? (
            <button type="button" className="stock-game-preview-button" onClick={enterPreviewGame}>
              튜토리얼 미리보기
            </button>
          ) : null}
        </div>
      ) : (
        <div className="stock-game-content stock-game-match-screen">
          <div className="stock-game-match-panel">
            <header className="stock-game-match-head">
              <h2>{matchMode} 랭크 매치</h2>
              <button type="button" onClick={closeModal} disabled={isMatchmaking}>
                뒤로
              </button>
            </header>

            <div className="stock-game-rank-summary">
              <p>{`현재 랭크: ${currentRank}`}</p>
              <p>{`현재 점수: ${myRankScore}점`}</p>
            </div>

            <div className="stock-game-rank-rule">
              <p>{'랭크 티어: 브론즈 / 실버 / 골드 / 플래티넘 / 다이아'}</p>
              <p>{'티어 점수 구간: 0~199 / 200~399 / 400~599 / 600~799 / 800+'}</p>
              <p>
                {matchMode === '1vs1'
                  ? '승리시 25점을 획득, 패배시 25점이 차감됩니다.'
                  : '5위: -10점 / 4위: 0점 / 3위: 10점 / 2위: 20점 / 1위: 30점'}
              </p>
            </div>

            <p className="stock-game-match-desc">
              {matchMode === '1vsALL'
                ? '15분 동안 살아남아 가장 많은 수익을 만든 사람이 승리합니다! (5명이 매칭됩니다)'
                : '15분 동안 상대보다 더 많은 수익을 만들면 승리합니다!'}
            </p>
            <p className="stock-game-match-state">
              {'이번 매치 종목: ' + (gameStockName || '매칭 시 공개') + ' (' + (gameStockCode || '-') + ')'}
            </p>

            {matchStatus ? <p className="stock-game-match-state">{matchStatus}</p> : null}
            {countdownValue ? <p className="stock-game-countdown">{countdownValue}</p> : null}
            {matchError ? <p className="stock-game-match-error">{matchError}</p> : null}

            <button type="button" className="stock-game-match-button" onClick={startMatchmaking} disabled={isMatchmaking}>
              {isMatchmaking ? '매치메이킹 중...' : '매치메이킹'}
            </button>
          </div>
        </div>
      )}

      {isIntroActive ? (
        <div className="stock-game-start-overlay" role="status" aria-live="assertive">
          <p key={introText} className={`stock-game-start-count ${introText === '게임 시작!' ? 'go' : ''}`}>
            {introText}
          </p>
        </div>
      ) : null}

    </section>
  );
}
