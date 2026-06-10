import { useEffect, useMemo, useState } from 'react';

const DEFAULT_MISSIONS = [
  { key: 'ATTENDANCE', title: '출석 체크', reward: 100000, path: '' },
  { key: 'BUY', title: '매수하기', reward: 100000, path: '/trading' },
  { key: 'SELL', title: '매도하기', reward: 100000, path: '/trading' },
  { key: 'QUIZ', title: '퀴즈 풀기', reward: 100000, path: '/quiz' },
  { key: 'LIKE', title: '추천 누르기', reward: 100000, path: '/board' },
  { key: 'POST', title: '게시글 작성하기', reward: 100000, path: '/board' },
  { key: 'COMMENT', title: '댓글 작성하기', reward: 100000, path: '/board' },
  { key: 'GAME', title: '미니게임 플레이하기', reward: 100000, path: '/stock-game' },
];

function toCurrency(value) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
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

function writeAttendanceClaimed(loginId) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(getAttendanceStorageKey(loginId), getTodayKey());
  } catch (_error) {
    // Ignore storage failures and keep UI responsive.
  }
}

function normalizeMissionStatus(rawData, loginId) {
  const attendanceClaimed = readAttendanceClaimed(loginId);
  if (!rawData) {
    return DEFAULT_MISSIONS.map((mission) =>
      mission.key === 'ATTENDANCE'
        ? { ...mission, completed: true, claimed: attendanceClaimed }
        : { ...mission, completed: false, claimed: false },
    );
  }

  return DEFAULT_MISSIONS.map((mission) => {
    if (mission.key === 'ATTENDANCE') {
      return {
        ...mission,
        completed: true,
        claimed: attendanceClaimed,
      };
    }

    const keyLower = mission.key.toLowerCase();
    return {
      ...mission,
      completed: !!rawData[`${keyLower}Completed`],
      claimed: !!rawData[`${keyLower}Claimed`],
    };
  });
}

export default function MissionTab({ fetchMissions, claimMission, loginId }) {
  const [missions, setMissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [workingKey, setWorkingKey] = useState('');

  async function loadMissions() {
    setIsLoading(true);
    try {
      const data = await fetchMissions();
      setMissions(normalizeMissionStatus(data, loginId));
    } catch (error) {
      console.error("미션 로드 실패:", error);
      setErrorMessage('미션 정보를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  function navigateToMissionPage(path) {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }

  useEffect(() => {
    loadMissions();
  }, [loginId]);

  async function handleClaim(missionKey) {
    setWorkingKey(missionKey);
    try {
      if (missionKey === 'ATTENDANCE') {
        writeAttendanceClaimed(loginId);
        setMissions((current) =>
          current.map((mission) => (mission.key === missionKey ? { ...mission, claimed: true } : mission)),
        );
        return;
      }

      await claimMission(missionKey);
      await loadMissions();
    } catch (error) {
      console.error("보상 수령 실패:", error);
      setErrorMessage('보상 수령에 실패했습니다.');
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
          <h1>일일 미션</h1>
          </div>
        <div className="mission-summary">
          <span>{`완료 ${summary.completedCount} / ${missions.length}`}</span>
          <strong>{`수령 보상 ${toCurrency(summary.claimedAmount)}`}</strong>
        </div>
      </header>

      {errorMessage && <p className="board-inline-feedback error">{errorMessage}</p>}

      <div className="mission-grid">
        {missions.map((mission) => (
          <article key={mission.key} className={`mission-card ${mission.claimed ? 'is-claimed' : ''}`}>
            {mission.claimed && (
              <div className="mission-complete-overlay" aria-hidden="true">
                <span>미션 완료</span>
              </div>
            )}
            <div className="mission-card-head">
              <h2>{mission.title}</h2>
              <span className={mission.claimed ? 'claimed' : mission.completed ? 'completed' : 'pending'}>
                {mission.claimed ? '보상 수령 완료' : mission.completed ? '달성 완료' : '진행 중'}
              </span>
            </div>
            <p className="mission-reward">{`보상: ${toCurrency(mission.reward)}`}</p>

            <div className={`mission-actions ${mission.path ? '' : 'mission-actions--single'}`.trim()}>
              {mission.path ? (
                <button type="button" className="mission-go-button" onClick={() => navigateToMissionPage(mission.path)}>
                  이동하기
                </button>
              ) : null}
              <button
                type="button"
                className={`mission-claim-button ${mission.completed && !mission.claimed ? 'is-claimable' : ''}`}
                onClick={() => handleClaim(mission.key)}
                disabled={isLoading || workingKey === mission.key || !mission.completed || mission.claimed}
              >
                {mission.claimed ? '수령 완료' : '보상 수령'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
