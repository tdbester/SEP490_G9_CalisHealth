import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../Modal";
import "./ExerciseModals.css";

const CHECKLIST_KEYS = [
  "member.cameraCheck.checklist1",
  "member.cameraCheck.checklist2",
  "member.cameraCheck.checklist3",
];

const CameraIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <circle cx="12" cy="12.5" r="3.5" />
  </svg>
);

const CAMERA_MESSAGE_KEYS = {
  loading: "member.cameraCheck.msgLoading",
  denied: "member.cameraCheck.msgDenied",
  unsupported: "member.cameraCheck.msgUnsupported",
  error: "member.cameraCheck.msgError",
};

/**
 * Popup căn khung camera trước khi tập.
 * `bodyDetected` sẽ do MediaPipe Pose cung cấp; hiện chưa nối nên mặc định false.
 */
export default function CameraCheckModal({ bodyDetected = false, onReady, onUpload, onClose }) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const [camera, setCamera] = useState("loading");

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera("unsupported");
      return undefined;
    }
    let stream;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((media) => {
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = media;
        if (videoRef.current) videoRef.current.srcObject = media;
        setCamera("on");
      })
      .catch((err) => {
        if (!cancelled) setCamera(err.name === "NotAllowedError" ? "denied" : "error");
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <Modal title={t("member.cameraCheck.title")} titleIcon={CameraIcon} onClose={onClose} width={600}>
      <div className="exm-camera">
        <video ref={videoRef} autoPlay muted playsInline hidden={camera !== "on"} />
        {camera !== "on" && (
          <p className="exm-camera-msg" role={camera === "loading" ? "status" : "alert"}>
            {t(CAMERA_MESSAGE_KEYS[camera] || CAMERA_MESSAGE_KEYS.error)}
          </p>
        )}

        <div className="exm-frame" aria-hidden="true">
          <svg className="exm-silhouette" viewBox="0 0 96 243">
            <circle cx="48" cy="15" r="13.5" />
            <path d="M24 42h48l10 70-14 4-6-40-4 80 8 82H52l-4-70-4 70H30l8-82-4-80-6 40-14-4z" />
          </svg>
          <div className="exm-distance">
            <span className="exm-distance-dot" />
            <span className="exm-distance-line" />
            <span className="exm-distance-label">{t("member.cameraCheck.distanceLabel")}</span>
            <span className="exm-distance-line" />
            <span className="exm-distance-dot" />
          </div>
        </div>

        <span className="exm-badge exm-badge--info">{t("member.cameraCheck.distanceHint")}</span>
        <span
          className={`exm-badge exm-badge--bottom ${bodyDetected ? "exm-badge--ok" : "exm-badge--warn"}`}
          role="status"
        >
          <span className="exm-badge-dot" aria-hidden="true" />
          {bodyDetected ? t("member.cameraCheck.fullBodyDetected") : t("member.cameraCheck.fullBodyNotDetected")}
        </span>
      </div>

      <ul className="exm-checklist">
        {CHECKLIST_KEYS.map((key) => (
          <li key={key}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            {t(key)}
          </li>
        ))}
      </ul>

      <button type="button" className="mdl-primary" onClick={onReady}>
        {t("member.cameraCheck.readyStartCounting")}
      </button>

      <p className="exm-alt">
        {t("member.cameraCheck.or")}{" "}
        <button type="button" className="exm-link" onClick={onUpload}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 19V5M6 11l6-6 6 6" />
          </svg>
          {t("member.cameraCheck.uploadFromDevice")}
        </button>
      </p>
    </Modal>
  );
}
