import { useEffect, useMemo, useState } from 'react';

const POSTS_PER_PAGE = 10;
const COMMENTS_PER_PAGE = 5;
const BOARD_CATEGORIES = ['일반', '뉴스', '분석', '추천', '질문'];
const BOARD_TABS = ['전체', ...BOARD_CATEGORIES];
const BOARD_SEARCH_OPTIONS = [
  { value: 'title', label: '제목' },
  { value: 'titleContent', label: '제목/내용' },
  { value: 'content', label: '내용' },
  { value: 'author', label: '작성자' },
];

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatYield(value) {
  if (!Number.isFinite(value)) {
    return '0.00%';
  }

  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function getErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

function extractYoutubeVideoId(value) {
  const text = String(value ?? '').trim();

  if (!text) {
    return '';
  }

  try {
    const url = new URL(text);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      return url.pathname.split('/').filter(Boolean)[0] ?? '';
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') {
        return url.searchParams.get('v') ?? '';
      }

      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts[0] === 'embed' || pathParts[0] === 'shorts') {
        return pathParts[1] ?? '';
      }
    }
  } catch (_error) {
    return '';
  }

  return '';
}

function buildBoardContentBlocks(content) {
  const normalizedContent = String(content ?? '').trim();

  if (!normalizedContent) {
    return [];
  }

  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const lines = normalizedContent.split('\n');
  const blocks = [];

  lines.forEach((line, lineIndex) => {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      blocks.push({ type: 'spacer', key: `spacer-${lineIndex}` });
      return;
    }

    const matches = [...trimmedLine.matchAll(urlPattern)];

    if (!matches.length) {
      blocks.push({ type: 'text', text: trimmedLine, key: `text-${lineIndex}` });
      return;
    }

    let cursor = 0;
    matches.forEach((match, matchIndex) => {
      const [url] = match;
      const startIndex = match.index ?? 0;
      const beforeText = trimmedLine.slice(cursor, startIndex).trim();

      if (beforeText) {
        blocks.push({ type: 'text', text: beforeText, key: `text-${lineIndex}-${matchIndex}` });
      }

      const videoId = extractYoutubeVideoId(url);
      if (videoId) {
        blocks.push({
          type: 'youtube',
          url,
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
          key: `youtube-${lineIndex}-${matchIndex}`,
        });
      } else {
        blocks.push({ type: 'link', url, key: `link-${lineIndex}-${matchIndex}` });
      }

      cursor = startIndex + url.length;
    });

    const afterText = trimmedLine.slice(cursor).trim();
    if (afterText) {
      blocks.push({ type: 'text', text: afterText, key: `text-tail-${lineIndex}` });
    }
  });

  return blocks;
}

function hasYoutubeContent(content) {
  return buildBoardContentBlocks(content).some((block) => block.type === 'youtube');
}

function getPostSortValue(post) {
  const createdAt = post?.createdAt;
  const parsedTime = createdAt ? new Date(createdAt).getTime() : Number.NaN;

  if (Number.isFinite(parsedTime)) {
    return parsedTime;
  }

  const postId = String(post?.postId ?? '').trim();
  return postId ? postId : '0';
}

function getSelectedPostIdFromLocation() {
  if (typeof window === 'undefined') {
    return '';
  }

  return new URL(window.location.href).searchParams.get('post') ?? '';
}

function syncSelectedPostIdToLocation(postId, { replace = false } = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);

  if (postId) {
    url.searchParams.set('post', postId);
  } else {
    url.searchParams.delete('post');
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const method = replace ? 'replaceState' : 'pushState';
  window.history[method]({ ...(window.history.state ?? {}), boardPostId: postId || null }, '', nextUrl);
}

function toSummary(post) {
  return {
    postId: String(post.postId),
    title: post.title ?? '',
    author: post.author ?? '익명',
    category: BOARD_CATEGORIES.includes(post.category) ? post.category : '일반',
    content: post.content ?? '',
    stockCode: post.stockCode ?? '',
    stockName: post.stockName ?? '',
    position: post.position ?? '',
    yield: Number(post.yield ?? 0),
    viewCount: Number(post.viewCount ?? 0),
    likedUsers: Array.isArray(post.likedUsers) ? post.likedUsers : [],
    likeCount: Number(post.likeCount ?? 0),
    commentCount: Number(post.commentCount ?? (post.comments?.length ?? 0)),
    comments: Array.isArray(post.comments) ? post.comments : [],
    createdAt: post.createdAt ?? null,
  };
}

