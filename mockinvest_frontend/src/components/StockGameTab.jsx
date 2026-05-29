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
const ITEM_DEFINITIONS = [
  { key: 'FEE_DISCOUNT', name: '수수료 할인', price: 120000, description: '매매 수수료를 60초 동안 0.2%p 낮춥니다.' },
  { key: 'VOLATILITY_GUARD', name: '변동성 방어', price: 150000, description: '60초 동안 급격한 가격 변동을 완화합니다.' },
  { key: 'SIGNAL_HINT', name: '신호 힌트', price: 80000, description: '최근 뉴스 기반 힌트 문구를 제공합니다.' },
];

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
  const news = [];
  let price = 100000;
  const baseDate = new Date();
  baseDate.setMonth(baseDate.getMonth() - 3);

  for (let day = 0; day < TOTAL_DAYS; day += 1) {
    const noise = (Math.random() - 0.48) * 0.038;
    const momentum = Math.sin(day / 9) * 0.006;
    price = Math.max(35000, Math.round(price * (1 + noise + momentum)));
    points.push(price);

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

  return { points, news };
}

function determineRankFromCash(cash) {
  if (cash >= 10000000) return '다이아';
  if (cash >= 8500000) return '플래티넘';
  if (cash >= 7000000) return '골드';
  if (cash >= 6000000) return '실버';
  return '브론즈';
}

