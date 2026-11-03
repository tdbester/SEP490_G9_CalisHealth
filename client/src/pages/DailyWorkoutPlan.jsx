import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { memberScheduleApi } from '../api/memberSchedule';
import './DailyWorkoutPlan.css';

function formatDate() {
  const today = new Date();
  return today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: '2-digit',
  });
}

/** "Wed" — nhãn ngắn cho thẻ "Scheduled" của workout. */
function shortWeekday(iso) {
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? 'Today'
    : date.toLocaleDateString('en-US', { weekday: 'short' });
}

/** "3 sets × 12 reps · Chest · Arms" — HOLD hiển thị giây thay vì số lần. */
function exerciseSummary(exercise) {
  const count =
    exercise.category === 'HOLD'
      ? `${exercise.durationSeconds ?? 0}s`
      : `${exercise.reps ?? 0} reps`;
  const muscles = exercise.muscleGroup ? ` · ${exercise.muscleGroup}` : '';
  return `${exercise.sets} sets × ${count}${muscles}`;
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
  const [workouts, setWorkouts] = useState([]);
  /** Có lịch tháng này không — phân biệt "Rest day" với "chưa xếp lịch". */
  const [hasSchedule, setHasSchedule] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        setWorkouts(Array.isArray(today) ? today : []);
        setHasSchedule(Boolean(month));
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load today's plan. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  /** Mở màn Exercise detail, giữ cấu hình hiệp/lần của buổi tập và vị trí bài trong buổi. */
  const openExercise = (workout, exercise, index) => {
    navigate(`/exercises/${encodeURIComponent(exercise.exerciseCode)}`, {
      state: {
        sets: exercise.sets,
        reps: exercise.reps,
        durationSeconds: exercise.durationSeconds,
        restSeconds: exercise.restSeconds,
        index: index + 1,
        total: workout.exercises.length,
      },
    });
  };

  /** Start workout: vào bài đầu tiên của buổi tập hôm nay. */
  const startWorkout = (workout) => {
    if (!workout.exercises?.length) return;
    openExercise(workout, workout.exercises[0], 0);
  };

  const header = (
    <div className="plan-header">
      <div className="plan-date">{formatDate()}</div>
      <h1 className="plan-title">Today&apos;s plan</h1>
    </div>
  );

  if (loading) {
    return (
      <div className="daily-plan-page">
        <div className="daily-plan-container">
          {header}
          <div className="daily-plan-status" role="status">
            Loading...
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
              Try again
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
            <span className="rest-card__eyebrow">REST DAY</span>
            <h2 className="rest-card__title">Take a breath today</h2>
            <p className="rest-card__text">
              Nothing is scheduled for today. Recovery is part of the plan — your
              muscles grow while you rest.
            </p>

            <div className="rest-card__actions">
              <button
                type="button"
                className="rest-card__btn rest-card__btn--primary"
                onClick={() => navigate('/library')}
              >
                Explore the exercise library
                <ArrowIcon />
              </button>
              <button
                type="button"
                className="rest-card__btn rest-card__btn--ghost"
                onClick={() => navigate('/schedule')}
              >
                Reschedule a workout
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
              <h3 className="rest-tip__title">Light movement</h3>
              <p className="rest-tip__text">
                A short walk or gentle stretching keeps blood flowing without
                adding fatigue.
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
              <h3 className="rest-tip__title">Hydrate &amp; eat well</h3>
              <p className="rest-tip__text">
                Protein and water today set up a stronger session tomorrow.
              </p>
            </article>

            <article className="rest-tip">
              <span className="rest-tip__icon">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <h3 className="rest-tip__title">Sleep it off</h3>
              <p className="rest-tip__text">
                7–9 hours of sleep is where the real adaptation happens.
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
            <h2 className="empty-state-title">No plan for this month yet</h2>
            <p className="empty-state-text">
              Pick which days you want to train and we&apos;ll build your daily
              plan around them.
            </p>
            <button
              type="button"
              className="empty-state-cta"
              onClick={() => navigate('/schedule')}
            >
              Pick your workout days
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

        {workouts.map((workout) => (
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
                  {workout.category === 'SKILL' ? 'Skill' : 'Health'}
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
                    <div className="stat-label">Time estimated</div>
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
                    <div className="stat-label">Exercises</div>
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
                    <div className="stat-label">Scheduled</div>
                    <div className="stat-value">{shortWeekday(workout.date)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="exercises-section">
              <h3 className="exercises-title">Exercises</h3>
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
                      <span className="exercise-details">{exerciseSummary(exercise)}</span>
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
                Start workout
              </button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
