import { useEffect, useMemo, useState } from 'react';

const USE_DEMO_POST_FALLBACK = true;

const DEMO_POST = {
  postId: 'demo-post-1',
  title: '삼성전자 2분기 반등 가능성 있음',
  author: 'user123',
  content: `최근 실적 발표 이후 단기 조정은 있었지만,
외국인 수급이 다시 들어오고 있고 8만 원 부근 지지력이 강해 보여서 2분기 반등 가능성이 있다고 봅니다.

저는 평균 단가 74,200원이고 현재 수익률은 +7.84%입니다.
단기 목표가는 82,000원, 손절은 72,000원 기준으로 보고 있습니다.
혹시 다른 분들은 이번 구간을 추가 매수로 보는지 의견 궁금합니다.`,
  stockCode: '005930',
  stockName: '삼성전자',
  position: '매수',
  yield: 7.84,
  viewCount: 128,
  likedUsers: ['chartman', 'swing01'],
  likeCount: 5,
  commentCount: 2,
  comments: [
    {
      id: 'demo-comment-1',
      author: 'chartman',
      content: '수급은 괜찮은데 반도체 업황 확인은 더 필요해 보입니다.',
      createdAt: '2026-05-10T14:35:00+09:00',
    },
    {
      id: 'demo-comment-2',
      author: 'swing01',
      content: '저도 비슷하게 보고 있습니다. 8만 원 돌파 여부가 중요할 듯합니다.',
      createdAt: '2026-05-10T14:42:00+09:00',
    },
  ],
  createdAt: '2026-05-10T14:32:00+09:00',
};

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

