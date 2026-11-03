import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { libraryApi } from "../api/client";
import { mediaUrl } from "../api/contentManager";
import VideoDemoModal from "../components/exercise/VideoDemoModal";
import CameraCheckModal from "../components/exercise/CameraCheckModal";
import UploadVideoModal from "../components/exercise/UploadVideoModal";
import "./ExerciseDetailPreview.css";

// Exercise has no rest field yet; the plan can pass one through route state.
const DEFAULT_REST_SECONDS = 60;

function splitGuide(guide) {
  return String(guide || "")
    .split("\n")
    .map((step) => step.trim())
    .filter(Boolean);
}

function splitMuscles(muscleGroup) {
  return String(muscleGroup || "")
    .split(/\s*[·,]\s*/)
    .filter(Boolean);
}

export default function ExerciseDetailPreview() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [exercise, setExercise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // null | "video" | "camera" | "upload"
  const [activeModal, setActiveModal] = useState(null);
  const closeModal = () => setActiveModal(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    libraryApi
      .exercise(code)
      .then((data) => !cancelled && setExercise(data))
      .catch((err) => {
        if (cancelled) return;
        setExercise(null);
        setError(
          err.response?.status === 404
            ? "This exercise is not available."
            : "Couldn't load this exercise. Please try again.",
        );
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [code]);

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/plan"));

  if (loading || !exercise) {
    return (
      <div className="exd-page">
        <div className="exd-container">
          <div className="exd-header">
            <button type="button" className="exd-back" onClick={goBack}>
              ← Back
            </button>
          </div>
          <div className="exd-status" role={error ? "alert" : "status"}>
            {loading ? "Loading..." : error}
          </div>
        </div>
      </div>
    );
  }

  const isHold = exercise.category === "HOLD";
  const steps = splitGuide(exercise.guide);
  const muscles = splitMuscles(exercise.muscleGroup);
  const rest = state?.restSeconds ?? DEFAULT_REST_SECONDS;
  // Buổi tập hôm nay truyền cấu hình riêng (sets/reps/hold) qua route state; xem từ thư viện thì dùng mặc định của bài.
  const sets = state?.sets ?? exercise.defaultSets;
  const reps = state?.reps ?? exercise.defaultReps;
  const hold = state?.durationSeconds ?? exercise.duration;
  const stats = [
    { label: "Sets", value: sets ?? "—" },
    isHold
      ? { label: "Hold", value: hold != null ? `${hold}s` : "—" }
      : { label: "Reps / set", value: reps ?? "—" },
    { label: "Rest", value: `${rest}s` },
  ];
  const videoSrc = mediaUrl(exercise.demoVideoUrl);

  return (
    <div className="exd-page">
      <div className="exd-container">
        <div className="exd-header">
          <button type="button" className="exd-back" onClick={goBack}>
            ← Back
          </button>
          <h1 className="exd-title">{exercise.name}</h1>
          {state?.index && state?.total && (
            <span className="exd-step">
              Exercise {state.index} of {state.total}
            </span>
          )}
        </div>

        <div className="exd-grid">
          <div className="exd-main">
            <div className="exd-video">
              <span className="exd-video-tag">Demo video</span>
              {videoSrc ? (
                <video src={videoSrc} muted preload="metadata" aria-hidden="true" />
              ) : (
                <div className="exd-video-empty">
                  <div className="exd-play" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <p>No demo video yet</p>
                </div>
              )}
              <button
                type="button"
                className="exd-video-open"
                aria-label={`Open ${exercise.name} demo video`}
                onClick={() => setActiveModal("video")}
              />
            </div>

            <section className="exd-card" aria-labelledby="exd-description">
              <h2 id="exd-description" className="exd-card-title">
                Description
              </h2>
              <p className="exd-description">
                {exercise.description || "No description yet."}
              </p>
              {muscles.length > 0 && (
                <ul className="exd-chips" aria-label="Target muscles">
                  {muscles.map((muscle) => (
                    <li key={muscle} className="exd-chip">
                      {muscle}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="exd-side">
            <div className="exd-stats">
              {stats.map((stat) => (
                <div key={stat.label} className="exd-stat">
                  <div className="exd-stat-value">{stat.value}</div>
                  <div className="exd-stat-label">{stat.label}</div>
                </div>
              ))}
            </div>

            <section className="exd-card" aria-labelledby="exd-guide">
              <h2 id="exd-guide" className="exd-card-title">
                Guide
              </h2>
              {steps.length > 0 ? (
                <ol className="exd-steps">
                  {steps.map((step, index) => (
                    <li key={`${index}-${step.slice(0, 12)}`} className="exd-step-item">
                      <span className="exd-step-num" aria-hidden="true">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="exd-description">No guide steps yet.</p>
              )}
            </section>

            <div className="exd-actions">
              <button type="button" className="exd-browse" onClick={() => setActiveModal("upload")}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" />
                </svg>
                <span className="exd-browse-label">Browse file</span>
              </button>
              <button type="button" className="exd-start" onClick={() => setActiveModal("camera")}>
                Start workout
              </button>
            </div>
          </aside>
        </div>
      </div>

      {activeModal === "video" && (
        <VideoDemoModal exercise={exercise} videoSrc={videoSrc} onClose={closeModal} />
      )}
      {activeModal === "camera" && (
        <CameraCheckModal
          onClose={closeModal}
          onUpload={() => setActiveModal("upload")}
          // Live counting screen isn't built yet; return to the plan for now.
          onReady={() => navigate("/plan")}
        />
      )}
      {activeModal === "upload" && (
        <UploadVideoModal
          onClose={closeModal}
          // MediaPipe processing isn't wired yet; hand the files over here when it is.
          onAnalyze={closeModal}
        />
      )}
    </div>
  );
}
