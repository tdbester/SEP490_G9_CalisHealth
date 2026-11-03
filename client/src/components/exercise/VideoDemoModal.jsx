import Modal from "../Modal";
import "./ExerciseModals.css";

// Backend chưa lưu góc khớp / khớp trọng tâm, nên tạm map theo mã bài tập.
const FORM_HINTS = {
  squat: { angles: ["Knee · 90°"], joints: ["Hip", "Knee", "Ankle", "Shoulder"] },
};

const PlayIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 5v14l11-7z" />
  </svg>
);

export default function VideoDemoModal({ exercise, videoSrc, onClose }) {
  const hints = FORM_HINTS[String(exercise.code || "").toLowerCase()];

  return (
    <Modal title={`Video demo · ${exercise.name}`} titleIcon={PlayIcon} onClose={onClose} width={620}>
      <div className="exm-video">
        {videoSrc ? (
          <video src={videoSrc} controls autoPlay loop aria-label={`${exercise.name} demo video`} />
        ) : (
          <div className="exm-video-empty">
            <div className="exm-play" aria-hidden="true">
              {PlayIcon}
            </div>
            <p>No demo video yet</p>
          </div>
        )}
        {hints?.angles.map((angle) => (
          <span key={angle} className="exm-angle">
            {angle}
          </span>
        ))}
      </div>

      <p className="exm-notes">
        <strong>Notes: </strong>
        {exercise.description || "No notes yet."}
      </p>

      {hints && (
        <ul className="exm-joints" aria-label="Tracked joints">
          {hints.joints.map((joint) => (
            <li key={joint} className="exm-joint">
              {joint}
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="mdl-primary" onClick={onClose}>
        Got it, continue
      </button>
    </Modal>
  );
}