function toSummary(post) {
  return {
    postId: String(post.postId),
    title: post.title ?? '',
    author: post.author ?? '익명',
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

function ComposeDialog({ loginId, holdings, onClose, onSubmit, isSubmitting }) {
  const [selectedHoldingCode, setSelectedHoldingCode] = useState(holdings[0]?.stockCode ?? '');
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
    <div className="modal-backdrop" role="presentation" onClick={isSubmitting ? undefined : onClose}>
      <div
        className="trade-modal board-composer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="board-compose-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="trade-modal-head">
          <div>
            <p className="trade-modal-eyebrow">게시글 작성</p>
            <h3 id="board-compose-title">글쓰기</h3>
          </div>
          <button type="button" className="trade-close" onClick={onClose} disabled={isSubmitting}>
            ×
          </button>
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
              rows="8"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="매매 근거와 의견을 입력하세요"
              disabled={isSubmitting}
            />
          </label>

          {errorMessage ? <p className="board-inline-feedback error">{errorMessage}</p> : null}

          <div className="trade-modal-actions">
            <button type="button" className="secondary" onClick={onClose} disabled={isSubmitting}>
              취소
            </button>
            <button type="submit" className="primary buy" disabled={isSubmitting}>
              {isSubmitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      </div>
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
  const demoPosts = useMemo(() => [toSummary(DEMO_POST)], []);

  const filteredPosts = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return posts.filter((post) => {
      if (!keyword) {
        return true;
      }

      const target = `${post.title} ${post.author} ${post.stockName} ${post.stockCode}`.toLowerCase();
      return target.includes(keyword);
    });
  }, [posts, searchTerm]);

  async function loadPosts(signal) {
    setIsLoadingPosts(true);
    setErrorMessage('');

    try {
      const nextPosts = await fetchPosts(signal);
      const resolvedPosts = nextPosts.length || !USE_DEMO_POST_FALLBACK ? nextPosts : demoPosts;
      setPosts(resolvedPosts);

      if (!nextPosts.length && USE_DEMO_POST_FALLBACK) {
        setFeedbackMessage('테스트용 더미 게시글을 표시하고 있습니다.');
      } else {
        setFeedbackMessage('');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        if (USE_DEMO_POST_FALLBACK) {
          setPosts(demoPosts);
          setFeedbackMessage('API 연결 전이라 테스트용 더미 게시글을 표시하고 있습니다.');
          setErrorMessage('');
          return;
        }

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

    if (USE_DEMO_POST_FALLBACK && postId === DEMO_POST.postId) {
      setSelectedPost(DEMO_POST);
      setIsLoadingDetail(false);
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
    const controller = new AbortController();
    loadPostDetail(selectedPostId, controller.signal);
    return () => controller.abort();
  }, [fetchPostDetail, selectedPostId]);

  function handleSearchSubmit(event) {
    event.preventDefault();

    if (!filteredPosts.length) {
      return;
    }

    setSelectedPostId(filteredPosts[0].postId);
  }

  function handleBackToList() {
    setSelectedPostId('');
    setSelectedPost(null);
    setCommentDraft('');
    setErrorMessage('');
  }

  async function refreshSelectedPost(postId) {
    if (USE_DEMO_POST_FALLBACK && postId === DEMO_POST.postId) {
      setSelectedPost({ ...DEMO_POST });
      return;
    }

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
        setSelectedPostId(String(createdId));
        await refreshSelectedPost(String(createdId));
      } else {
        await loadPosts();
      }

      setIsComposerOpen(false);
      setFeedbackMessage('게시글이 등록되었습니다.');
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
      await refreshSelectedPost(selectedPostId);
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
      await refreshSelectedPost(selectedPostId);
      setCommentDraft('');
      setFeedbackMessage('댓글이 등록되었습니다.');
    } catch (error) {
      setErrorMessage(getErrorMessage(error, '댓글 등록에 실패했습니다.'));
    } finally {
      setIsSubmittingComment(false);
    }
  }

  const selectedLiked = selectedPost?.likedUsers?.includes(loginId);

  return (
    <section className="board-shell">
      <header className="hero board-hero">
        <div>
          <p className="eyebrow">커뮤니티</p>
          <h1>게시판</h1>
        </div>
        <button type="button" className="board-compose-button" onClick={() => setIsComposerOpen(true)}>
          글쓰기
        </button>
      </header>

      <section className="board-detail-panel board-full-panel">
        {!selectedPostId ? (
          <>
            <form className="board-search" onSubmit={handleSearchSubmit}>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="제목, 작성자, 종목 검색"
              />
            </form>

            {errorMessage ? <p className="board-inline-feedback error">{errorMessage}</p> : null}
            {feedbackMessage ? <p className="board-inline-feedback">{feedbackMessage}</p> : null}

            <div className="board-list board-content-fill">
              {isLoadingPosts ? (
                <div className="board-empty-state">
                  <strong>게시글을 불러오는 중입니다.</strong>
                </div>
              ) : filteredPosts.length ? (
                filteredPosts.map((post) => (
                  <button
                    key={post.postId}
                    type="button"
                    className="board-post-card board-title-item"
                    onClick={() => setSelectedPostId(post.postId)}
                  >
                    <strong>{post.title}</strong>
                  </button>
                ))
              ) : (
                <div className="board-empty-state">
                  <strong>표시할 게시글이 없습니다.</strong>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="board-detail-nav">
              <button type="button" className="board-back-button" onClick={handleBackToList}>
                뒤로가기
              </button>
            </div>

            {errorMessage ? <p className="board-inline-feedback error">{errorMessage}</p> : null}
            {feedbackMessage ? <p className="board-inline-feedback">{feedbackMessage}</p> : null}

            {isLoadingDetail ? (
              <div className="board-empty-state board-empty-fill">
                <strong>상세 내용을 불러오는 중입니다.</strong>
              </div>
            ) : selectedPost ? (
              <>
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
                    <span>{selectedPost.position || '일반'}</span>
                    <span>{selectedPost.stockName || '종목 없음'}</span>
                    <span>{selectedPost.stockCode || '-'}</span>
                    <span>{formatYield(selectedPost.yield ?? 0)}</span>
                  </div>

                  <button
                    type="button"
                    className={`board-like-button ${selectedLiked ? 'active' : ''}`}
                    onClick={handleToggleLike}
                    disabled={isSubmittingLike}
                  >
                    {isSubmittingLike ? '처리 중...' : `추천 ${selectedPost.likeCount ?? 0}`}
                  </button>
                </div>

                <div className="board-article-scroll">
                  <article className="board-article-card">
                    <section className="board-content-section">
                      <div className="board-section-head">
                        <h3>본문</h3>
                      </div>
                      <div className="board-content-box">
                        <p>{selectedPost.content || '내용이 없습니다.'}</p>
                      </div>
                    </section>

                    <section className="board-comments-block board-comments-section">
                      <div className="board-comments-head board-section-head">
                        <h3>댓글</h3>
                        <span className="board-liked-users">{selectedPost.comments?.length ?? 0}개</span>
                      </div>

                      <div className="board-comments-list">
                        {selectedPost.comments?.length ? (
                          selectedPost.comments.map((comment) => (
                            <article key={comment.id} className="board-comment-card">
                              <div className="board-comment-head">
                                <strong>{comment.author}</strong>
                                <span className="board-detail-date">{formatDate(comment.createdAt)}</span>
                              </div>
                              <p>{comment.content}</p>
                            </article>
                          ))
                        ) : (
                          <p className="board-empty">아직 댓글이 없습니다.</p>
                        )}
                      </div>
                    </section>
                  </article>
                </div>

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
              </>
            ) : (
              <div className="board-empty-state board-empty-fill">
                <strong>게시글을 불러오지 못했습니다.</strong>
              </div>
            )}
          </>
        )}
      </section>

      {isComposerOpen ? (
        <ComposeDialog
          loginId={loginId}
          holdings={holdings}
          onClose={() => setIsComposerOpen(false)}
          onSubmit={handleCreatePost}
          isSubmitting={isSubmittingPost}
        />
      ) : null}
    </section>
  );
}
