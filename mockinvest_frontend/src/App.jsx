import { useEffect, useMemo, useState } from 'react';
import RealtimePriceChart from './components/RealtimePriceChart';
import BoardTab from './components/BoardTab';
import MyPageTab from './components/MyPageTab';
import QuizTab from './components/QuizTab';
import MissionTab from './components/MissionTab';
import StockGameTab from './components/StockGameTab';
import { isMockApiEnabled, mockCredentials, mockRequestApi } from './mockApi';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://pbl2-a.onrender.com').replace(
  /\/$/,
  '',
);
const DEFAULT_MENU_PATH = '/trading';
const STOCK_TAB_PLACEHOLDERS = Array.from({ length: 40 }, (_, index) => ({
  id: `placeholder-${index + 1}`,
  stockCode: '',
  stockName: '',
  currentPrice: 0,
  changeRate: 0,
  lastUpdated: null,
  slot: index + 1,
  isPlaceholder: true,
}));

const sideMenu = [
  { label: '주식 트레이딩', path: '/trading' },
  { label: '마이페이지', path: '/mypage' },
  { label: '주식 게임', path: '/stock-game' },
  { label: '퀴즈', path: '/quiz' },
  { label: '게시판', path: '/board' },
  { label: '미션', path: '/tutorial' },
];

function normalizeMenuPath(pathname) {
  if (!pathname || pathname === '/') {
    return DEFAULT_MENU_PATH;
  }

  const matchedMenu = sideMenu.find((item) => pathname === item.path);
  return matchedMenu?.path || DEFAULT_MENU_PATH;
}

function buildApiUrl(path) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