export default function StockGameTab({ loginId }) {
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
    totalAsset: STARTING_CASH,
    winRate: 0,
  });
  const [opponents, setOpponents] = useState([]);
  const [holdingQty, setHoldingQty] = useState(0);
  const [avgPrice, setAvgPrice] = useState(0);
  const [gameMessage, setGameMessage] = useState('15분 동안 더 많은 수익을 만들어 보세요!');
  const [inventory, setInventory] = useState([]);
  const [activeEffects, setActiveEffects] = useState([]);
  const [hintMessage, setHintMessage] = useState('');
  const [isTradeLocked, setIsTradeLocked] = useState(false);
  const [isItemPopupOpen, setIsItemPopupOpen] = useState(false);
  const [isServerDriven, setIsServerDriven] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [gameStockCode, setGameStockCode] = useState('');
  const [gameStockName, setGameStockName] = useState('');
  const [scenarioFrom, setScenarioFrom] = useState('');
  const [scenarioTo, setScenarioTo] = useState('');
  const [lookbackYears, setLookbackYears] = useState(1);
  const gameTimerRef = useRef(null);
  const marketTimerRef = useRef(null);
  const effectTimerRef = useRef(null);
  const [matchError, setMatchError] = useState('');
  const socketRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const introExitTimerRef = useRef(null);
  const transitionStartedRef = useRef(false);
  const socketUrls = useMemo(() => buildRealtimeSocketUrls(), []);

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

  function applyServerSnapshot(eventData) {
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
        totalAsset: Number(eventData.opponent.totalAsset ?? eventData.opponent.cash ?? current.totalAsset),
        winRate: Number(eventData.opponent.winRate ?? current.winRate),
      }));
    }
    if (Array.isArray(eventData.opponents)) {
      const normalizedOpponents = eventData.opponents
        .map((opponent) => ({
          loginId: String(opponent?.loginId ?? ''),
          nickname: String(opponent?.nickname ?? opponent?.loginId ?? '상대 플레이어'),
          rank: String(opponent?.rank ?? '브론즈'),
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
    if (Array.isArray(eventData.inventory)) {
      setInventory(eventData.inventory);
    }
    if (Array.isArray(eventData.activeEffects)) {
      setActiveEffects(eventData.activeEffects);
    }
    if (Array.isArray(eventData.news)) {
      setMarketData((current) => ({ ...current, news: eventData.news }));
    }

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
    setMarketData(generateMockMarket());
    setMarketIndex(0);
    setCash(STARTING_CASH);
    setOpponentCash(STARTING_CASH);
    setOpponents([]);
    setHoldingQty(0);
    setAvgPrice(0);
    setInventory([]);
    setActiveEffects([]);
    setHintMessage('');
    setGameMessage('15분 동안 더 많은 수익을 만들어 보세요!');
    setIsTradeLocked(false);
    setIsItemPopupOpen(false);
    setGameStockCode('PREVIEW');
    setGameStockName('미리보기 종목');
    transitionStartedRef.current = false;
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  }

  function enterInGameState() {
    setMatchMode('');
    setIsMatchmaking(false);
    setIsInGame(true);
    setGameFinished(false);
    setRemainingSeconds(MATCH_SECONDS);
    setMarketData(generateMockMarket());
    setMarketIndex(8);
    setCash(STARTING_CASH);
    setOpponentCash(STARTING_CASH);
    setOpponents([]);
    setHoldingQty(0);
    setAvgPrice(0);
    setInventory([]);
    setActiveEffects([]);
    setHintMessage('');
    setGameMessage('15분 동안 더 많은 수익을 만들어 보세요!');
    setIsTradeLocked(false);
    setIsItemPopupOpen(false);
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

    effectTimerRef.current = window.setInterval(() => {
      setActiveEffects((current) => current.filter((effect) => effect.expireAt > Date.now()));
    }, 500);

    return () => {
      window.clearInterval(gameTimerRef.current);
      window.clearInterval(marketTimerRef.current);
      window.clearInterval(effectTimerRef.current);
    };
  }, [isInGame, gameFinished, isServerDriven]);

  function finishGame() {
    setGameFinished(true);

    const currentPrice = marketData.points[marketIndex] ?? marketData.points[0];
    const liquidationValue = holdingQty * currentPrice;
    const finalCash = cash + liquidationValue;
    setCash(finalCash);
    setHoldingQty(0);
    setAvgPrice(0);

    const result = finalCash > opponentCash ? '승리' : finalCash < opponentCash ? '패배' : '무승부';
    setGameMessage(
      `제한시간 종료! 자동 매도 후 내 자금 ${formatCurrency(finalCash)} / 상대 자금 ${formatCurrency(opponentCash)} · ${result}`,
    );
  }

  function hasEffect(effectKey) {
    return activeEffects.some((effect) => effect.key === effectKey);
  }

  function getCurrentFeeRate() {
    return hasEffect('FEE_DISCOUNT') ? 0.0015 : 0.0035;
  }

  function handleBuy() {
    if (isTradeLocked || gameFinished) {
      return;
    }
    const qty = 1;

    if (isServerDriven) {
      const sent = sendSocketAction('BUY', { quantity: qty });
      if (!sent) {
        setGameMessage('서버에 매수 요청을 보내지 못했습니다.');
      }
      return;
    }

    const currentPrice = marketData.points[marketIndex] ?? 0;
    const feeRate = getCurrentFeeRate();
    const fee = Math.round(currentPrice * qty * feeRate);
    const totalCost = currentPrice * qty + fee;

    if (cash < totalCost) {
      setGameMessage('자금이 부족하여 매수할 수 없습니다.');
      return;
    }

    const nextQty = holdingQty + qty;
    const weighted = holdingQty * avgPrice + qty * currentPrice;
    setCash((current) => current - totalCost);
    setHoldingQty(nextQty);
    setAvgPrice(Math.round(weighted / nextQty));
    setGameMessage(`${qty}주 매수 완료. 수수료 ${formatCurrency(fee)}`);
  }

  function handleSell() {
    if (isTradeLocked || gameFinished) {
      return;
    }
    const qty = 1;

    if (isServerDriven) {
      const sent = sendSocketAction('SELL', { quantity: qty });
      if (!sent) {
        setGameMessage('서버에 매도 요청을 보내지 못했습니다.');
      }
      return;
    }

    if (holdingQty < qty) {
      setGameMessage('보유 수량보다 많이 매도할 수 없습니다.');
      return;
    }

    const currentPrice = marketData.points[marketIndex] ?? 0;
    const feeRate = getCurrentFeeRate();
    const gross = currentPrice * qty;
    const fee = Math.round(gross * feeRate);
    const net = gross - fee;
    const nextQty = holdingQty - qty;

    setCash((current) => current + net);
    setHoldingQty(nextQty);
    if (nextQty === 0) {
      setAvgPrice(0);
    }
    setGameMessage(`${qty}주 매도 완료. 수수료 ${formatCurrency(fee)}`);
  }

  function handleBuyItem(item) {
    if (isServerDriven) {
      const sent = sendSocketAction('ITEM_BUY', { itemKey: item.key });
      if (!sent) {
        setGameMessage('서버에 아이템 구매 요청을 보내지 못했습니다.');
      }
      return;
    }

    if (cash < item.price) {
      setGameMessage('아이템 구매 자금이 부족합니다.');
      return;
    }

    setCash((current) => current - item.price);
    setInventory((current) => [...current, item.key]);
    setGameMessage(`${item.name} 구매 완료`);
  }

  function handleUseItem(itemKey) {
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

    if (itemKey === 'SIGNAL_HINT') {
      const todayNews = marketData.news
        .filter((news) => news.day <= marketIndex)
        .slice(-1)[0];
      setHintMessage(todayNews ? `힌트: "${todayNews.title}" 흐름을 참고해 투자해 보세요.` : '힌트: 현재 관망 구간입니다.');
      setGameMessage('신호 힌트를 사용했습니다.');
      return;
    }

    const durationMs = 60000;
    setActiveEffects((current) => [
      ...current.filter((effect) => effect.key !== itemKey),
      { key: itemKey, expireAt: Date.now() + durationMs },
    ]);
    setGameMessage('아이템 효과가 60초 동안 적용됩니다.');
  }

  const currentPrice = marketData.points[marketIndex] ?? marketData.points[0];
  const totalAsset = cash + holdingQty * currentPrice;
  const pnl = holdingQty > 0 ? (currentPrice - avgPrice) * holdingQty : 0;
  const returnRate = holdingQty > 0 && avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;
  const itemButtonLabel = inventory.length > 0 ? `아이템 ${inventory.length}` : '아이템';
  const mm = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const ss = String(remainingSeconds % 60).padStart(2, '0');
  const currentRank = determineRankFromCash(totalAsset);
  const activeNews = marketData.news.filter((item) => item.day <= marketIndex).reverse();
  const gameChartPoints = useMemo(
    () =>
      marketData.points.map((value, index) => ({
        time: index + 1,
        value: Number(value),
      })),
    [marketData.points],
  );

  if (isInGame) {
    return (
      <section className={`stock-game-shell ${isDark ? 'dark' : ''}`}>
        <div className="stock-game-overlay" />
        <div className="stock-game-content ingame pvp-ingame">
          <header className="pvp-head">
            <h1>주식 게임</h1>
            <div className="pvp-timer">{`${mm}:${ss}`}</div>
          </header>

          <div className="pvp-summary">
            <article>
              <span>내 자금</span>
              <strong>{formatCurrency(cash)}</strong>
            </article>
            <article>
              <span>총 보유자산</span>
              <strong>{formatCurrency(totalAsset)}</strong>
            </article>
            <article>
              <span>상대 자금</span>
              <strong>{formatCurrency(opponentCash)}</strong>
            </article>
            <article>
              <span>현재 랭크</span>
              <strong>{currentRank}</strong>
            </article>
          </div>

          <section className="pvp-layout">
            <div className="pvp-left">
              <div className="pvp-card pvp-chart">
                <div className="pvp-card-head">
                  <h2>{`${gameStockName || '게임 종목'} (${gameStockCode || '-'})`}</h2>
                  <p>
                    {`${gameStockCode === 'FALLBACK' ? '테스트' : '실제'} ${lookbackYears}년 구간 · ${scenarioFrom || '-'} ~ ${scenarioTo || '-'} · 현재가 ${formatCurrency(currentPrice)}`}
                  </p>
                </div>
                <RealtimePriceChart
                  companyName={gameStockName || gameStockCode || '게임 종목'}
                  points={gameChartPoints}
                  currentPrice={currentPrice}
                  currentReturnRate={returnRate}
                  changeRate={0}
                  isLoading={false}
                  statusMessage={'과거 6개월 데이터를 15분 배속으로 재생 중입니다.'}
                  statusTone="info"
                  tradeFeedback={gameMessage}
                  onBuyClick={handleBuy}
                  onSellClick={handleSell}
                  onAuxClick={() => setIsItemPopupOpen(true)}
                  auxButtonLabel={itemButtonLabel}
                  disableBuy={isTradeLocked || gameFinished}
                  disableSell={isTradeLocked || gameFinished || holdingQty < 1}
                  disableAuxButton={gameFinished}
                  hideFooterText
                />
              </div>

            </div>

            <div className="pvp-right">
              <div className="pvp-card pvp-news">
                <div className="pvp-card-head">
                  <h2>시장 뉴스</h2>
                </div>
                <ul>
                  {activeNews.map((news) => (
                    <li key={`${news.day}-${news.title}`}>
                      <strong>{news.dateLabel}</strong>
                      <span>{news.title}</span>
                    </li>
                  ))}
                </ul>
                {hintMessage ? <p className="pvp-hint">{hintMessage}</p> : null}
              </div>

              <div className="pvp-card pvp-opponent">
                <div className="pvp-card-head">
                  <h2>상대 정보</h2>
                </div>
                <div className="pvp-opponent-body">
                  <p>{opponentProfile.nickname}</p>
                  <span>{`ID: ${opponentProfile.loginId}`}</span>
                  <strong>{opponentProfile.rank}</strong>
                  <em>{`보유자산 ${formatCurrency(opponentProfile.totalAsset || opponentCash)}`}</em>
                  <small>{`승률 ${Number.isFinite(opponentProfile.winRate) ? opponentProfile.winRate.toFixed(1) : '0.0'}%`}</small>
                  {opponents.length > 1 ? (
                    <small>{'참가자 ' + (opponents.length + 1) + '명'}</small>
                  ) : null}
                </div>
                {opponents.length > 1 ? (
                  <ul>
                    {opponents.map((opponent) => (
                      <li key={opponent.loginId}>
                        {opponent.nickname + ' · ' + formatCurrency(opponent.totalAsset)}
                      </li>
                    ))}
                  </ul>
                ) : null}
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
                <div className="pvp-item-list">
                  {ITEM_DEFINITIONS.map((item) => (
                    <article key={item.key}>
                      <strong>{item.name}</strong>
                      <p>{item.description}</p>
                      <em>{formatCurrency(item.price)}</em>
                      <div>
                        <button type="button" className="pvp-item-buy-btn" onClick={() => handleBuyItem(item)} disabled={isTradeLocked}>
                          구매
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUseItem(item.key)}
                          disabled={isTradeLocked || !inventory.includes(item.key)}
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
          <header className="stock-game-match-head">
            <h2>{matchMode} 랭크 매치</h2>
            <button type="button" onClick={closeModal} disabled={isMatchmaking}>
              뒤로
            </button>
          </header>

          <div className="stock-game-rank-summary">
            <p>{'현재 랭크: 브론즈'}</p>
            <p>{'현재 점수: 0점'}</p>
          </div>

          <div className="stock-game-rank-rule">
            <p>{'랭크 티어: 브론즈 / 실버 / 골드 / 플래티넘 / 다이아'}</p>
            <p>{'티어별 점수 기준: 200 / 400 / 600 / 800 / 1000'}</p>
            <p>{'기본 획득 점수: 15점'}</p>
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





