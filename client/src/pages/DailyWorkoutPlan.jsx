import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { memberScheduleApi } from '../api/memberSchedule';
import { startWorkoutSession, setWorkoutOrigin } from '../utils/workoutResults';
import {
  isDailyPlanCompleted,
  readDailyPlanProgress,
  setActiveDailyWorkout,
  syncDailyPlanWorkouts,
} from '../utils/dailyPlanProgress';
import DailyPlanCongrats from './DailyPlanCongrats';
import './DailyWorkoutPlan.css';

function formatDate(locale) {
  const today = new Date();
  return today.toLocaleDateString(locale || 'en-US', {
    weekday: 'long',
    month: 'short',
    day: '2-digit',
  });
}

/** "Wed" — nhãn ngắn cho thẻ "Scheduled" của workout. */
function shortWeekday(iso, locale, todayFallback) {
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? todayFallback
    : date.toLocaleDateString(locale || 'en-US', { weekday: 'short' });
}

/** "3 sets × 12 reps · Chest · Arms" — HOLD hiển thị giây thay vì số lần. */
function exerciseSummary(exercise, t) {
  const count =
    exercise.category === 'HOLD'
      ? t('member.plan.secondsUnit', { count: exercise.durationSeconds ?? 0 })
      : t('member.plan.repsUnit', { count: exercise.reps ?? 0 });
  const muscles = exercise.muscleGroup ? ` · ${exercise.muscleGroup}` : '';
  return `${t('member.plan.summarySets', { sets: exercise.sets, count })}${muscles}`;
}

/** Trăng khuyết: biểu tượng nghỉ ngơi / hồi phục. */
function RestIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M20 14.5A8.5 8.5 0 019.5 4a7 7 0 108.5 10.5 8.6 8.6 0 002 0z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M17 3.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" strokeLinejoin="round" />
    </svg>
  );
}