function toggleLikeState(post, loginId) {
  if (!post) {
    return post;
  }

  const likedUsers = Array.isArray(post.likedUsers) ? post.likedUsers : [];
  const alreadyLiked = likedUsers.includes(loginId);
  const nextLikedUsers = alreadyLiked ? likedUsers.filter((user) => user !== loginId) : [...likedUsers, loginId];

  return {
    ...post,
    likedUsers: nextLikedUsers,
    likeCount: nextLikedUsers.length,
  };
}

function ComposePanel({ loginId, holdings, onSubmit, isSubmitting }) {
  const [selectedHoldingCode, setSelectedHoldingCode] = useState(holdings[0]?.stockCode ?? '');
  const [category, setCategory] = useState('일반');
  const [position, setPosition] = useState('매수');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const selectedHolding = useMemo(
    () => holdings.find((holding) => holding.stockCode === selectedHoldingCode) ?? null,
    [holdings, selectedHoldingCode],
  );

  async function handleSubmit(event) {
    event.preventDefault();

    if (!title.trim() || !content.trim()) {
      setErrorMessage('제목과 내용을 입력해 주세요.');
      return;
    }

    setErrorMessage('');
    await onSubmit({
      category,
      title: title.trim(),
      content: content.trim(),
      author: loginId,
      stockCode: selectedHolding?.stockCode ?? '',
      stockName: selectedHolding?.stockName ?? '',
      position,
      yield: Number(selectedHolding?.yieldRate ?? 0),
    });
  }

  return (
    <div className="board-panel-scroll">
      <div className="board-panel-head">
        <div>
          <h2>글쓰기</h2>
        </div>
      </div>

      <form className="board-composer-form" onSubmit={handleSubmit}>
        <label className="board-field">
          <span>작성자</span>
          <input type="text" value={loginId} readOnly />
        </label>

        <label className="board-field">
          <span>보유 종목 선택</span>
          <select
            value={selectedHoldingCode}
            onChange={(event) => setSelectedHoldingCode(event.target.value)}
            disabled={isSubmitting || !holdings.length}
          >
            {holdings.length ? (
              holdings.map((holding) => (
                <option key={holding.stockCode} value={holding.stockCode}>
                  {holding.stockName} ({holding.stockCode})
                </option>
              ))
            ) : (
              <option value="">보유 종목 없음</option>
            )}
          </select>
        </label>

        {selectedHolding ? (
          <div className="board-holding-reference">
            <div>
              <span>보유 수량</span>
              <strong>{selectedHolding.quantity}주</strong>
            </div>
            <div>
              <span>평균 단가</span>
              <strong>{formatCurrency(selectedHolding.averagePrice)}</strong>
            </div>
            <div>
              <span>현재가</span>
              <strong>{formatCurrency(selectedHolding.currentPrice)}</strong>
            </div>
            <div>
              <span>현재 수익률</span>
              <strong>{formatYield(selectedHolding.yieldRate)}</strong>
            </div>
          </div>
        ) : null}

        <div className="board-field-row">
          <label className="board-field">
            <span>카테고리</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)} disabled={isSubmitting}>
              {BOARD_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="board-field">
            <span>포지션</span>
            <select value={position} onChange={(event) => setPosition(event.target.value)} disabled={isSubmitting}>
              <option value="매수">매수</option>
              <option value="매도">매도</option>
            </select>
          </label>

          <label className="board-field">
            <span>참조 수익률</span>
            <input type="text" value={selectedHolding ? formatYield(selectedHolding.yieldRate) : '-'} readOnly />
          </label>
        </div>

        <label className="board-field">
          <span>제목</span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="제목을 입력하세요"
            disabled={isSubmitting}
          />
        </label>

        <label className="board-field">
          <span>내용</span>
          <textarea
            rows="10"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="매매 근거와 의견을 입력하세요"
            disabled={isSubmitting}
          />
        </label>

        {errorMessage ? <p className="board-inline-feedback error">{errorMessage}</p> : null}

        <div className="trade-modal-actions">
          <button type="submit" className="primary buy" disabled={isSubmitting}>
            {isSubmitting ? '등록 중...' : '등록'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function BoardTab({
  loginId,
  holdings,
  fetchPosts,
  fetchPostDetail,
  createPost,
  togglePostLike,
  createComment,
}) {
  const [posts, setPosts] = useState([]);
  const [selectedPostId, setSelectedPostId] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [searchType, setSearchType] = useState('title');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [isSubmittingLike, setIsSubmittingLike] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [commentPage, setCommentPage] = useState(1);
  const [activeCategory, setActiveCategory] = useState('전체');
  const isComposeView = isComposerOpen;
  const isDetailView = Boolean(selectedPostId);

  const filteredPosts = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return posts
      .filter((post) => {
        const postCategory = BOARD_CATEGORIES.includes(post.category) ? post.category : '일반';

        if (activeCategory !== '전체' && postCategory !== activeCategory) {
          return false;
        }

        if (!keyword) {
          return true;
        }

        const title = String(post.title ?? '').toLowerCase();
        const content = String(post.content ?? '').toLowerCase();
        const author = String(post.author ?? '').toLowerCase();

        switch (searchType) {
          case 'title':
            return title.includes(keyword);
          case 'titleContent':
            return `${title} ${content}`.includes(keyword);
          case 'content':
            return content.includes(keyword);
          case 'author':
            return author.includes(keyword);
          default:
            return title.includes(keyword);
        }
      })
      .sort((left, right) => {
        const leftValue = getPostSortValue(left);
        const rightValue = getPostSortValue(right);

        if (typeof leftValue === 'number' && typeof rightValue === 'number') {
          return rightValue - leftValue;
        }

        return String(rightValue).localeCompare(String(leftValue));
      });
  }, [activeCategory, posts, searchTerm, searchType]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / POSTS_PER_PAGE));
  const pagedPosts = useMemo(() => {
    const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
    return filteredPosts.slice(startIndex, startIndex + POSTS_PER_PAGE);
  }, [currentPage, filteredPosts]);
  const totalCommentPages = Math.max(1, Math.ceil((selectedPost?.comments?.length ?? 0) / COMMENTS_PER_PAGE));
  const pagedComments = useMemo(() => {
    const comments = Array.isArray(selectedPost?.comments) ? selectedPost.comments : [];
    const startIndex = (commentPage - 1) * COMMENTS_PER_PAGE;
    return comments.slice(startIndex, startIndex + COMMENTS_PER_PAGE);
  }, [commentPage, selectedPost?.comments]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, searchTerm]);

  useEffect(() => {
    setCurrentPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setCommentPage(1);
  }, [selectedPostId]);

  useEffect(() => {
    setCommentPage((current) => Math.min(current, totalCommentPages));
  }, [totalCommentPages]);

  function openPostDetail(postId) {
    const nextPostId = String(postId ?? '').trim();

    if (!nextPostId || nextPostId === selectedPostId) {
      return;
    }

    setIsComposerOpen(false);
    setSelectedPostId(nextPostId);
    syncSelectedPostIdToLocation(nextPostId);
  }

  function closeBoardOverlay() {
    setSelectedPostId('');
    setSelectedPost(null);
    setIsComposerOpen(false);
    syncSelectedPostIdToLocation('', { replace: true });
  }

  async function loadPosts(signal) {
    setIsLoadingPosts(true);
    setErrorMessage('');

    try {
      const nextPosts = await fetchPosts(signal);
      setPosts(nextPosts);
      setSelectedPostId((current) => (current && nextPosts.some((post) => post.postId === current) ? current : ''));
    } catch (error) {
      if (error.name !== 'AbortError') {
        setErrorMessage(getErrorMessage(error, '게시글 목록을 불러오지 못했습니다.'));
      }
    } finally {
      setIsLoadingPosts(false);
    }
  }

  async function loadPostDetail(postId, signal) {
    if (!postId) {
      setSelectedPost(null);
      return;
    }

    setIsLoadingDetail(true);
    setErrorMessage('');

    try {
      const detail = await fetchPostDetail(postId, signal);
      setSelectedPost(detail);
      setPosts((currentPosts) =>
        currentPosts.map((post) => (post.postId === detail.postId ? { ...post, ...toSummary(detail) } : post)),
      );
    } catch (error) {
      if (error.name !== 'AbortError') {
        setErrorMessage(getErrorMessage(error, '게시글 상세를 불러오지 못했습니다.'));
      }
    } finally {
      setIsLoadingDetail(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    loadPosts(controller.signal);
    return () => controller.abort();
  }, [fetchPosts]);

  useEffect(() => {
    function handlePopState() {
      const nextPostId = getSelectedPostIdFromLocation();
      setSelectedPostId(nextPostId);
      setSelectedPost(null);
      setIsComposerOpen(false);
    }

    handlePopState();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadPostDetail(selectedPostId, controller.signal);
    return () => controller.abort();
  }, [fetchPostDetail, selectedPostId]);

  function handleSearchSubmit(event) {
    event.preventDefault();
    setSearchTerm(searchInput.trim());
    setCurrentPage(1);
  }

  function handlePageChange(nextPage) {
    setCurrentPage(Math.min(Math.max(1, nextPage), totalPages));
  }

  async function refreshSelectedPost(postId) {
    const detail = await fetchPostDetail(postId);
    setSelectedPost(detail);
    setPosts((currentPosts) => {
      const nextSummary = toSummary(detail);
      const exists = currentPosts.some((post) => post.postId === detail.postId);

      return exists
        ? currentPosts.map((post) => (post.postId === detail.postId ? { ...post, ...nextSummary } : post))
        : [nextSummary, ...currentPosts];
    });
  }

  async function handleCreatePost(payload) {
    setIsSubmittingPost(true);
    setFeedbackMessage('');
    setErrorMessage('');

    try {
      const created = await createPost(payload);
      const createdId = typeof created === 'string' ? created : created?.postId;

      if (createdId) {
        openPostDetail(String(createdId));
        await refreshSelectedPost(String(createdId));
      } else {
        await loadPosts();
      }

      setIsComposerOpen(false);
      setFeedbackMessage('게시글을 등록했습니다.');
    } catch (error) {
      setErrorMessage(getErrorMessage(error, '게시글 등록에 실패했습니다.'));
    } finally {
      setIsSubmittingPost(false);
    }
  }

  async function handleToggleLike() {
    if (!selectedPostId) {
      return;
    }

    setIsSubmittingLike(true);
    setFeedbackMessage('');
    setErrorMessage('');

    try {
      await togglePostLike({ postId: selectedPostId, loginId });
      setSelectedPost((currentPost) => toggleLikeState(currentPost, loginId));
      setPosts((currentPosts) =>
        currentPosts.map((post) => (post.postId === selectedPostId ? toggleLikeState(post, loginId) : post)),
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error, '추천 처리에 실패했습니다.'));
    } finally {
      setIsSubmittingLike(false);
    }
  }

  async function handleCreateComment(event) {
    event.preventDefault();

    if (!selectedPostId || !commentDraft.trim()) {
      return;
    }

    setIsSubmittingComment(true);
    setFeedbackMessage('');
    setErrorMessage('');

    try {
      await createComment({ postId: selectedPostId, content: commentDraft.trim(), author: loginId });
      setSelectedPost((prev) => {
        if (!prev) {
          return prev;
        }

        const nextComments = [
          ...(Array.isArray(prev.comments) ? prev.comments : []),
          { content: commentDraft.trim(), author: loginId, createdAt: new Date().toISOString() },
        ];

        setCommentPage(Math.max(1, Math.ceil(nextComments.length / COMMENTS_PER_PAGE)));

        return {
          ...prev,
          comments: nextComments,
          commentCount: nextComments.length,
        };
      });
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.postId === selectedPostId
            ? {
                ...post,
                commentCount: (Number(post.commentCount ?? post.comments?.length ?? 0) || 0) + 1,
              }
            : post,
        ),
      );
      setCommentDraft('');
    } catch (error) {
      setErrorMessage(getErrorMessage(error, '댓글 등록에 실패했습니다.'));
    } finally {
      setIsSubmittingComment(false);
    }
  }

  const selectedLiked = selectedPost?.likedUsers?.includes(loginId);
  const selectedPostContentBlocks = useMemo(
    () => buildBoardContentBlocks(selectedPost?.content),
    [selectedPost?.content],
  );

  return (
    <section className="board-shell">
      <div className="board-frame-card">
        <div className="board-main-card">
          <header className="hero board-hero">
            <div>
              <h1>게시판</h1>
            </div>
            <button
              type="button"
              className="board-compose-button"
              onClick={() => {
                if (isDetailView || isComposeView) {
                  closeBoardOverlay();
                  return;
                }

                setIsComposerOpen(true);
              }}
            >
              {isDetailView || isComposeView ? '뒤로가기' : '글쓰기'}
            </button>
          </header>

          <section
            className={[
              'board-detail-panel',
              'board-full-panel',
              selectedPost ? 'board-detail-panel-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
          {!isDetailView && !isComposeView ? (
            <>
              <div className="board-category-tabs" role="tablist" aria-label="게시판 카테고리">
                {BOARD_TABS.map((category) => (
                  <button
                    key={category}
                    type="button"
                    role="tab"
                    aria-selected={activeCategory === category}
                    className={activeCategory === category ? 'active' : ''}
                    onClick={() => setActiveCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <form className="board-search" onSubmit={handleSearchSubmit}>
                <select value={searchType} onChange={(event) => setSearchType(event.target.value)} aria-label="검색 조건">
                  {BOARD_SEARCH_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="검색어를 입력하세요"
                />
                <button type="submit">검색</button>
              </form>
            </>
          ) : null}

          {errorMessage ? <p className="board-inline-feedback error">{errorMessage}</p> : null}
          {feedbackMessage ? <p className="board-inline-feedback">{feedbackMessage}</p> : null}

          {isComposeView ? (
            <ComposePanel
              loginId={loginId}
              holdings={holdings}
              onSubmit={handleCreatePost}
              isSubmitting={isSubmittingPost}
            />
          ) : !selectedPostId ? (
            <div className="board-panel-scroll">
              <div className="board-list">
                {isLoadingPosts ? (
                  <div className="board-empty-state">
                    <strong>게시글을 불러오는 중입니다.</strong>
                  </div>
                ) : filteredPosts.length ? (
                  <>
                    <div className="board-list-header" role="row">
                      <span className="board-col-number">번호</span>
                      <span className="board-col-title">제목</span>
                      <span className="board-col-author">작성자</span>
                      <span className="board-col-date">작성일</span>
                      <span className="board-col-count">조회수</span>
                      <span className="board-col-count">추천</span>
                    </div>

                    {pagedPosts.map((post, index) => {
                      const rowNumber = filteredPosts.length - ((currentPage - 1) * POSTS_PER_PAGE + index);
                      const includesVideo = hasYoutubeContent(post.content);

                      return (
                        <button
                          key={post.postId}
                          type="button"
                          className={`board-post-row ${selectedPostId === post.postId ? 'active' : ''}`}
                          onClick={() => openPostDetail(post.postId)}
                        >
                          <span className="board-col-number">{rowNumber}</span>
                          <span className="board-col-title board-row-title">
                            <em className="board-row-category">{post.category || '일반'}</em>
                            {includesVideo ? <em className="board-row-video-badge">영상</em> : null}
                            <strong>{post.title}</strong>
                          </span>
                          <span className="board-col-author">{post.author || '익명'}</span>
                          <span className="board-col-date">{formatDate(post.createdAt)}</span>
                          <span className="board-col-count">{post.viewCount ?? 0}</span>
                          <span className="board-col-count">{post.likeCount ?? 0}</span>
                        </button>
                      );
                    })}
                  </>
                ) : (
                  <div className="board-empty-state">
                    <strong>표시할 게시글이 없습니다.</strong>
                  </div>
                )}
              </div>
              {!isLoadingPosts && filteredPosts.length ? (
                <div className="board-pagination" aria-label="게시판 페이지 이동">
                <button type="button" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
                  이전
                </button>
                <div className="board-pagination-pages">
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      className={pageNumber === currentPage ? 'active' : ''}
                      onClick={() => handlePageChange(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  다음
                </button>
                </div>
              ) : null}
            </div>
          ) : isLoadingDetail ? (
            <div className="board-empty-state board-empty-fill">
              <strong>상세 내용을 불러오는 중입니다.</strong>
            </div>
          ) : selectedPost ? (
            <div className="board-detail-layout">
              <div className="board-panel-scroll board-detail-scroll">
                <div className="board-article-card">
                <div className="board-detail-summary-card">
                  <div className="board-detail-head">
                    <div>
                      <h2>{selectedPost.title}</h2>
                      <p className="board-detail-date">{`${selectedPost.author} · ${formatDate(selectedPost.createdAt)}`}</p>
                    </div>

                    <div className="board-detail-metrics">
                      <span>조회 {selectedPost.viewCount ?? 0}</span>
                      <span>추천 {selectedPost.likeCount ?? 0}</span>
                      <span>댓글 {selectedPost.comments?.length ?? 0}</span>
                    </div>
                  </div>

                  <div className="board-actions">
                    <div className="board-post-card-meta">
                      <span>{selectedPost.category || '일반'}</span>
                      <span>{selectedPost.position || '일반'}</span>
                      <span>{selectedPost.stockName || '종목 없음'}</span>
                      <span>{selectedPost.stockCode || '-'}</span>
                      <span>{formatYield(selectedPost.yield ?? 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="board-content-section">
                  <div className="board-section-head">
                    <h3>본문</h3>
                  </div>
                  <div className="board-content-box">
                    {selectedPostContentBlocks.length ? (
                      selectedPostContentBlocks.map((block) => {
                        if (block.type === 'spacer') {
                          return <div key={block.key} className="board-content-spacer" aria-hidden="true" />;
                        }

                        if (block.type === 'youtube') {
                          return (
                            <div key={block.key} className="board-youtube-embed">
                              <iframe
                                src={block.embedUrl}
                                title="게시판 유튜브 영상"
                                loading="lazy"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                              />
                              <a href={block.url} target="_blank" rel="noreferrer">
                                {block.url}
                              </a>
                            </div>
                          );
                        }

                        if (block.type === 'link') {
                          return (
                            <p key={block.key}>
                              <a href={block.url} target="_blank" rel="noreferrer">
                                {block.url}
                              </a>
                            </p>
                          );
                        }

                        return <p key={block.key}>{block.text}</p>;
                      })
                    ) : (
                      <p>내용이 없습니다.</p>
                    )}
                  </div>
                  <div className="board-content-actions">
                    <button
                      type="button"
                      className={`board-like-button ${selectedLiked ? 'active' : ''}`}
                      onClick={handleToggleLike}
                      disabled={isSubmittingLike}
                    >
                      {isSubmittingLike ? '처리 중...' : `추천 ${selectedPost.likeCount ?? 0}`}
                    </button>
                  </div>
                </div>

                <div className="board-comments-section">
                  <div className="board-comments-block">
                    <div className="board-comments-head board-section-head">
                      <h3>댓글</h3>
                      <span className="board-liked-users">{selectedPost.comments?.length ?? 0}개</span>
                    </div>

                    <div className="board-comments-list board-comments-list-inline">
                      {selectedPost.comments?.length ? (
                        pagedComments.map((comment, index) => (
                          <article key={comment.id ?? `${comment.author}-${comment.createdAt ?? index}`} className="board-comment-card">
                            <strong>{comment.author}</strong>
                            <span className="board-detail-date">{formatDate(comment.createdAt)}</span>
                            <p>{comment.content}</p>
                          </article>
                        ))
                      ) : (
                        <p className="board-empty">아직 댓글이 없습니다.</p>
                      )}
                    </div>

                    {selectedPost.comments?.length > COMMENTS_PER_PAGE ? (
                      <div className="board-pagination board-comment-pagination" aria-label="댓글 페이지 이동">
                        <button type="button" onClick={() => setCommentPage((page) => page - 1)} disabled={commentPage === 1}>
                          이전
                        </button>
                        <div className="board-pagination-pages">
                          {Array.from({ length: totalCommentPages }, (_, index) => index + 1).map((pageNumber) => (
                            <button
                              key={pageNumber}
                              type="button"
                              className={pageNumber === commentPage ? 'active' : ''}
                              onClick={() => setCommentPage(pageNumber)}
                            >
                              {pageNumber}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setCommentPage((page) => page + 1)}
                          disabled={commentPage === totalCommentPages}
                        >
                          다음
                        </button>
                      </div>
                    ) : null}

                    <form className="board-comment-form" onSubmit={handleCreateComment}>
                      <textarea
                        rows="3"
                        value={commentDraft}
                        onChange={(event) => setCommentDraft(event.target.value)}
                        placeholder="댓글을 입력하세요"
                        disabled={isSubmittingComment}
                      />
                      <button type="submit" disabled={isSubmittingComment}>
                        {isSubmittingComment ? '등록 중...' : '댓글 등록'}
                      </button>
                    </form>
                  </div>
                </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="board-empty-state board-empty-fill">
              <strong>게시글을 선택해 주세요.</strong>
            </div>
          )}
          </section>
        </div>
      </div>
    </section>
  );
}
