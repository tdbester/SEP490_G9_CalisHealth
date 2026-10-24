import dayjs from "dayjs";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import FitnessCenterRoundedIcon from "@mui/icons-material/FitnessCenterRounded";
import ModalShell from "../common/ModalShell";
import "./WorkoutLogModal.css";

function formatExerciseTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds ? `${minutes}m ${String(seconds).padStart(2, "0")}s` : `${minutes}m`;
}

/** Popup chi tiết một buổi tập (Workout log). `workout` = null thì popup đóng. */
export default function WorkoutLogModal({ workout, onClose }) {
  const exerciseCount = workout?.exercises.length ?? 0;
  const countLabel = `${exerciseCount} exercise${exerciseCount === 1 ? "" : "s"}`;

  return (
    <ModalShell open={workout != null} onClose={onClose} labelledBy="wlm-title" className="wlm">
      {workout && (
        <>
          <header className="wlm-head">
            <div>
              <span className="wlm-breadcrumb">Workout history / Workout log</span>
              <span className="wlm-date">
                {dayjs(workout.completedAt).format("DD MMMM YYYY · HH:mm")}
              </span>
              <h2 id="wlm-title" className="wlm-title">{workout.name}</h2>
            </div>
            <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
              <CloseRoundedIcon />
            </button>
          </header>

          <section className="wlm-total">
            <span className="wlm-total-icon">
              <FitnessCenterRoundedIcon />
            </span>
            <div>
              <span className="wlm-total-label">List total time</span>
              <strong className="wlm-total-value">{workout.durationMin} min</strong>
              <p className="wlm-total-note">{countLabel} completed in this workout list</p>
            </div>
          </section>

          <section>
            <h3 className="wlm-section-title">Exercise details</h3>
            <div className="wlm-table-head">
              <span>{countLabel} completed</span>
              <span>Total sets</span>
              <span>Reps / set</span>
              <span>Exercise time</span>
            </div>

            <ol className="wlm-list">
              {workout.exercises.map((exercise, index) => (
                <li key={exercise.name} className="wlm-row">
                  <span className="wlm-row-name">
                    <span className="wlm-row-index">{index + 1}</span>
                    {exercise.name}
                  </span>
                  <span className="wlm-row-stat" data-label="Total sets">
                    {exercise.sets}
                    <small>sets</small>
                  </span>
                  <span className="wlm-row-stat" data-label="Reps / set">
                    {exercise.reps}
                    <small>reps</small>
                  </span>
                  <span className="wlm-row-stat wlm-row-time" data-label="Exercise time">
                    {formatExerciseTime(exercise.durationSec)}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <button type="button" className="modal-primary-btn wlm-done" onClick={onClose}>
            Done
            <CheckRoundedIcon />
          </button>
        </>
      )}
    </ModalShell>
  );
}
