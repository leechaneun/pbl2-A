import { useEffect, useMemo, useState } from 'react';
import './MyPageTab.css';

function buildApiUrl(baseUrl, path) {
  const normalizedBase = (baseUrl || '').replace(/\/$/, '');
  return `${normalizedBase}${path.startsWith('/') ? path : `/${path}`}`;
}

async function readResponsePayload(response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

async function fetchMyPageDashboard(apiBaseUrl, signal) {
  let response;

  try {
    response = await fetch(buildApiUrl(apiBaseUrl, '/mypage'), {
      method: 'GET',
      signal,
      credentials: 'include',
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw error;
    }

    throw new Error('마이페이지 정보를 불러오기 위해 서버에 연결하지 못했습니다.');
  }

  const payload = await readResponsePayload(response);

  if (!response.ok) {
    const message =
      typeof payload === 'string'
        ? payload
        : payload?.message || payload?.error || '마이페이지 정보를 불러오지 못했습니다.';
    throw new Error(message);
  }

  return payload;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function formatSignedPercent(value) {
  const numericValue = Number(value ?? 0);
  return `${numericValue > 0 ? '+' : ''}${numericValue.toFixed(2)}%`;
}

function formatDate(value) {
  if (!value) {
    return '-';}
    return String(value);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function normalizeStock(stock, index) {
  return {
    id: stock.id ?? `${stock.stockCode ?? 'stock'}-${index}`,
    stockCode: String(stock.stockCode ?? '').trim(),
    stockName: String(stock.stockName ?? '').trim() || `보유 종목 ${index + 1}`,
    quantity: Number(stock.quantity ?? 0),
    averagePrice: Number(stock.averagePrice ?? 0),
    currentPrice: Number(stock.currentPrice ?? 0),
    evaluationValue: Number(stock.evaluationValue ?? 0),
    yield: Number(stock.yield ?? 0),
  };
}

function normalizePost(post, index) {
  const likedUsers = Array.isArray(post.likedUsers) ? post.likedUsers : [];
  const comments = Array.isArray(post.comments) ? post.comments : [];

  return {
    postId: String(post.postId ?? post.id ?? `post-${index}`),
    title: String(post.title ?? '').trim() || `게시글 ${index + 1}`,
    content: String(post.content ?? '').trim(),
    author: String(post.author ?? '').trim() || '익명',
    viewCount: Number(post.viewCount ?? 0),
    likeCount: Number(post.likeCount ?? likedUsers.length),
    commentCount: Number(post.commentCount ?? comments.length),
    createdAt: post.createdAt ?? post.createdDate ?? post.updatedAt ?? null,
  };
}

function getAttendanceStorageKey(loginId) {
  return `mission-attendance-claimed:${String(loginId ?? 'guest').trim() || 'guest'}`;
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readAttendanceClaimed(loginId) {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(getAttendanceStorageKey(loginId)) === getTodayKey();
  } catch (_error) {
    return false;
  }
}

function normalizeMissionStatus(missionStatus, loginId) {
  const rawMission = missionStatus && typeof missionStatus === 'object' ? missionStatus : {};
  const attendanceClaimed = readAttendanceClaimed(loginId);

  return {
    attendanceCompleted: true,
    attendanceClaimed,
    buyCompleted: Boolean(rawMission.buyCompleted),
    buyClaimed: Boolean(rawMission.buyClaimed),
    sellCompleted: Boolean(rawMission.sellCompleted),
    sellClaimed: Boolean(rawMission.sellClaimed),
    quizCompleted: Boolean(rawMission.quizCompleted),
    quizClaimed: Boolean(rawMission.quizClaimed),
    likeCompleted: Boolean(rawMission.likeCompleted),
    likeClaimed: Boolean(rawMission.likeClaimed),
    postCompleted: Boolean(rawMission.postCompleted),
    postClaimed: Boolean(rawMission.postClaimed),
    commentCompleted: Boolean(rawMission.commentCompleted ?? rawMission['commentCompleted:']),
    commentClaimed: Boolean(rawMission.commentClaimed),
    gameCompleted: Boolean(rawMission.gameCompleted),
    gameClaimed: Boolean(rawMission.gameClaimed),
  };
}

function normalizeDashboard(payload, fallbackLoginId) {
  const matchHistories = Array.isArray(payload?.matchHistories) ? payload.matchHistories : [];

  return {
    loginId: String(payload?.loginId ?? fallbackLoginId ?? ''),
    name: String(payload?.name ?? '').trim() || '사용자',
    cashBalance: Number(payload?.cashBalance ?? 0),
    totalStockValue: Number(payload?.totalStockValue ?? 0),
    totalInvestment: Number(payload?.totalInvestment ?? 0),
    totalYield: Number(payload?.totalYield ?? 0),
    myStocks: Array.isArray(payload?.myStocks) ? payload.myStocks.map(normalizeStock) : [],
    missionStatus: normalizeMissionStatus(payload?.missionStatus, fallbackLoginId),
    myPosts: Array.isArray(payload?.myPosts) ? payload.myPosts.map(normalizePost) : [],
    matchHistories: matchHistories.map((history, index) => ({
      id: String(history?.roomId ?? `history-${index}`),
      roomId: String(history?.roomId ?? ''),
      stockCode: String(history?.stockCode ?? '').trim(),
      stockName: String(history?.stockName ?? '').trim() || '종목 정보 없음',
      finishedAt: history?.finishedAt ?? null,
      myResult: String(history?.myResult ?? '').trim().toUpperCase() || 'UNKNOWN',
      myFinalAsset: Number(history?.myFinalAsset ?? 0),
      opponents: Array.isArray(history?.opponents)
        ? history.opponents.map((opponent, opponentIndex) => ({
            id: `${history?.roomId ?? index}-opponent-${opponentIndex}`,
            loginId: String(opponent?.loginId ?? '').trim(),
            nickname: String(opponent?.nickname ?? '').trim() || '상대',
            result: String(opponent?.result ?? '').trim().toUpperCase() || 'UNKNOWN',
            finalAsset: Number(opponent?.finalAsset ?? 0),
          }))
        : [],
    })),
  };
}

const missionDefinitions = [
  { key: 'attendance', label: '출석 체크' },
  { key: 'buy', label: '매수하기' },
  { key: 'sell', label: '매도하기' },
  { key: 'quiz', label: '퀴즈 풀기' },
  { key: 'like', label: '추천 누르기' },
  { key: 'post', label: '게시글 작성하기' },
  { key: 'comment', label: '댓글 작성하기' },
  { key: 'game', label: '미니게임 플레이하기' },
];

function EmptyState({ title, description }) {
  return (
    <div className="mypage-empty-state">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export default function MyPageTab({ apiBaseUrl, loginId }) {
  const [dashboard, setDashboard] = useState(() => normalizeDashboard(null, loginId));
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function loadDashboard() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const payload = await fetchMyPageDashboard(apiBaseUrl, controller.signal);

        if (isMounted) {
          setDashboard(normalizeDashboard(payload, loginId));
        }
      } catch (error) {
        if (isMounted && error.name !== 'AbortError') {
          setErrorMessage(error.message || '마이페이지 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [apiBaseUrl, loginId]);

  const totalAssets = useMemo(
    () => dashboard.cashBalance + dashboard.totalStockValue,
    [dashboard.cashBalance, dashboard.totalStockValue],
  );

  const totalProfit = useMemo(
    () => dashboard.totalStockValue - dashboard.totalInvestment,
    [dashboard.totalInvestment, dashboard.totalStockValue],
  );

  const completedMissionCount = useMemo(
    () =>
      missionDefinitions.reduce(
        (count, mission) => count + (dashboard.missionStatus[`${mission.key}Completed`] ? 1 : 0),
        0,
      ),
    [dashboard.missionStatus],
  );

  const totalShares = useMemo(
    () => dashboard.myStocks.reduce((sum, stock) => sum + stock.quantity, 0),
    [dashboard.myStocks],
  );

  const summaryRows = [
    {
      label: '총 자산',
      value: isLoading ? '불러오는 중...' : formatCurrency(totalAssets),
      tone: 'neutral',
    },
    {
      label: '총 손익',
      value: isLoading ? '불러오는 중...' : formatCurrency(totalProfit),
      tone: totalProfit >= 0 ? 'up' : 'down',
    },
    {
      label: '수익률',
      value: isLoading ? '불러오는 중...' : formatSignedPercent(dashboard.totalYield),
      tone: dashboard.totalYield >= 0 ? 'up' : 'down',
    },
    {
      label: '보유 종목',
      value: isLoading ? '불러오는 중...' : `${dashboard.myStocks.length}종 / ${totalShares}주`,
      tone: 'neutral',
    },
    {
      label: '완료 미션',
      value: isLoading ? '불러오는 중...' : `${completedMissionCount} / ${missionDefinitions.length}`,
      tone: 'neutral',
    },
  ];

  return (
    <section className="mypage-shell">
      <header className="mypage-header">
        <div>
          <h1>마이페이지</h1>
          <p>나의 투자 정보와 활동 내역을 확인하세요</p>
        </div>
      </header>

      {errorMessage ? <p className="mypage-feedback error">{errorMessage}</p> : null}

      <div className="mypage-dashboard">
        <aside className="mypage-profile-card">
          <div className="mypage-profile-block">
            <span className="mypage-profile-label">사용자 로그인 ID</span>
            <strong className="mypage-profile-value">{dashboard.loginId || loginId}</strong>
          </div>

          <div className="mypage-profile-block">
            <span className="mypage-profile-label">사용자 닉네임</span>
            <strong className="mypage-profile-name">{isLoading ? '불러오는 중...' : dashboard.name}</strong>
          </div>

          <div className="mypage-profile-summary">
            {summaryRows.map((item) => (
              <div key={item.label} className="mypage-profile-summary-row">
                <span>{item.label}</span>
                <strong className={item.tone}>{item.value}</strong>
              </div>
            ))}
          </div>
        </aside>

        <div className="mypage-main">
          <section className="mypage-card mypage-holdings-card">
            <div className="mypage-card-head">
              <h2>보유 종목 및 수익률</h2>
            </div>

            {isLoading ? (
              <EmptyState title="보유 종목을 불러오는 중입니다." />
            ) : dashboard.myStocks.length ? (
              <div className="mypage-stock-list">
                {dashboard.myStocks.map((stock) => (
                  <article key={stock.id} className="mypage-stock-item">
                    <div className="mypage-stock-main">
                      <div>
                        <strong>{stock.stockName}</strong>
                        <p>{stock.stockCode}</p>
                      </div>
                      <span className={stock.yield >= 0 ? 'up' : 'down'}>{formatSignedPercent(stock.yield)}</span>
                    </div>

                    <div className="mypage-stock-metrics">
                      <div>
                        <span>보유 수량</span>
                        <strong>{stock.quantity}주</strong>
                      </div>
                      <div>
                        <span>평균 단가</span>
                        <strong>{formatCurrency(stock.averagePrice)}</strong>
                      </div>
                      <div>
                        <span>현재가</span>
                        <strong>{formatCurrency(stock.currentPrice)}</strong>
                      </div>
                      <div>
                        <span>평가 금액</span>
                        <strong>{formatCurrency(stock.evaluationValue)}</strong>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="보유 종목이 없습니다." description="거래가 발생하면 이 영역에 종목 정보가 표시됩니다." />
            )}
          </section>

          <section className="mypage-card mypage-mission-card-panel">
            <div className="mypage-card-head">
              <h2>데일리 미션 상태</h2>
            </div>

            <div className="mypage-mission-grid">
              {missionDefinitions.map((mission) => {
                const completed = dashboard.missionStatus[`${mission.key}Completed`];
                const claimed = dashboard.missionStatus[`${mission.key}Claimed`];

                return (
                  <article
                    key={mission.key}
                    className={`mypage-mission-item ${completed ? 'completed' : ''} ${claimed ? 'claimed' : ''}`}
                  >
                    <div className="mypage-mission-item-head">
                      <strong>{mission.label}</strong>
                      <span className={`mypage-mission-status-badge ${claimed ? 'claimed' : completed ? 'completed' : 'pending'}`}>
                        {claimed ? '수령 완료' : completed ? '완료' : '진행 중'}
                      </span>
                    </div>
                    <div className="mypage-mission-state-line">
                      <span className="mypage-mission-state-icon" aria-hidden="true">
                        {claimed ? '✓' : completed ? '●' : '○'}
                      </span>
                      <span className="mypage-mission-state-text">
                        {claimed ? '보상 수령 완료' : completed ? '미션 완료' : '진행 중'}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="mypage-card mypage-posts-card">
            <div className="mypage-card-head">
              <h2>작성 게시글 목록</h2>
            </div>

            {isLoading ? (
              <EmptyState title="게시글을 불러오는 중입니다." />
            ) : dashboard.myPosts.length ? (
              <div className="mypage-post-list">
                {dashboard.myPosts.map((post) => (
                  <article key={post.postId} className="mypage-post-item">
                    <div className="mypage-post-main">
                      <div>
                        <strong>{post.title}</strong>
                        <p>{post.content || '본문 내용이 없습니다.'}</p>
                      </div>
                      <span>{formatDate(post.createdAt)}</span>
                    </div>

                    <div className="mypage-post-metrics">
                      <span>작성자 {post.author}</span>
                      <span>조회 {post.viewCount}</span>
                      <span>좋아요 {post.likeCount}</span>
                      <span>댓글 {post.commentCount}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="작성한 게시글이 없습니다." description="게시판에서 글을 작성하면 이 영역에 표시됩니다." />
            )}
          </section>

          <section className="mypage-card mypage-match-history-card">
            <div className="mypage-card-head">
              <h2>1vs1 매치 히스토리</h2>
            </div>

            {isLoading ? (
              <EmptyState title="매치 히스토리를 불러오는 중입니다." />
            ) : dashboard.matchHistories.length ? (
              <div className="mypage-match-history-list">
                {dashboard.matchHistories.map((history) => (
                  <article key={history.id} className="mypage-match-history-item">
                    <div className="mypage-match-history-main">
                      <div>
                        <strong>{`${history.stockName} (${history.stockCode || '-'})`}</strong>
                        <p>{`매치 ID: ${history.roomId || '-'}`}</p>
                      </div>
                      <span className={history.myResult === 'WIN' ? 'win' : history.myResult === 'LOSE' ? 'lose' : ''}>
                        {history.myResult === 'WIN' ? '승리' : history.myResult === 'LOSE' ? '패배' : '무승부'}
                      </span>
                    </div>

                    <div className="mypage-match-history-metrics">
                      <span>{`내 최종 자산 ${formatCurrency(history.myFinalAsset)}`}</span>
                      <span>{`종료 시각 ${formatDate(history.finishedAt)}`}</span>
                    </div>

                    {history.opponents.length ? (
                      <div className="mypage-match-history-opponents">
                        {history.opponents.map((opponent) => (
                          <p key={opponent.id}>
                            {`${opponent.nickname}(${opponent.loginId || '-'}) · ${
                              opponent.result === 'WIN' ? '승리' : opponent.result === 'LOSE' ? '패배' : '무승부'
                            } · ${formatCurrency(opponent.finalAsset)}`}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="저장된 1vs1 매치 기록이 없습니다." description="1vs1 매치를 완료하면 이 영역에 기록됩니다." />
            )}
          </section>
        </div>
      </div>
    </section>
  );
}



