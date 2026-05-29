import { useEffect, useMemo, useState } from 'react';

const DEFAULT_MISSIONS = [
  { key: 'BUY_STOCK', title: '매수하기', reward: 50000, unit: '회' },
  { key: 'SELL_STOCK', title: '매도하기', reward: 50000, unit: '회' },
  { key: 'QUIZ', title: '퀴즈 풀기', reward: 10000, unit: '회' },
  { key: 'LIKE_POST', title: '좋아요 누르기', reward: 5000, unit: '회' },
  { key: 'WRITE_POST', title: '게시글 작성하기', reward: 10000, unit: '회' },
  { key: 'WRITE_COMMENT', title: '댓글 작성하기', reward: 5000, unit: '회' },
  { key: 'MINI_GAME', title: '미니게임 플레이하기', reward: 15000, unit: '회' },
];

function toCurrency(value) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function getObjectByPath(source, pathCandidates) {
  for (const path of pathCandidates) {
    if (source && Object.prototype.hasOwnProperty.call(source, path)) {
      return source[path];
    }
  }
  return undefined;
}

function normalizeMissionStatus(rawData) {
  const source = rawData && typeof rawData === 'object' ? rawData : {};
  const list = Array.isArray(source.missions) ? source.missions : Array.isArray(source) ? source : [];
  const byType = Object.fromEntries(
    list
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const type = String(item.missionType ?? item.type ?? item.key ?? '').toUpperCase();
        return [type, item];
      }),
  );

  return DEFAULT_MISSIONS.map((mission) => {
    const rawMission = byType[mission.key] ?? source[mission.key] ?? {};
    const currentCountValue = Number(
      getObjectByPath(rawMission, ['count', 'progress', 'currentCount', 'doneCount']) ??
        getObjectByPath(source, [`${mission.key}Count`, `${mission.key}_count`]) ??
        0,
    );
    const currentCount = Number.isFinite(currentCountValue) && currentCountValue > 0 ? Math.floor(currentCountValue) : 0;
    const completedValue = getObjectByPath(rawMission, ['completed', 'isCompleted', 'done']) ??
      getObjectByPath(source, [`${mission.key}Completed`, `${mission.key}_completed`]);
    const claimedValue = getObjectByPath(rawMission, ['claimed', 'isClaimed']) ??
      getObjectByPath(source, [`${mission.key}Claimed`, `${mission.key}_claimed`]);
    const rewardValue =
      Number(getObjectByPath(rawMission, ['reward', 'rewardAmount', 'amount']) ?? mission.reward) || mission.reward;

    return {
      ...mission,
      currentCount,
      completed: typeof completedValue === 'boolean' ? completedValue : currentCount >= 1,
      claimed: Boolean(claimedValue),
      reward: rewardValue,
    };
  });
}

export default function MissionTab({ fetchMissions, claimMission }) {
  const [missions, setMissions] = useState(DEFAULT_MISSIONS.map((item) => ({ ...item, completed: false, claimed: false })));
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [workingKey, setWorkingKey] = useState('');

  async function loadMissions(signal) {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const payload = await fetchMissions(signal);
      setMissions(normalizeMissionStatus(payload));
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setErrorMessage(error instanceof Error ? error.message : '미션 정보를 불러오지 못했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    loadMissions(controller.signal);
    return () => controller.abort();
  }, []);

  function navigateToMissionPage(missionType) {
    const targetPathByMission = {
      BUY_STOCK: '/trading',
      SELL_STOCK: '/trading',
      QUIZ: '/quiz',
      LIKE_POST: '/board',
      WRITE_POST: '/board',
      WRITE_COMMENT: '/board',
      MINI_GAME: '/stock-game',
    };

    const targetPath = targetPathByMission[missionType];
    if (!targetPath || typeof window === 'undefined') {
      return;
    }

    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }

  async function handleClaim(missionType) {
    setWorkingKey(missionType);
    setFeedbackMessage('');
    setErrorMessage('');

    try {
      const message = await claimMission(missionType);
      setFeedbackMessage(typeof message === 'string' ? message : `${missionType} 보상을 수령했습니다.`);
      setMissions((currentMissions) =>
        currentMissions.map((mission) => {
          if (mission.key !== missionType) {
            return mission;
          }

          return {
            ...mission,
            claimed: true,
            completed: true,
          };
        }),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '보상 수령에 실패했습니다.');
    } finally {
      setWorkingKey('');
    }
  }

  const summary = useMemo(() => {
    const completedCount = missions.filter((item) => item.completed).length;
    const claimedAmount = missions.filter((item) => item.claimed).reduce((sum, item) => sum + item.reward, 0);
    return { completedCount, claimedAmount };
  }, [missions]);

  return (
    <section className="mission-shell">
      <header className="hero mission-hero">
        <div>
          <p className="eyebrow">데일리 미션</p>
          <h1>미션</h1>
        </div>
        <div className="mission-summary">
          <span>{`완료 ${summary.completedCount} / ${missions.length}`}</span>
          <strong>{`수령 보상 ${toCurrency(summary.claimedAmount)}`}</strong>
        </div>
      </header>

      {errorMessage ? <p className="board-inline-feedback error">{errorMessage}</p> : null}
      {feedbackMessage ? <p className="board-inline-feedback">{feedbackMessage}</p> : null}

      <div className="mission-grid">
        {missions.map((mission) => {
          const isWorking = workingKey === mission.key;
          const canClaim = mission.completed && !mission.claimed;

          return (
            <article key={mission.key} className={`mission-card ${mission.completed ? 'is-completed' : ''}`}>
              <div className="mission-card-head">
                <h2>{mission.title}</h2>
                <span className={mission.claimed ? 'claimed' : mission.completed ? 'completed' : ''}>
                  {mission.claimed ? '보상 수령 완료' : mission.completed ? '달성 완료' : '진행 중'}
                </span>
              </div>
              <p className="mission-reward">{`보상: ${toCurrency(mission.reward)}`}</p>

              <div className="mission-actions">
                <button
                  type="button"
                  className="mission-go-button"
                  onClick={() => navigateToMissionPage(mission.key)}
                >
                  이동하기
                </button>
                <button
                  type="button"
                  className="mission-claim-button"
                  onClick={() => handleClaim(mission.key)}
                  disabled={isLoading || isWorking || !canClaim}
                >
                  {mission.claimed ? '수령 완료' : '보상 수령'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