async function readResponsePayload(response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

async function requestApi(path, { method = 'GET', body, signal } = {}) {
  if (isMockApiEnabled) {
    return mockRequestApi(path, { method, body, signal });
  }

  let response;

  try {
    response = await fetch(buildApiUrl(path), {
      method,
      signal,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw error;
    }

    throw new Error('서버에 연결하지 못했습니다.');
  }

  const payload = await readResponsePayload(response);

  if (!response.ok) {
    const message =
      typeof payload === 'string'
        ? payload
        : payload?.message || payload?.error || '요청 처리 중 오류가 발생했습니다.';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload;
}

function normalizeTimestamp(value) {
  if (typeof value === 'number') {
    return value > 9999999999 ? Math.floor(value / 1000) : value;
  }

  if (typeof value === 'string') {
    const numericValue = Number(value);

    if (!Number.isNaN(numericValue)) {
      return normalizeTimestamp(numericValue);
    }

    const dateValue = new Date(value).getTime();
    return Number.isNaN(dateValue) ? null : Math.floor(dateValue / 1000);
  }

  return null;
}

function normalizeStock(rawStock, index) {
  return {
    id: rawStock.id ?? `${rawStock.stockCode ?? 'STOCK'}-${index}`,
    stockCode: String(rawStock.stockCode ?? '').trim(),
    stockName: String(rawStock.stockName ?? '').trim() || `종목 ${index + 1}`,
    currentPrice: Number(rawStock.currentPrice ?? 0),
    changeRate: Number(rawStock.changeRate ?? 0),
    lastUpdated: rawStock.lastUpdated || null,
  };
}

function normalizeHolding(rawHolding) {
  return {
    id: rawHolding.id ?? `${rawHolding.stockCode}-${rawHolding.loginId}`,
    loginId: rawHolding.loginId ?? '',
    stockCode: String(rawHolding.stockCode ?? '').trim(),
    stockName: String(rawHolding.stockName ?? '').trim(),
    quantity: Number(rawHolding.quantity ?? 0),
    averagePrice: Number(rawHolding.averagePrice ?? 0),
  };
}

function normalizeComment(rawComment, index) {
  return {
    id: rawComment.commentId ?? rawComment.id ?? `comment-${index}`,
    content: String(rawComment.content ?? '').trim(),
    author: String(rawComment.author ?? rawComment.loginId ?? '익명'),
    createdAt: rawComment.createdAt ?? rawComment.createdDate ?? rawComment.updatedAt ?? null,
  };
}

function normalizePostSummary(rawPost, index) {
  const postId = rawPost.postId ?? rawPost.id ?? `post-${index}`;
  const likedUsers = Array.isArray(rawPost.likedUsers) ? rawPost.likedUsers : [];
  const comments = Array.isArray(rawPost.comments) ? rawPost.comments : [];

  return {
    postId: String(postId),
    title: String(rawPost.title ?? '').trim() || `게시글 ${index + 1}`,
    author: String(rawPost.author ?? rawPost.loginId ?? '익명'),
    content: String(rawPost.content ?? '').trim(),
    stockCode: String(rawPost.stockCode ?? '').trim(),
    stockName: String(rawPost.stockName ?? '').trim(),
    position: String(rawPost.position ?? '').trim(),
    yield: Number(rawPost.yield ?? 0),
    viewCount: Number(rawPost.viewCount ?? 0),
    likedUsers,
    likeCount: Number(rawPost.likeCount ?? likedUsers.length ?? 0),
    commentCount: Number(rawPost.commentCount ?? comments.length ?? 0),
    comments: comments.map(normalizeComment),
    createdAt: rawPost.createdAt ?? rawPost.createdDate ?? rawPost.updatedAt ?? null,
  };
}

function normalizePostDetail(rawPost) {
  const summary = normalizePostSummary(rawPost, 0);

  return {
    ...summary,
    comments: Array.isArray(rawPost.comments) ? rawPost.comments.map(normalizeComment) : [],
    likedUsers: Array.isArray(rawPost.likedUsers) ? rawPost.likedUsers : [],
    content: String(rawPost.content ?? '').trim(),
    likeCount: Number(rawPost.likeCount ?? (Array.isArray(rawPost.likedUsers) ? rawPost.likedUsers.length : 0)),
    commentCount: Number(rawPost.commentCount ?? (Array.isArray(rawPost.comments) ? rawPost.comments.length : 0)),
  };
}

async function fetchStocks(signal) {
  const payload = await requestApi('/stocks', { signal });
  return Array.isArray(payload) ? payload.map(normalizeStock) : [];
}

async function fetchHoldings(loginId, signal) {
  const payload = await requestApi(`/trade/my/${encodeURIComponent(loginId)}`, { signal });
  return Array.isArray(payload) ? payload.map(normalizeHolding) : [];
}

async function submitTrade({ mode, loginId, stockCode, quantity, signal }) {
  return requestApi(`/trade/${mode}`, {
    method: 'POST',
    signal,
    body: {
      loginId,
      stockCode,
      quantity,
    },
  });
}

async function fetchPosts(signal) {
  const payload = await requestApi('/posts', { signal });
  return Array.isArray(payload) ? payload.map(normalizePostSummary) : [];
}

async function fetchPostDetail(postId, signal) {
  const payload = await requestApi(`/posts/${encodeURIComponent(postId)}`, { signal });
  return normalizePostDetail(payload);
}

async function createPost({ title, content, author, stockCode, stockName, position, yield: yieldRate, signal }) {
  return requestApi('/posts', {
    method: 'POST',
    signal,
    body: { title, content, author, stockCode, stockName, position, yield: yieldRate },
  });
}

async function togglePostLike({ postId, loginId, signal }) {
  return requestApi(`/posts/${encodeURIComponent(postId)}/like`, {
    method: 'POST',
    signal,
    body: { loginId },
  });
}

async function createComment({ postId, content, author, signal }) {
  return requestApi(`/posts/${encodeURIComponent(postId)}/comments`, {
    method: 'POST',
    signal,
    body: { content, author },
  });
}

async function fetchQuizzes(signal, quizType) {
  const normalizedType = String(quizType ?? '').trim();
  const encodedType = encodeURIComponent(normalizedType);
  const endpointCandidates = normalizedType
    ? [
        `/quizzes?type=${encodedType}`,
        `/quizzes?quizType=${encodedType}`,
        `/quizzes?category=${encodedType}`,
        `/quiz?type=${encodedType}`,
        `/quiz/list?type=${encodedType}`,
        `/quizzes/${encodedType}`,
        `/quiz/${encodedType}`,
      ]
    : ['/quizzes', '/quiz', '/quiz/list'];
  let latestError;

  for (const endpoint of endpointCandidates) {
    try {
      const payload = await requestApi(endpoint, { signal });
      if (Array.isArray(payload)) {
        return payload;
      }

      const nestedList =
        (Array.isArray(payload?.quizzes) && payload.quizzes) ||
        (Array.isArray(payload?.quizList) && payload.quizList) ||
        (Array.isArray(payload?.items) && payload.items) ||
        (Array.isArray(payload?.data) && payload.data);

      if (nestedList) {
        return nestedList;
      }
    } catch (error) {
      latestError = error;
    }
  }

  throw latestError || new Error('퀴즈를 불러오지 못했습니다.');
}

async function registerUser({ loginId, password, nickname, signal }) {
  return requestApi('/user/register', {
    method: 'POST',
    signal,
    body: { loginId, password, nickname },
  });
}

async function loginUser({ loginId, password, signal }) {
  return requestApi('/user/login', {
    method: 'POST',
    signal,
    body: { loginId, password },
  });
}

async function fetchCurrentUser(signal) {
  return requestApi('/user/me', { signal });
}

async function logoutUser(signal) {
  return requestApi('/user/logout', {
    method: 'POST',
    signal,
  });
}

async function completeMission(loginId, missionType, signal) {
  const bodyCandidates = [
    { loginId, missionType },
    { loginId, type: missionType },
    { loginId, mission_type: missionType },
  ];

  let latestError;
  for (const body of bodyCandidates) {
    try {
      return await requestApi('/missions/complete', { method: 'POST', body, signal });
    } catch (error) {
      latestError = error;
    }
  }

  try {
    return await requestApi(`/missions/complete?missionType=${encodeURIComponent(missionType)}`, {
      method: 'POST',
      signal,
    });
  } catch (error) {
    throw latestError || error;
  }
}

async function claimMission(loginId, missionType, signal) {
  const bodyCandidates = [
    { loginId, missionType },
    { loginId, type: missionType },
    { loginId, mission_type: missionType },
  ];

  let latestError;
  for (const body of bodyCandidates) {
    try {
      return await requestApi('/missions/claim', { method: 'POST', body, signal });
    } catch (error) {
      latestError = error;
    }
  }

  try {
    return await requestApi(`/missions/claim?missionType=${encodeURIComponent(missionType)}`, {
      method: 'POST',
      signal,
    });
  } catch (error) {
    throw latestError || error;
  }
}

function mergePriceHistory(previousHistory, stocks) {
  const nextHistory = { ...previousHistory };

  for (const stock of stocks) {
    const time = normalizeTimestamp(stock.lastUpdated) ?? Math.floor(Date.now() / 1000);
    const nextPoint = { time, value: stock.currentPrice };
    const currentPoints = nextHistory[stock.stockCode] ?? [];
    const lastPoint = currentPoints[currentPoints.length - 1];

    if (!lastPoint || lastPoint.time !== nextPoint.time || lastPoint.value !== nextPoint.value) {
      nextHistory[stock.stockCode] = [...currentPoints, nextPoint].slice(-120);
    }
  }

  return nextHistory;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatShares(value) {
  return `${new Intl.NumberFormat('ko-KR').format(value)}주`;
}

function pushMenuState(path) {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.location.pathname !== path) {
    window.history.pushState({}, '', path);
  }
}

function HoldingsDialog({ holdings, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="trade-modal holdings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="holdings-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="trade-modal-head">
          <div>
            <p className="trade-modal-eyebrow">보유 종목</p>
            <h3 id="holdings-modal-title">내 보유 주식</h3>
          </div>
          <button type="button" className="trade-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="holdings-list">
          {holdings.length ? (
            holdings.map((holding) => (
              <div key={holding.code} className="holding-row">
                <div>
                  <strong>{holding.name}</strong>
                  <span>{holding.code}</span>
                </div>
                <em>{formatShares(holding.quantity)}</em>
              </div>
            ))
          ) : (
            <p className="holding-empty">현재 보유 중인 주식이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function TradeDialog({
  mode,
  quantity,
  currentPrice,
  companyName,
  onQuantityChange,
  onClose,
  onConfirm,
  maxQuantity,
  isSubmitting,
}) {
  const title = mode === 'buy' ? '매수' : '매도';
  const estimatedAmount = Math.max(0, quantity) * currentPrice;
  const quantityInputProps = typeof maxQuantity === 'number' ? { max: Math.max(1, maxQuantity) } : {};

  return (
    <div className="modal-backdrop" role="presentation" onClick={isSubmitting ? undefined : onClose}>
      <div
        className="trade-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="trade-modal-head">
          <div>
            <p className="trade-modal-eyebrow">{companyName}</p>
            <h3 id="trade-modal-title">{title} 주문</h3>
          </div>
          <button type="button" className="trade-close" onClick={onClose} disabled={isSubmitting}>
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
              <button
                type="button"
                onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                disabled={isSubmitting}
              >
                -
              </button>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(event) => onQuantityChange(Number(event.target.value))}
                disabled={isSubmitting}
                {...quantityInputProps}
              />
              <button type="button" onClick={() => onQuantityChange(quantity + 1)} disabled={isSubmitting}>
                +
              </button>
            </div>
          </label>

          <div className="trade-summary">
            <span>{'예상 '}{mode === 'buy' ? '매수 금액' : '매도 금액'}</span>
            <strong>{formatCurrency(estimatedAmount)}</strong>
          </div>

          <p className="trade-limit">
            {mode === 'buy'
              ? '매수 가능 수량은 현재 입력 가격과 잔고 기준으로 계산됩니다.'
              : '현재 보유 수량 기준으로 매도가 진행됩니다.'}
          </p>
        </div>

        <div className="trade-modal-actions">
          <button type="button" className="secondary" onClick={onClose} disabled={isSubmitting}>
            취소
          </button>
          <button
            type="button"
            className={mode === 'buy' ? 'primary buy' : 'primary sell'}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? '처리 중...' : title + ' 확정'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyTabPanel() {
  return <section className="empty-tab-panel" aria-hidden="true" />;
}

function AuthScreen({
  mode,
  form,
  errorMessage,
  helperMessage,
  isSubmitting,
  onModeChange,
  onFormChange,
  onSubmit,
}) {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-mode-tabs" role="tablist" aria-label="인증 모드">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => onModeChange('login')}>
            로그인
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => onModeChange('register')}
          >
            회원가입
          </button>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          {mode === 'register' ? (
            <label className="auth-field">
              <span>닉네임</span>
              <input
                type="text"
                name="nickname"
                autoComplete="nickname"
                value={form.nickname ?? ''}
                onChange={onFormChange}
                disabled={isSubmitting}
                placeholder="닉네임을 입력하세요"
              />
            </label>
          ) : null}

          <label className="auth-field">
            <span>아이디</span>
            <input
              type="text"
              name="loginId"
              autoComplete="username"
              value={form.loginId}
              onChange={onFormChange}
              disabled={isSubmitting}
              placeholder="아이디를 입력하세요"
            />
          </label>

          <label className="auth-field">
            <span>비밀번호</span>
            <input
              type="password"
              name="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={form.password}
              onChange={onFormChange}
              disabled={isSubmitting}
              placeholder="비밀번호를 입력하세요"
            />
          </label>

          {errorMessage ? <p className="auth-feedback error">{errorMessage}</p> : null}
          {!errorMessage && helperMessage ? <p className="auth-feedback">{helperMessage}</p> : null}

          <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
            {isSubmitting ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>
      </section>
    </main>
  );
}

function App() {
  const [activeMenuPath, setActiveMenuPath] = useState(() => normalizeMenuPath(window.location.pathname));
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ nickname: '', loginId: '', password: '' });
  const [authUser, setAuthUser] = useState(null);
  const [authErrorMessage, setAuthErrorMessage] = useState('');
  const [authHelperMessage, setAuthHelperMessage] = useState(() =>
    isMockApiEnabled
      ? `개발용 Mock 모드입니다. 기본 계정: ${mockCredentials.loginId} / ${mockCredentials.password}`
      : '',
  );
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [stocks, setStocks] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [priceHistory, setPriceHistory] = useState({});
  const [selectedStockCode, setSelectedStockCode] = useState('');
  const [isLoadingStocks, setIsLoadingStocks] = useState(true);
  const [isLoadingHoldings, setIsLoadingHoldings] = useState(true);
  const [chartStatusMessage, setChartStatusMessage] = useState('');
  const [chartStatusTone, setChartStatusTone] = useState('info');
  const [tradeDialog, setTradeDialog] = useState(null);
  const [tradeQuantity, setTradeQuantity] = useState(1);
  const [tradeFeedback, setTradeFeedback] = useState('');
  const [isHoldingsDialogOpen, setIsHoldingsDialogOpen] = useState(false);
  const [isSubmittingTrade, setIsSubmittingTrade] = useState(false);
  const loginId = authUser?.loginId ?? '';
  const isAuthenticated = Boolean(authUser?.loginId);

  const stockMap = useMemo(() => Object.fromEntries(stocks.map((stock) => [stock.stockCode, stock])), [stocks]);
  const displayedStocks = stocks.length
    ? stocks.map((stock, index) => ({ ...stock, slot: index + 1, isPlaceholder: false }))
    : STOCK_TAB_PLACEHOLDERS;

  const selectedStock = stocks.find((stock) => stock.stockCode === selectedStockCode) ?? stocks[0] ?? null;
  const chartPoints = selectedStock ? priceHistory[selectedStock.stockCode] ?? [] : [];
  const currentPrice = selectedStock?.currentPrice ?? 0;

  const portfolio = useMemo(() => {
    let totalAssets = 0;
    let ownedShares = 0;
    let investedAmount = 0;
    let profitLoss = 0;

    for (const holding of holdings) {
      const stock = stockMap[holding.stockCode];
      const marketPrice = stock?.currentPrice ?? holding.averagePrice;
      const positionValue = marketPrice * holding.quantity;
      const costBasis = holding.averagePrice * holding.quantity;

      totalAssets += positionValue;
      investedAmount += costBasis;
      ownedShares += holding.quantity;
      profitLoss += positionValue - costBasis;
    }

    return {
      totalAssets,
      ownedShares,
      profitLoss,
      profitLossRate: investedAmount > 0 ? (profitLoss / investedAmount) * 100 : 0,
    };
  }, [holdings, stockMap]);

  const selectedOwnedShares =
    holdings.find((holding) => holding.stockCode === selectedStock?.stockCode)?.quantity ?? 0;

  const holdingsList = useMemo(
    () =>
      holdings
        .filter((holding) => holding.quantity > 0)
        .map((holding) => ({
          code: holding.stockCode,
          name: holding.stockName || stockMap[holding.stockCode]?.stockName || holding.stockCode,
          quantity: holding.quantity,
        })),
    [holdings, stockMap],
  );

  const boardHoldingOptions = useMemo(
    () =>
      holdings
        .filter((holding) => holding.quantity > 0)
        .map((holding) => {
          const stock = stockMap[holding.stockCode];
          const currentMarketPrice = stock?.currentPrice ?? holding.averagePrice;
          const yieldRate =
            holding.averagePrice > 0 ? ((currentMarketPrice - holding.averagePrice) / holding.averagePrice) * 100 : 0;

          return {
            stockCode: holding.stockCode,
            stockName: holding.stockName || stock?.stockName || holding.stockCode,
            quantity: holding.quantity,
            averagePrice: holding.averagePrice,
            currentPrice: currentMarketPrice,
            yieldRate,
          };
        }),
    [holdings, stockMap],
  );

  const isLoadingPortfolio = isLoadingStocks || isLoadingHoldings;

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function restoreSession() {
      setIsCheckingAuth(true);
      setAuthErrorMessage('');

      try {
        const user = await fetchCurrentUser(controller.signal);

        if (!isMounted) {
          return;
        }

        setAuthUser(user);
        setAuthForm({ loginId: String(user?.loginId ?? ''), password: '' });
        setAuthHelperMessage('');
      } catch (error) {
        if (!isMounted || error.name === 'AbortError') {
          return;
        }

        if (error.status !== 401) {
          setAuthErrorMessage(error.message || '로그인 상태를 확인하지 못했습니다.');
        }

        setAuthUser(null);
      } finally {
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setActiveMenuPath(normalizeMenuPath(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!selectedStockCode && stocks.length > 0) {
      setSelectedStockCode(stocks[0].stockCode);
      return;
    }

    if (selectedStockCode && stocks.length > 0 && !stocks.some((stock) => stock.stockCode === selectedStockCode)) {
      setSelectedStockCode(stocks[0].stockCode);
    }
  }, [selectedStockCode, stocks]);

  useEffect(() => {
    if (!isAuthenticated) {
      setHoldings([]);
      setIsLoadingHoldings(false);
      return undefined;
    }

    const controller = new AbortController();
    let isMounted = true;

    async function loadHoldingsData() {
      setIsLoadingHoldings(true);

      try {
        const nextHoldings = await fetchHoldings(loginId, controller.signal);

        if (isMounted) {
          setHoldings(nextHoldings);
        }
      } catch (error) {
        if (isMounted && error.name !== 'AbortError') {
          console.error(error);
          if (error.status === 401) {
            setAuthUser(null);
          }
          setTradeFeedback(error.message || '보유 주식 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingHoldings(false);
        }
      }
    }

    loadHoldingsData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [loginId]);

  useEffect(() => {
    if (!isAuthenticated) {
      setStocks([]);
      setPriceHistory({});
      setSelectedStockCode('');
      setChartStatusMessage('');
      setChartStatusTone('info');
      setIsLoadingStocks(false);
      return undefined;
    }

    const controller = new AbortController();
    let isMounted = true;
    let pollingId;

    async function loadStocksData(showSkeleton = false) {
      if (showSkeleton && isMounted) {
        setIsLoadingStocks(true);
      }

      try {
        const nextStocks = await fetchStocks(controller.signal);

        if (!isMounted) {
          return;
        }

        setStocks(nextStocks);
        setPriceHistory((currentHistory) => mergePriceHistory(currentHistory, nextStocks));
        setChartStatusMessage('30초 주기로 실시간 시세를 동기화하고 있습니다.');
        setChartStatusTone('info');
      } catch (error) {
        if (isMounted && error.name !== 'AbortError') {
          console.error(error);
          if (error.status === 401) {
            setAuthUser(null);
          }
          setChartStatusMessage(error.message || '주식 시세를 불러오지 못했습니다.');
          setChartStatusTone('error');
        }
      } finally {
        if (isMounted) {
          setIsLoadingStocks(false);
        }
      }
    }

    loadStocksData(true);
    pollingId = window.setInterval(() => {
      loadStocksData(false);
    }, 30000);

    return () => {
      isMounted = false;
      controller.abort();
      window.clearInterval(pollingId);
    };
  }, [isAuthenticated]);

  function handleAuthFormChange(event) {
    const { name, value } = event.target;
    setAuthForm((current) => ({ ...current, [name]: value }));
  }

  function handleAuthModeChange(nextMode) {
    setAuthMode(nextMode);
    setAuthErrorMessage('');
    setAuthHelperMessage('');
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();

    const nextNickname = authForm.nickname.trim();
    const nextLoginId = authForm.loginId.trim();
    const nextPassword = authForm.password.trim();

    if (!nextLoginId || !nextPassword) {
      setAuthErrorMessage('아이디와 비밀번호를 모두 입력해 주세요.');
      return;
    }
    if (authMode === 'register' && !nextNickname) {
      setAuthErrorMessage('회원가입 시 닉네임을 입력해 주세요.');
      return;
    }

    setIsSubmittingAuth(true);
    setAuthErrorMessage('');
    setAuthHelperMessage('');

    try {
      if (authMode === 'register') {
        await registerUser({ loginId: nextLoginId, password: nextPassword, nickname: nextNickname });
        setAuthHelperMessage('회원가입이 완료되었습니다. 같은 정보로 로그인합니다.');
      }

      const user = await loginUser({ loginId: nextLoginId, password: nextPassword });
      setAuthUser(user);
      setAuthForm({ nickname: '', loginId: nextLoginId, password: '' });
      setActiveMenuPath(DEFAULT_MENU_PATH);
      pushMenuState(DEFAULT_MENU_PATH);
    } catch (error) {
      setAuthErrorMessage(error.message || '인증 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  async function handleLogout() {
    setTradeDialog(null);
    setIsSubmittingTrade(false);

    try {
      await logoutUser();
    } catch (error) {
      if (error.status !== 401) {
        console.error(error);
      }
    } finally {
      setAuthUser(null);
      setAuthMode('login');
      setAuthForm((current) => ({ ...current, password: '' }));
      setAuthHelperMessage('로그아웃되었습니다.');
      setAuthErrorMessage('');
      setActiveMenuPath(DEFAULT_MENU_PATH);
      pushMenuState(DEFAULT_MENU_PATH);
    }
  }

  function handleMenuSelect(path) {
    if (path === '/logout') {
      handleLogout();
      return;
    }

    setActiveMenuPath(path);
    pushMenuState(path);
  }

  function openTradeDialog(mode) {
    if (!selectedStock) {
      return;
    }

    setTradeFeedback('');
    setTradeDialog(mode);
    setTradeQuantity(1);
  }

  function closeTradeDialog() {
    if (isSubmittingTrade) {
      return;
    }

    setTradeDialog(null);
    setTradeQuantity(1);
  }

  function handleTradeQuantityChange(value) {
    if (!Number.isFinite(value)) {
      setTradeQuantity(1);
      return;
    }

    const nextQuantity = Math.max(1, Math.floor(value));

    if (tradeDialog === 'sell') {
      setTradeQuantity(Math.min(nextQuantity, Math.max(1, selectedOwnedShares)));
      return;
    }

    setTradeQuantity(nextQuantity);
  }

  async function handleConfirmTrade() {
    if (!tradeDialog || !selectedStock || currentPrice <= 0) {
      return;
    }

    if (tradeDialog === 'sell' && tradeQuantity > selectedOwnedShares) {
      setTradeFeedback('보유 수량보다 많이 매도할 수 없습니다.');
      return;
    }

    setIsSubmittingTrade(true);
    setTradeFeedback('');

    try {
      const responseMessage = await submitTrade({
        mode: tradeDialog,
        loginId,
        stockCode: selectedStock.stockCode,
        quantity: tradeQuantity,
      });

      const nextHoldings = await fetchHoldings(loginId);
      setHoldings(nextHoldings);
      setTradeFeedback(
        typeof responseMessage === 'string'
          ? responseMessage
          : `${selectedStock.stockName} ${formatShares(tradeQuantity)} ${tradeDialog === 'buy' ? '매수' : '매도'}가 완료되었습니다.`,
      );
      setTradeDialog(null);
      setTradeQuantity(1);
    } catch (error) {
      console.error(error);
      if (error.status === 401) {
        setAuthUser(null);
      }
      setTradeFeedback(error.message || '주문 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingTrade(false);
    }
  }

  const summaryCards = useMemo(
    () => [
      {
        label: '보유 평가 금액',
        value: isLoadingPortfolio ? '불러오는 중...' : formatCurrency(portfolio.totalAssets),
        tone: 'neutral',
      },
      {
        label: '보유 종목',
        value: isLoadingPortfolio ? '불러오는 중...' : '보유 종목 보기',
        sub: isLoadingPortfolio ? '' : `${formatShares(portfolio.ownedShares)} 보유`,
        tone: 'neutral',
      },
      {
        label: '평가 손익',
        value: isLoadingPortfolio ? '불러오는 중...' : formatCurrency(portfolio.profitLoss),
        sub: isLoadingPortfolio
          ? ''
          : `${portfolio.profitLossRate >= 0 ? '+' : ''}${portfolio.profitLossRate.toFixed(2)}%`,
        tone: portfolio.profitLoss >= 0 ? 'up' : 'down',
      },
    ],
    [isLoadingPortfolio, portfolio],
  );

  if (isCheckingAuth) {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-card-status">
          <p className="auth-eyebrow">SESSION LOGIN</p>
          <h1>로그인 상태를 확인하는 중입니다</h1>
          <p className="auth-description">서버 세션과 사용자 정보를 확인한 뒤 화면을 불러옵니다.</p>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthScreen
        mode={authMode}
        form={authForm}
        errorMessage={authErrorMessage}
        helperMessage={authHelperMessage}
        isSubmitting={isSubmittingAuth}
        onModeChange={handleAuthModeChange}
        onFormChange={handleAuthFormChange}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  function renderTradingTab() {
    return (
      <>
        <header className="hero">
          <div>
            <p className="eyebrow">초보자도 쉽고 빠르게 익히는 모의 투자 경험</p>
            <h1>주식 모의투자 트레이딩</h1>
          </div>
        </header>

        <div className="symbol-tabs" role="tablist" aria-label="종목 선택">
          {displayedStocks.map((stock, index) => (
            <button
              key={stock.id}
              className={selectedStock?.stockCode === stock.stockCode ? 'active' : ''}
              type="button"
              onClick={() => {
                if (!stock.isPlaceholder) {
                  setSelectedStockCode(stock.stockCode);
                }
              }}
              disabled={stock.isPlaceholder}
            >
              <span className="symbol-slot-number">{String(stock.slot ?? index + 1).padStart(2, '0')}</span>
              <span className="symbol-slot-label">
                {stock.stockName || (isLoadingStocks ? '불러오는 중' : '대기 중')}
              </span>
            </button>
          ))}
        </div>

        <div className="summary-grid">
          {summaryCards.map((card) => (
            <article
              key={card.label}
              className={card.label === '보유 종목' ? 'summary-card clickable' : 'summary-card'}
              onClick={card.label === '보유 종목' ? () => setIsHoldingsDialogOpen(true) : undefined}
              role={card.label === '보유 종목' ? 'button' : undefined}
              tabIndex={card.label === '보유 종목' ? 0 : undefined}
              onKeyDown={
                card.label === '보유 종목'
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setIsHoldingsDialogOpen(true);
                      }
                    }
                  : undefined
              }
            >
              <div className="card-top">
                <span>{card.label}</span>
                <span className="card-dot" />
              </div>
              <strong className={card.tone}>{card.value}</strong>
              {card.sub ? <em className={card.tone}>{card.sub}</em> : null}
            </article>
          ))}
        </div>

        <RealtimePriceChart
          companyName={selectedStock?.stockName ?? '종목 선택'}
          points={chartPoints}
          currentPrice={currentPrice}
          changeRate={selectedStock?.changeRate ?? 0}
          isLoading={isLoadingStocks}
          statusMessage={chartStatusMessage}
          statusTone={chartStatusTone}
          tradeFeedback={tradeFeedback}
          onBuyClick={() => openTradeDialog('buy')}
          onSellClick={() => openTradeDialog('sell')}
          disableBuy={isLoadingStocks || !selectedStock || currentPrice <= 0 || isSubmittingTrade}
          disableSell={
            isLoadingStocks ||
            !selectedStock ||
            currentPrice <= 0 ||
            selectedOwnedShares < 1 ||
            isSubmittingTrade
          }
        />
      </>
    );
  }

  function renderMainCardContent() {
    switch (activeMenuPath) {
      case '/trading':
        return renderTradingTab();
      case '/board':
        return (
          <BoardTab
            loginId={loginId}
            holdings={boardHoldingOptions}
            fetchPosts={fetchPosts}
            fetchPostDetail={fetchPostDetail}
            createPost={createPost}
            togglePostLike={togglePostLike}
            createComment={createComment}
          />
        );
      case '/mypage':
        return <MyPageTab apiBaseUrl={API_BASE_URL} loginId={loginId} />;
      case '/stock-game':
        return <StockGameTab loginId={loginId} initialRankScore={Number(authUser?.rankScore ?? 0)} />;
      case '/quiz':
        return (
          <QuizTab
            fetchQuizzes={fetchQuizzes}
            completeMission={(missionType, signal) => completeMission(loginId, missionType, signal)}
          />
        );
      case '/tutorial':
        return (
          <MissionTab
            fetchMissions={(signal) => requestApi(`/missions/${encodeURIComponent(loginId)}`, { signal })}
            completeMission={(missionType, signal) => completeMission(loginId, missionType, signal)}
            claimMission={(missionType, signal) => claimMission(loginId, missionType, signal)}
          />
        );
      default:
        return renderTradingTab();
    }
  }

  return (
    <main className="app-shell">
      <section className="dashboard">{renderMainCardContent()}</section>

      <aside className="sidebar">
        <div className="sidebar-inner">
          <span className="menu-title">메뉴</span>
          <nav>
            {sideMenu.map((item) => (
              <button
                key={item.path}
                className={['menu-item', activeMenuPath === item.path ? 'active' : ''].filter(Boolean).join(' ')}
                type="button"
                onClick={() => handleMenuSelect(item.path)}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button type="button" className="logout-button" onClick={() => handleMenuSelect('/logout')}>
              로그아웃
            </button>
          </div>
        </div>
      </aside>

      {tradeDialog ? (
        <TradeDialog
          mode={tradeDialog}
          quantity={tradeQuantity}
          currentPrice={currentPrice}
          companyName={selectedStock?.stockName ?? ''}
          maxQuantity={tradeDialog === 'sell' ? selectedOwnedShares : undefined}
          isSubmitting={isSubmittingTrade}
          onQuantityChange={handleTradeQuantityChange}
          onClose={closeTradeDialog}
          onConfirm={handleConfirmTrade}
        />
      ) : null}

      {isHoldingsDialogOpen ? (
        <HoldingsDialog holdings={holdingsList} onClose={() => setIsHoldingsDialogOpen(false)} />
      ) : null}
    </main>
  );
}

export default App;
