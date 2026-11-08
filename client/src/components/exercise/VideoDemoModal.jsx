import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const hints = FORM_HINTS[String(exercise.code || "").toLowerCase()];

  return (
    <Modal title={t("member.videoDemo.title", { name: exercise.name })} titleIcon={PlayIcon} onClose={onClose} width={620}>
      <div className="exm-video">
        {videoSrc ? (
          <video src={videoSrc} controls autoPlay loop aria-label={t("member.videoDemo.videoAria", { name: exercise.name })} />
        ) : (
          <div className="exm-video-empty">
            <div className="exm-play" aria-hidden="true">
              {PlayIcon}
            </div>
            <p>{t("member.videoDemo.noDemoVideo")}</p>
          </div>
        )}
        {hints?.angles.map((angle) => (
          <span key={angle} className="exm-angle">
            {angle}
          </span>
        ))}
      </div>

      <p className="exm-notes">
        <strong>{t("member.videoDemo.notesPrefix")}</strong>
        {exercise.description || t("member.videoDemo.noNotes")}
      </p>

      {hints && (
        <ul className="exm-joints" aria-label={t("member.videoDemo.trackedJoints")}>
          {hints.joints.map((joint) => (
            <li key={joint} className="exm-joint">
              {joint}
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="mdl-primary" onClick={onClose}>
        {t("member.videoDemo.gotIt")}
      </button>
    </Modal>
  );
}
