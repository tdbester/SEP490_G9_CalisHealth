import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { getLibraryOverview, getPersonalExerciseCounts } from "../api/library";
import { mockSystemWorkouts } from "./WorkoutSystemListPage";
import "./Library.css";

// Icons
function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l11-6.86a1 1 0 0 0 0-1.68l-11-6.86A1 1 0 0 0 8 5.14z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 6h2v2H4zm0 5h2v2H4zm0 5h2v2H4zm4-10h14v2H8zm0 5h14v2H8zm0 5h14v2H8z" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function Library() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryType = searchParams.get("type");

  if (queryType) {
    return <Navigate to={`/library/exercises?type=${queryType}`} replace />;
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [counts, setCounts] = useState({
    exercise: {
      healthCount: 0,
      skillCount: 0,
      memberCount: 0,
    },
    workout: {
      healthCount: 0,
      skillCount: 0,
      customCount: 0,
    },
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const [overviewResult, personalCountsResult] = await Promise.allSettled([
      getLibraryOverview(),
      getPersonalExerciseCounts(),
    ]);

    const overview = overviewResult.status === "fulfilled" ? overviewResult.value : null;
    const personalCounts = personalCountsResult.status === "fulfilled"
      ? personalCountsResult.value
      : null;
    const mockHealthWorkoutsCount = mockSystemWorkouts.filter((workout) => workout.type === "health").length;
    const mockSkillWorkoutsCount = mockSystemWorkouts.filter((workout) => workout.type === "skills").length;
    let hasMockPendingExercise = false;
    try {
      const mockPendingExercise = sessionStorage.getItem("calishealth.mock-resubmitted-exercise");
      hasMockPendingExercise = Boolean(mockPendingExercise && JSON.parse(mockPendingExercise));
    } catch (storageError) {
      console.warn("Unable to read mock exercise submission:", storageError);
    }

    if (overviewResult.status === "rejected") {
      console.error("Failed to load library summary:", overviewResult.reason);
      setError("Unable to load latest library statistics. Showing cached or default view.");
    }

    if (personalCountsResult.status === "rejected") {
      console.error("Failed to load personal exercise counts:", personalCountsResult.reason);
    }

    const pendingCount = Number(personalCounts?.pendingCount || 0) + Number(hasMockPendingExercise);
    const rejectedCount = Number(personalCounts?.rejectedCount || 0);
    const acceptedCount = Number(personalCounts?.acceptedCount || 0);
    const fallbackRejectedMockCount = rejectedCount === 0 && !hasMockPendingExercise ? 1 : 0;
    const totalPersonalExercises = personalCounts
      ? pendingCount + rejectedCount + acceptedCount + fallbackRejectedMockCount
      : Number(overview?.memberExercisesCount || 0) + Number(hasMockPendingExercise) + fallbackRejectedMockCount;

    setCounts({
      exercise: {
        healthCount: Number(overview?.healthExercisesCount || 0),
        skillCount: Number(overview?.skillExercisesCount || 0),
        memberCount: totalPersonalExercises,
      },
      workout: {
        healthCount: Number(overview?.healthWorkoutsCount || 0) || mockHealthWorkoutsCount,
        skillCount: Number(overview?.skillWorkoutsCount || 0) || mockSkillWorkoutsCount,
        customCount: Number(overview?.customWorkoutsCount || 0),
      },
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleNavigate = (path) => {
    navigate(path);
  };

  return (
    <div className="library-container">
      {/* 2. Tiêu đề trang */}
      <header className="library-header">
        <h1 className="library-title">Exercise &amp; Skill library</h1>
        <p className="library-description">Choose a section to open its list.</p>
      </header>

      {/* Error state alert */}
      {error && (
        <div className="library-error-banner" role="alert">
          <span>{error}</span>
          <button className="library-retry-btn" onClick={fetchData}>
            Retry
          </button>
        </div>
      )}

      {/* 3. Section 1: Exercise (Bài tập) */}
      <section className="library-section">
        <h2 className="section-title">Exercise</h2>

        <div className="section-grid">
          {/* Sub-header row: System exercise (span 2) and Member provided exercise (span 1) */}
          <div className="group-label group-label-system">System exercise</div>
          <div className="group-label group-label-member">Member provided exercise</div>

          {/* Card 1: Exercise for health */}
          <div className="library-card card-system-1">
            <div className="card-body">
              <div className="card-icon-badge play-icon">
                <PlayIcon />
              </div>
              <div className="card-title-row">
                <h3 className="card-title">Exercise for health</h3>
                {loading ? (
                  <div className="skeleton-pulse skeleton-text-count" />
                ) : (
                  <span className="card-count">
                    {counts.exercise.healthCount} exercises
                  </span>
                )}
              </div>
              <p className="card-description">
                Bodyweight exercises for general health and fitness.
              </p>
            </div>
            <div className="card-footer">
              <button
                type="button"
                className="card-view-btn"
                onClick={() =>
                  handleNavigate("/library/exercises?type=health")
                }
              >
                <span>View list</span>
                <ArrowRightIcon />
              </button>
            </div>
          </div>

          {/* Card 2: Exercise for skill */}
          <div className="library-card card-system-2">
            <div className="card-body">
              <div className="card-icon-badge play-icon">
                <PlayIcon />
              </div>
              <div className="card-title-row">
                <h3 className="card-title">Exercise for skill</h3>
                {loading ? (
                  <div className="skeleton-pulse skeleton-text-count" />
                ) : (
                  <span className="card-count">
                    {counts.exercise.skillCount} exercises
                  </span>
                )}
              </div>
              <p className="card-description">
                Exercises that build calisthenics skills.
              </p>
            </div>
            <div className="card-footer">
              <button
                type="button"
                className="card-view-btn"
                onClick={() =>
                  handleNavigate("/library/exercises?type=skill")
                }
              >
                <span>View list</span>
                <ArrowRightIcon />
              </button>
            </div>
          </div>

          {/* Card 3: Member provided exercise */}
          <div className="library-card card-member">
            <div className="card-body">
              <div className="card-icon-badge play-icon">
                <PlayIcon />
              </div>
              <div className="card-title-row">
                <h3 className="card-title">Member provided exercise</h3>
                {loading ? (
                  <div className="skeleton-pulse skeleton-text-count" />
                ) : (
                  <span className="card-count">
                    {counts.exercise.memberCount} exercises
                  </span>
                )}
              </div>
              <p className="card-description">Exercises you added yourself.</p>
            </div>
            <div className="card-footer">
              <button
                type="button"
                className="card-view-btn"
                onClick={() =>
                  handleNavigate("/library/community")
                }
              >
                <span>View list</span>
                <ArrowRightIcon />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Section 2: Workout (Giáo án/Buổi tập) */}
      <section className="library-section">
        <h2 className="section-title">Workout</h2>

        <div className="section-grid">
          {/* Sub-header row: System workout (span 2) and Custom workout (span 1) */}
          <div className="group-label group-label-system">System workout</div>
          <div className="group-label group-label-member">Custom workout</div>

          {/* Card 1: Workout for health */}
          <div className="library-card card-system-1">
            <div className="card-body">
              <div className="card-icon-badge list-icon">
                <ListIcon />
              </div>
              <div className="card-title-row">
                <h3 className="card-title">Workout for health</h3>
                {loading ? (
                  <div className="skeleton-pulse skeleton-text-count" />
                ) : (
                  <span className="card-count">
                    {counts.workout.healthCount} workouts
                  </span>
                )}
              </div>
              <p className="card-description">
                Built from exercises for health.
              </p>
            </div>
            <div className="card-footer">
              <button
                type="button"
                className="card-view-btn"
                onClick={() => handleNavigate("/library/workouts/system?type=health")}
              >
                <span>View list</span>
                <ArrowRightIcon />
              </button>
            </div>
          </div>

          {/* Card 2: Workout for skill */}
          <div className="library-card card-system-2">
            <div className="card-body">
              <div className="card-icon-badge list-icon">
                <ListIcon />
              </div>
              <div className="card-title-row">
                <h3 className="card-title">Workout for skill</h3>
                {loading ? (
                  <div className="skeleton-pulse skeleton-text-count" />
                ) : (
                  <span className="card-count">
                    {counts.workout.skillCount} workouts
                  </span>
                )}
              </div>
              <p className="card-description">
                Built from exercises for skill.
              </p>
            </div>
            <div className="card-footer">
              <button
                type="button"
                className="card-view-btn"
                onClick={() => handleNavigate("/library/workouts/system?type=skills")}
              >
                <span>View list</span>
                <ArrowRightIcon />
              </button>
            </div>
          </div>

          {/* Card 3: Custom workout */}
          <div className="library-card card-member">
            <div className="card-body">
              <div className="card-icon-badge list-icon">
                <ListIcon />
              </div>
              <div className="card-title-row">
                <h3 className="card-title">Custom workout</h3>
                {loading ? (
                  <div className="skeleton-pulse skeleton-text-count" />
                ) : (
                  <span className="card-count">
                    {counts.workout.customCount} workouts
                  </span>
                )}
              </div>
              <p className="card-description">
                System based or member provided workouts.
              </p>
            </div>
            <div className="card-footer">
              <button
                type="button"
                className="card-view-btn"
                onClick={() => handleNavigate("/library/custom")}
              >
                <span>View list</span>
                <ArrowRightIcon />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
