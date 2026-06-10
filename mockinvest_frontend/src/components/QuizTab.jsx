import { useMemo, useState } from 'react';

function normalizeQuizItem(rawQuiz, index) {
  const question =
    String(rawQuiz.question ?? rawQuiz.quiz ?? rawQuiz.prompt ?? rawQuiz.word ?? '').trim() ||
    `문제 ${index + 1}`;
  const answer = String(rawQuiz.answer ?? rawQuiz.correctAnswer ?? rawQuiz.solution ?? '').trim();

  return {
    id: String(rawQuiz.id ?? rawQuiz.quizId ?? `quiz-${index + 1}`),
    question,
    answer,
    hint: String(rawQuiz.hint ?? '').trim(),
  };
}

function isCorrectAnswer(input, answer) {
  return input.trim().toLowerCase() === answer.trim().toLowerCase();
}

const QUIZ_TYPES = [
  { key: 'BASIC', label: '기초용어', description: '주식 입문자가 먼저 알아야 할 기본 용어' },
  { key: 'TRADING', label: '매매용어', description: '매수/매도와 차트 매매에서 자주 쓰는 용어' },
  { key: 'ANALYSIS', label: '기업 분석 용어', description: '재무제표와 밸류에이션 관련 핵심 표현' },
  { key: 'NEWS', label: '주식 뉴스 용어', description: '시장 뉴스에서 자주 등장하는 용어' },
  { key: 'COMMUNITY', label: '커뮤니티 용어', description: '커뮤니티/게시판에서 쓰는 실전 표현' },
  { key: 'RANDOM', label: '랜덤', description: '모든 카테고리에서 무작위 출제' },
];