/** Lịch trống: biểu tượng chưa xếp lịch tháng. */
function EmptyPlanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="16" rx="3" strokeLinejoin="round" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
      <path d="M12 14v4M10 16h4" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M4 10h11M10.5 5.5L15 10l-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function DailyWorkoutPlan() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === 'vi' ? 'vi-VN' : 'en-US';
  const [workouts, setWorkouts] = useState([]);
  /** Có lịch tháng này không — phân biệt "Rest day" với "chưa xếp lịch". */
  const [hasSchedule, setHasSchedule] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /** Đã tập xong hết kế hoạch hôm nay -> hiện màn chúc mừng. */
  const [celebrating, setCelebrating] = useState(false);
  /** Tiến độ tập hôm nay (dùng để đánh dấu buổi tập đã xong). */
  const [progress, setProgress] = useState(() => readDailyPlanProgress());

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      memberScheduleApi.getTodayWorkouts(),
      // Không có lịch tháng → backend trả null, không phải lỗi.
      memberScheduleApi.getCurrentMonthSchedule().catch(() => null),
    ])
      .then(([today, month]) => {
        if (cancelled) return;
        const list = Array.isArray(today) ? today : [];
        setWorkouts(list);
        setHasSchedule(Boolean(month));
        // Đồng bộ danh sách buổi tập hôm nay để biết khi nào đã tập xong hết.
        syncDailyPlanWorkouts(list.map((item) => item.workoutCode));
        setProgress(readDailyPlanProgress());
        // Đã tập xong tất cả buổi tập hôm nay -> hiện màn chúc mừng.
        setCelebrating(isDailyPlanCompleted());
      })
      .catch(() => {
        if (!cancelled) setError(t('member.plan.loadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => load(), [load]);

  /**
   * Mở màn Exercise detail, giữ cấu hình hiệp/lần của buổi tập và vị trí bài trong buổi.
   *
   * `nextExercises` là các bài còn lại của buổi tập — màn tracking dùng để
   * chuyển sang bài tiếp theo khi member bấm "Finish".
   */
  const openExercise = (workout, exercise, index) => {
    // Vào bài đầu tiên của buổi -> bắt đầu phiên tập mới, xoá kết quả cũ
    // để màn kết quả cuối chỉ tổng hợp đúng các bài của buổi này.
    if (index === 0) {
      startWorkoutSession();
    }
    // Luôn ghi nhớ nơi bắt đầu và buổi tập đang thực hiện: màn kết quả cuối
    // buổi quay lại "/plan" và đánh dấu buổi tập này là đã hoàn thành.
    setWorkoutOrigin('/plan');
    setActiveDailyWorkout(
      workout.workoutCode,
      (workout.exercises || []).map((item) => item.exerciseCode),
    );
    navigate(`/exercises/${encodeURIComponent(exercise.exerciseCode)}`, {
      state: {
        sets: exercise.sets,
        reps: exercise.reps,
        durationSeconds: exercise.durationSeconds,
        restSeconds: exercise.restSeconds,
        index: index + 1,
        total: workout.exercises.length,
        nextExercises: workout.exercises.slice(index + 1).map((item) => ({
          exerciseCode: item.exerciseCode,
          exerciseName: item.exerciseName,
          category: item.category,
          sets: item.sets,
          reps: item.reps,
          durationSeconds: item.durationSeconds,
          restSeconds: item.restSeconds,
        })),
      },
    });
  };

  /**
   * Start workout: vào bài đầu tiên của buổi tập hôm nay.
   */
  const startWorkout = (workout) => {
    if (!workout.exercises?.length) return;
    openExercise(workout, workout.exercises[0], 0);
  };
  const header = (
    <div className="plan-header">
      <div className="plan-date">{formatDate(locale)}</div>
      <h1 className="plan-title">{t('member.plan.title')}</h1>
    </div>
  );

  if (loading) {
    return (
      <div className="daily-plan-page">
        <div className="daily-plan-container">
          {header}
          <div className="daily-plan-status" role="status">
            {t('member.plan.loading')}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="daily-plan-page">
        <div className="daily-plan-container">
          {header}
          <div className="daily-plan-status" role="alert">
            {error}
            <button type="button" className="daily-plan-retry" onClick={load}>
              {t('member.plan.tryAgain')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Rest day: không có buổi tập nào hôm nay nhưng tháng này đã có lịch.
   * Gợi ý member sang Library nếu vẫn muốn vận động.
   */
  if (workouts.length === 0 && hasSchedule) {
    return (
      <div className="daily-plan-page">
        <div className="daily-plan-container">
          {header}
          <div className="rest-card">
            <div className="rest-card__glow" aria-hidden="true" />
            <div className="rest-card__icon">
              <RestIcon />
            </div>
            <span className="rest-card__eyebrow">{t('member.plan.restDay')}</span>
            <h2 className="rest-card__title">{t('member.plan.restTitle')}</h2>
            <p className="rest-card__text">
              {t('member.plan.restText')}
            </p>

            <div className="rest-card__actions">
              <button
                type="button"
                className="rest-card__btn rest-card__btn--primary"
                onClick={() => navigate('/library')}
              >
                {t('member.plan.exploreLibrary')}
                <ArrowIcon />
              </button>
              <button
                type="button"
                className="rest-card__btn rest-card__btn--ghost"
                onClick={() => navigate('/schedule')}
              >
                {t('member.plan.reschedule')}
              </button>
            </div>
          </div>

          <div className="rest-tips">
            <article className="rest-tip">
              <span className="rest-tip__icon">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 12h4l2.5-6 4 12 2.5-6h5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <h3 className="rest-tip__title">{t('member.plan.tipLightMovement')}</h3>
              <p className="rest-tip__text">
                {t('member.plan.tipLightMovementText')}
              </p>
            </article>

            <article className="rest-tip">
              <span className="rest-tip__icon">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3c3 3.5 5 6 5 8.5A5 5 0 017 11.5C7 9 9 6.5 12 3z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M12 21v-4" strokeLinecap="round" />
                </svg>
              </span>
              <h3 className="rest-tip__title">{t('member.plan.tipHydrate')}</h3>
              <p className="rest-tip__text">
                {t('member.plan.tipHydrateText')}
              </p>
            </article>

            <article className="rest-tip">
              <span className="rest-tip__icon">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <h3 className="rest-tip__title">{t('member.plan.tipSleep')}</h3>
              <p className="rest-tip__text">
                {t('member.plan.tipSleepText')}
              </p>
            </article>
          </div>
        </div>
      </div>
    );
  }

  /** Chưa xếp lịch tháng này — không phải rest day, cần member tự xếp. */
  if (workouts.length === 0) {
    return (
      <div className="daily-plan-page">
        <div className="daily-plan-container">
          {header}
          <div className="empty-state">
            <div className="empty-state-icon">
              <EmptyPlanIcon />
            </div>
            <h2 className="empty-state-title">{t('member.plan.emptyMonthTitle')}</h2>
            <p className="empty-state-text">
              {t('member.plan.emptyMonthText')}
            </p>
            <button
              type="button"
              className="empty-state-cta"
              onClick={() => navigate('/schedule')}
            >
              {t('member.plan.pickWorkoutDays')}
              <ArrowIcon />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="daily-plan-page">
      <div className="daily-plan-container">
        {header}

        {/* Đã tập xong kế hoạch hôm nay -> màn chúc mừng, kèm nút về dashboard
            và nút gợi ý sang thư viện nếu member muốn tập thêm. */}
        {celebrating ? (
          <DailyPlanCongrats onReviewPlan={() => setCelebrating(false)} />
        ) : (
          workouts.map((workout) => (
          <section key={workout.workoutCode} className="plan-workout">
            <div className="workout-card">
              <h2 className="workout-title">{workout.workoutName}</h2>

              <div className="workout-badges">
                <div
                  className={`badge ${
                    workout.category === 'SKILL' ? 'badge-skill' : 'badge-health'
                  }`}
                >
                  <svg className="badge-icon" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  {workout.category === 'SKILL' ? t('member.plan.categorySkill') : t('member.plan.categoryHealth')}
                </div>
                {workout.workoutLevel && (
                  <div className="badge badge-level">
                    <svg className="badge-icon" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M8 2L10 6L14 7L11 10L12 14L8 12L4 14L5 10L2 7L6 6L8 2Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                    {workout.workoutLevel}
                  </div>
                )}
              </div>

              <div className="workout-stats">
                <div className="stat-card">
                  <div className="stat-icon">
                    <svg viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6V12L16 14" />
                    </svg>
                  </div>
                  <div className="stat-content">
                    <div className="stat-label">{t('member.plan.timeEstimated')}</div>
                    <div className="stat-value">{workout.durationMinutes} min</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">
                    <svg viewBox="0 0 24 24">
                      <path d="M4 12L8 8L12 12L16 8L20 12" />
                    </svg>
                  </div>
                  <div className="stat-content">
                    <div className="stat-label">{t('member.plan.exercisesStat')}</div>
                    <div className="stat-value">{workout.exerciseCount}</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">
                    <svg viewBox="0 0 24 24">
                      <rect x="3" y="5" width="18" height="16" rx="2" />
                      <path d="M3 10H21" />
                    </svg>
                  </div>
                  <div className="stat-content">
                    <div className="stat-label">{t('member.plan.scheduled')}</div>
                    <div className="stat-value">
                      {shortWeekday(workout.date, locale, t('member.plan.todayFallback'))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="exercises-section">
              <h3 className="exercises-title">{t('member.plan.exercises')}</h3>
              <div className="exercise-list">
                {workout.exercises.map((exercise, index) => (
                  <button
                    type="button"
                    key={`${workout.workoutCode}-${exercise.exerciseCode}`}
                    className="exercise-card"
                    onClick={() => openExercise(workout, exercise, index)}
                  >
                    <span className="exercise-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M4 12L8 8L12 12L16 8L20 12" />
                      </svg>
                    </span>
                    <span className="exercise-info">
                      <span className="exercise-name">{exercise.exerciseName}</span>
                      <span className="exercise-details">{exerciseSummary(exercise, t)}</span>
                    </span>
                    <span className="exercise-chevron" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M9 6L15 12L9 18" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="start-button"
                onClick={() => startWorkout(workout)}
                disabled={workout.exercises.length === 0}
              >
                {progress.completed.includes(workout.workoutCode)
                  ? t('member.plan.replayWorkout')
                  : t('member.plan.startWorkout')}
              </button>
            </div>
          </section>
          ))
        )}
      </div>
    </div>
  );
}
