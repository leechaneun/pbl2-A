const MOCK_STORAGE_KEY = 'mock-invest-trading-state-v1';
const DEFAULT_SESSION_LOGIN_ID = 'demo';
const DEFAULT_SESSION_PASSWORD = 'demo1234';
const MOCK_LATENCY_MS = 120;

export const isMockApiEnabled = import.meta.env.VITE_USE_MOCK_API === 'true';

const DEFAULT_USER = {
  id: 'mock-user-demo',
  loginId: DEFAULT_SESSION_LOGIN_ID,
  password: DEFAULT_SESSION_PASSWORD,
  name: null,
  balance: 10000000,
};

function createDefaultState() {
  const now = new Date().toISOString();

  return {
    users: [DEFAULT_USER],
    sessionUserId: null,
    posts: [
      {
        postId: 'post-1',
        title: '오늘은 반도체가 강하네요',
        content: '삼성전자와 SK하이닉스 거래대금이 많이 붙고 있습니다. 단기 눌림은 매수 기회로 봅니다.',
        author: DEFAULT_USER.loginId,
        stockCode: '005930',
        stockName: '삼성전자',
        position: '매수',
        yield: 5.6,
        viewCount: 28,
        likeCount: 1,
        likedUsers: [DEFAULT_USER.loginId],
        comments: [
          {
            commentId: 'comment-1',
            author: DEFAULT_USER.loginId,
            content: '저도 비슷하게 보고 있습니다.',
            createdAt: now,
          },
        ],
        commentCount: 1,
        createdAt: now,
      },
      {
        postId: 'post-2',
        title: '플랫폼주 분할 매수 관점',
        content: 'NAVER는 눌릴 때마다 조금씩 담는 전략이 유효해 보입니다.',
        author: 'swingman',
        stockCode: '035420',
        stockName: 'NAVER',
        position: '매수',
        yield: 2.1,
        viewCount: 11,
        likeCount: 0,
        likedUsers: [],
        comments: [],
        commentCount: 0,
        createdAt: now,
      },
    ],
  };
}

function getMemoryStorage() {
  if (!globalThis.__mockTradingState) {
    globalThis.__mockTradingState = createDefaultState();
  }

  return globalThis.__mockTradingState;
}

function loadState() {
  if (typeof window === 'undefined') {
    return getMemoryStorage();
  }

  try {
    const saved = window.localStorage.getItem(MOCK_STORAGE_KEY);

    if (!saved) {
      const initialState = createDefaultState();
      window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(initialState));
      return initialState;
    }

    const parsed = JSON.parse(saved);
    return {
      ...createDefaultState(),
      ...parsed,
      posts: Array.isArray(parsed?.posts) ? parsed.posts : createDefaultState().posts,
      users: Array.isArray(parsed?.users) ? parsed.users : [DEFAULT_USER],
    };
  } catch (_error) {
    const fallback = createDefaultState();
    window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
}

function saveState(state) {
  if (typeof window === 'undefined') {
    globalThis.__mockTradingState = state;
    return;
  }

  window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(state));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function delay(signal) {
  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }

  await new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      signal?.removeEventListener?.('abort', handleAbort);
      resolve();
    }, MOCK_LATENCY_MS);

    function handleAbort() {
      window.clearTimeout(timeoutId);
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    }

    signal?.addEventListener?.('abort', handleAbort, { once: true });
  });
}

function getSessionUser(state) {
  return state.users.find((user) => user.id === state.sessionUserId) ?? null;
}

function requireSessionUser(state) {
  const user = getSessionUser(state);

  if (!user) {
    throw createError('로그인이 필요합니다.', 401);
  }

  return user;
}

function createEmptyMyPagePayload(user) {
  return {
    loginId: user?.loginId ?? '',
    name: user?.name ?? null,
    cashBalance: Number(user?.balance ?? 0),
    totalStockValue: 0,
    totalInvestment: 0,
    totalYield: 0,
    myStocks: [],
    missionStatus: {
      buyCompleted: false,
      buyClaimed: false,
      sellCompleted: false,
      sellClaimed: false,
      quizCompleted: false,
      quizClaimed: false,
      likeCompleted: false,
      likeClaimed: false,
      postCompleted: false,
      postClaimed: false,
      commentCompleted: false,
      commentClaimed: false,
      gameCompleted: false,
      gameClaimed: false,
    },
    myPosts: [],
  };
}