export default function QuizTab({ fetchQuizzes, completeMission }) {
  const [viewMode, setViewMode] = useState('landing');
  const [quizzes, setQuizzes] = useState([]);
  const [selectedType, setSelectedType] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerInput, setAnswerInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [score, setScore] = useState(0);
  const [isSolved, setIsSolved] = useState(false);
  const [isQuizMissionCompleted, setIsQuizMissionCompleted] = useState(false);
  const [isHintVisible, setIsHintVisible] = useState(false);

  const currentQuiz = quizzes[currentIndex] ?? null;
  const progressText = useMemo(() => {
    if (!quizzes.length) {
      return '0 / 0';
    }

    return `${currentIndex + 1} / ${quizzes.length}`;
  }, [currentIndex, quizzes.length]);

  async function enterQuizByType(typeKey) {
    const controller = new AbortController();
    setIsLoading(true);
    setErrorMessage('');
    setSelectedType(typeKey);

    try {
      const payload = await fetchQuizzes(controller.signal, typeKey);
      const normalized = Array.isArray(payload) ? payload.map(normalizeQuizItem) : [];
      const filtered = normalized.filter((quiz) => quiz.question && quiz.answer);

      setQuizzes(filtered);
      setCurrentIndex(0);
      setAnswerInput('');
      setScore(0);
      setFeedback('');
      setIsSolved(false);
      setIsHintVisible(false);
      setViewMode('quiz');
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setErrorMessage(error instanceof Error ? error.message : '퀴즈를 불러오지 못했습니다.');
      }
    } finally {
      setIsLoading(false);
      controller.abort();
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!currentQuiz || !answerInput.trim()) {
      return;
    }

    const correct = isCorrectAnswer(answerInput, currentQuiz.answer);

    if (correct) {
      setFeedback('정답입니다!');
      setScore((current) => current + (isSolved ? 0 : 1));
      setIsSolved(true);

      if (!isSolved && !isQuizMissionCompleted && typeof completeMission === 'function') {
        try {
          await completeMission('QUIZ');
          setIsQuizMissionCompleted(true);
        } catch (error) {
          console.error('퀴즈 미션 완료 처리 실패:', error);
        }
      }
      return;
    }

    setFeedback('오답입니다. 다시 시도해보세요.');
  }

  function handleNext() {
    if (!quizzes.length) {
      return;
    }

    const nextIndex = currentIndex + 1;

    if (nextIndex >= quizzes.length) {
      setFeedback('모든 퀴즈를 완료했습니다.');
      return;
    }

    setCurrentIndex(nextIndex);
    setAnswerInput('');
    setFeedback('');
    setIsSolved(false);
    setIsHintVisible(false);
  }

  function handleOpenTypeSelect() {
    setViewMode('type-select');
    setErrorMessage('');
  }

  function handleBackToLanding() {
    setViewMode('landing');
    setErrorMessage('');
  }

  function handleBackToTypeSelect() {
    setViewMode('type-select');
    setErrorMessage('');
  }

  function handleToggleHint() {
    setIsHintVisible((current) => !current);
  }

  if (isLoading) {
    return (
      <section className="quiz-shell">
        <div className="quiz-card">
          <strong>퀴즈를 불러오는 중입니다.</strong>
        </div>
      </section>
    );
  }

  if (errorMessage && viewMode === 'quiz') {
    return (
      <section className="quiz-shell">
        <div className="quiz-card">
          <strong>퀴즈 로딩 실패</strong>
          <p>{errorMessage}</p>
          <div className="quiz-actions">
            <button type="button" onClick={handleBackToTypeSelect}>
              퀴즈 종류 다시 선택
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (viewMode === 'landing') {
    return (
      <section className="quiz-shell quiz-intro-shell">
        <article className="quiz-card quiz-preview-card quiz-intro-card">
          <header className="hero quiz-hero quiz-intro-hero">
            <div>
              <h1>주식 용어 퀴즈</h1>
              <p className="quiz-preview-description">전문적 용어부터 커뮤니티 용어까지 알아보세요</p>
            </div>
          </header>

          <div className="quiz-actions quiz-intro-actions">
            <button type="button" onClick={handleOpenTypeSelect}>
              퀴즈 풀기
            </button>
          </div>
        </article>
      </section>
    );
  }

  if (viewMode === 'type-select') {
    return (
      <section className="quiz-shell quiz-intro-shell">
        <header className="hero quiz-hero quiz-intro-hero">
          <div>
            <h1>퀴즈 종류 선택</h1>
          </div>
        </header>

        {errorMessage ? <p className="board-inline-feedback error">{errorMessage}</p> : null}

        <article className="quiz-card quiz-preview-card quiz-intro-card">
          <div className="quiz-type-grid">
            {QUIZ_TYPES.map((type) => (
              <button key={type.key} type="button" className="quiz-type-button" onClick={() => enterQuizByType(type.key)}>
                <strong>{type.label}</strong>
                <span>{type.description}</span>
              </button>
            ))}
          </div>

          <div className="quiz-actions quiz-intro-actions">
            <button type="button" onClick={handleBackToLanding}>
              이전
            </button>
          </div>
        </article>
      </section>
    );
  }

  if (!currentQuiz) {
    return (
      <section className="quiz-shell">
        <div className="quiz-card">
          <strong>등록된 퀴즈가 없습니다.</strong>
          <p>{'선택한 퀴즈 종류에 문제가 없거나 아직 등록되지 않았습니다.'}</p>
          <div className="quiz-actions">
            <button type="button" onClick={handleBackToTypeSelect}>
              퀴즈 종류 다시 선택
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="quiz-shell">
      <header className="hero quiz-hero">
        <div>
          <h1>단어 퀴즈</h1>
          <p className="quiz-preview-description">{`선택한 종류: ${selectedType || 'MIX'}`}</p>
        </div>
        <div className="quiz-progress">
          <span>{progressText}</span>
          <strong>{`점수 ${score}`}</strong>
        </div>
      </header>

      <article className="quiz-card">
        <p className="quiz-question-label">문제</p>
        <h2>{currentQuiz.question}</h2>

        {currentQuiz.hint ? (
          <div className="quiz-hint-block">
            <button type="button" className="quiz-hint-toggle" onClick={handleToggleHint}>
              {isHintVisible ? '힌트 숨기기' : '힌트 보기'}
            </button>
            {isHintVisible ? <p className="quiz-hint-text">{currentQuiz.hint}</p> : null}
          </div>
        ) : null}

        <form className="quiz-form" onSubmit={handleSubmit}>
          <input
            type="text"
            value={answerInput}
            onChange={(event) => setAnswerInput(event.target.value)}
            placeholder="정답을 입력하세요"
            disabled={isSolved}
          />
          <button type="submit" disabled={!answerInput.trim() || isSolved}>
            정답 확인
          </button>
        </form>

        {feedback ? <p className={`quiz-feedback ${isSolved ? 'success' : 'error'}`}>{feedback}</p> : null}

        <div className="quiz-actions quiz-next-actions">
          <button type="button" onClick={handleNext}>
            다음 문제
          </button>
        </div>
      </article>
    </section>
  );
}