export async function mockRequestApi(path, { method = 'GET', body, signal } = {}) {
  await delay(signal);

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const routePath = cleanPath.split('?')[0];
  const state = loadState();

  if (method === 'POST' && routePath === '/user/register') {
    const loginId = String(body?.loginId ?? '').trim();
    const password = String(body?.password ?? '').trim();

    if (!loginId || !password) {
      throw createError('아이디와 비밀번호를 모두 입력해 주세요.', 400);
    }

    if (state.users.some((user) => user.loginId === loginId)) {
      throw createError('이미 존재하는 로그인 아이디입니다.', 400);
    }

    const newUser = {
      id: `mock-user-${Date.now()}`,
      loginId,
      password,
      name: null,
      balance: 10000000,
    };

    state.users.push(newUser);
    saveState(state);
    return clone(newUser);
  }

  if (method === 'POST' && routePath === '/user/login') {
    const loginId = String(body?.loginId ?? '').trim();
    const password = String(body?.password ?? '').trim();
    const user = state.users.find((item) => item.loginId === loginId);

    if (!user) {
      throw createError('존재하지 않는 아이디입니다.', 401);
    }

    if (user.password !== password) {
      throw createError('비밀번호가 일치하지 않습니다.', 401);
    }

    state.sessionUserId = user.id;
    saveState(state);
    return clone({ ...user, password: null });
  }

  if (method === 'GET' && routePath === '/user/me') {
    const user = requireSessionUser(state);
    return clone({ ...user, password: null });
  }

  if (method === 'POST' && routePath === '/user/logout') {
    state.sessionUserId = null;
    saveState(state);
    return '로그아웃 성공';
  }

  if (method === 'GET' && routePath === '/stocks') {
    return [];
  }

  if (method === 'GET' && routePath.startsWith('/trade/my/')) {
    requireSessionUser(state);
    return [];
  }

  if (method === 'POST' && (routePath === '/trade/buy' || routePath === '/trade/sell')) {
    throw createError('현재 mock 모드에서는 거래 기능을 지원하지 않습니다.', 400);
  }

  if (method === 'GET' && routePath === '/posts') {
    return clone(
      state.posts.map((post) => ({
        postId: post.postId,
        title: post.title,
        author: post.author,
        content: post.content,
        stockCode: post.stockCode,
        stockName: post.stockName,
        position: post.position,
        yield: post.yield,
        viewCount: post.viewCount,
        likedUsers: post.likedUsers,
        likeCount: post.likeCount,
        comments: post.comments,
        commentCount: post.commentCount,
        createdAt: post.createdAt,
      })),
    );
  }

  if (method === 'GET' && routePath.startsWith('/posts/')) {
    requireSessionUser(state);
    const segments = routePath.split('/').filter(Boolean);
    const postId = segments[1];
    const post = state.posts.find((item) => item.postId === postId);

    if (!post) {
      throw createError('게시글을 찾을 수 없습니다.', 404);
    }

    if (segments.length === 2) {
      post.viewCount += 1;
      saveState(state);
      return clone(post);
    }
  }

  if (method === 'POST' && routePath === '/posts') {
    const user = requireSessionUser(state);
    const newPost = {
      postId: `post-${Date.now()}`,
      title: String(body?.title ?? '').trim() || '새 게시글',
      content: String(body?.content ?? '').trim(),
      author: String(body?.author ?? user.loginId).trim(),
      stockCode: String(body?.stockCode ?? '').trim(),
      stockName: String(body?.stockName ?? '').trim(),
      position: String(body?.position ?? '').trim(),
      yield: Number(body?.yield ?? 0),
      viewCount: 0,
      likeCount: 0,
      likedUsers: [],
      comments: [],
      commentCount: 0,
      createdAt: new Date().toISOString(),
    };

    state.posts.unshift(newPost);
    saveState(state);
    return clone(newPost);
  }

  if (method === 'POST' && routePath.endsWith('/like')) {
    const user = requireSessionUser(state);
    const postId = routePath.split('/')[2];
    const post = state.posts.find((item) => item.postId === postId);

    if (!post) {
      throw createError('게시글을 찾을 수 없습니다.', 404);
    }

    const likeIndex = post.likedUsers.indexOf(user.loginId);
    if (likeIndex >= 0) {
      post.likedUsers.splice(likeIndex, 1);
    } else {
      post.likedUsers.push(user.loginId);
    }

    post.likeCount = post.likedUsers.length;
    saveState(state);
    return clone(post);
  }

  if (method === 'POST' && routePath.endsWith('/comments')) {
    const user = requireSessionUser(state);
    const postId = routePath.split('/')[2];
    const post = state.posts.find((item) => item.postId === postId);

    if (!post) {
      throw createError('게시글을 찾을 수 없습니다.', 404);
    }

    const comment = {
      commentId: `comment-${Date.now()}`,
      author: String(body?.author ?? user.loginId).trim(),
      content: String(body?.content ?? '').trim(),
      createdAt: new Date().toISOString(),
    };

    post.comments.push(comment);
    post.commentCount = post.comments.length;
    saveState(state);
    return clone(comment);
  }

  if (
    method === 'GET' &&
    (routePath === '/quizzes' ||
      routePath === '/quiz' ||
      routePath === '/quiz/list' ||
      routePath.startsWith('/quizzes/') ||
      routePath.startsWith('/quiz/'))
  ) {
    requireSessionUser(state);
    return [];
  }

  if (method === 'GET' && routePath === '/missions') {
    requireSessionUser(state);
    return { missions: [] };
  }

  if (method === 'POST' && (routePath === '/missions/complete' || routePath === '/missions/claim')) {
    requireSessionUser(state);
    return '현재 mock 모드에서는 미션 기능을 지원하지 않습니다.';
  }

  if (method === 'GET' && routePath === '/mypage') {
    const user = requireSessionUser(state);
    return createEmptyMyPagePayload(user);
  }

  throw createError('현재 mock 모드에서 지원하지 않는 요청입니다.', 501);
}

export async function mockFetchMyPageDashboard(signal) {
  return mockRequestApi('/mypage', { method: 'GET', signal });
}

export const mockCredentials = {
  loginId: DEFAULT_SESSION_LOGIN_ID,
  password: DEFAULT_SESSION_PASSWORD,
};
