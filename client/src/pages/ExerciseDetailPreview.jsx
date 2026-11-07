import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { libraryApi } from "../api/client";
import { mediaUrl } from "../api/contentManager";
import VideoDemoModal from "../components/exercise/VideoDemoModal";
import CameraCheckModal from "../components/exercise/CameraCheckModal";
import UploadVideoModal from "../components/exercise/UploadVideoModal";
import { startWorkoutSession } from "../utils/workoutResults";
import { resolveExerciseCategory } from "../utils/libraryWorkout";
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
  const { t } = useTranslation();
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [exercise, setExercise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // null | "video" | "camera" | "upload"
  const [activeModal, setActiveModal] = useState(null);
  const closeModal = () => setActiveModal(null);

  /**
   * Member mở bài từ thư viện (không có `index` trong route state) -> đây là
   * buổi tập lẻ, bắt đầu phiên tích lũy kết quả mới.
   */
  useEffect(() => {
    if (state?.index) return;
    startWorkoutSession();
  }, [state?.index]);

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
            ? t("member.preview.notAvailable")
            : t("member.preview.loadFailed"),
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
              {t("member.preview.back")}
            </button>
          </div>
          <div className="exd-status" role={error ? "alert" : "status"}>
            {loading ? t("member.preview.loading") : error}
          </div>
        </div>
      </div>
    );
  }

  // Bài mở từ kế hoạch ngày / từ workout trong thư viện đều truyền kèm
  // `category` (HOLD | REPS) trong route state -> ưu tiên giá trị này.
  // Bài mở lẻ không có state thì suy ra từ cấu hình mặc định của chính bài đó.
  const category = state?.category || resolveExerciseCategory(exercise);
  const isHold = category === "HOLD";
  const steps = splitGuide(exercise.guide);
  const muscles = splitMuscles(exercise.muscleGroup);
  const rest = state?.restSeconds ?? DEFAULT_REST_SECONDS;
  // Buổi tập hôm nay truyền cấu hình riêng (sets/reps/hold) qua route state; xem từ thư viện thì dùng mặc định của bài.
  const sets = state?.sets ?? exercise.defaultSets;
  const reps = state?.reps ?? exercise.defaultReps;
  const hold = state?.durationSeconds ?? exercise.duration;
  const stats = [
    { label: t("member.preview.sets"), value: sets ?? "—" },
    isHold
      ? { label: t("member.preview.hold"), value: hold != null ? `${hold}s` : "—" }
      : { label: t("member.preview.repsPerSet"), value: reps ?? "—" },
    { label: t("member.preview.rest"), value: `${rest}s` },
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
              {t("member.preview.exerciseOf", { index: state.index, total: state.total })}
            </span>
          )}
        </div>

        <div className="exd-grid">
          <div className="exd-main">
            <div className="exd-video">
              <span className="exd-video-tag">{t("member.preview.demoVideo")}</span>
              {videoSrc ? (
                <video src={videoSrc} muted preload="metadata" aria-hidden="true" />
              ) : (
                <div className="exd-video-empty">
                  <div className="exd-play" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <p>{t("member.preview.noDemoVideoYet")}</p>
                </div>
              )}
              <button
                type="button"
                className="exd-video-open"
                aria-label={t("member.preview.openVideoAria", { name: exercise.name })}
                onClick={() => setActiveModal("video")}
              />
            </div>

            <section className="exd-card" aria-labelledby="exd-description">
              <h2 id="exd-description" className="exd-card-title">
                {t("member.preview.description")}
              </h2>
              <p className="exd-description">
                {exercise.description || t("member.preview.noDescriptionYet")}
              </p>
              {muscles.length > 0 && (
                <ul className="exd-chips" aria-label={t("member.preview.targetMuscles")}>
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
                {t("member.preview.guide")}
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
                <p className="exd-description">{t("member.preview.noGuideSteps")}</p>
              )}
            </section>

            <div className="exd-actions">
              <button type="button" className="exd-browse" onClick={() => setActiveModal("upload")}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" />
                </svg>
                <span className="exd-browse-label">{t("member.preview.browseFile")}</span>
              </button>
              <button type="button" className="exd-start" onClick={() => setActiveModal("camera")}>
                {t("member.preview.startWorkout")}
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
          // Bấm "Ready · Start counting" -> màn đếm reps thời gian thực.
          // `category` quyết định cách đo: HOLD (plank) tính theo giây + set,
          // REPS tính theo số lần. `nextExercises` là các bài còn lại trong
          // buổi tập — màn tracking dùng để chuyển sang bài tiếp theo.
          onReady={() =>
            navigate("/session/tracking", {
              state: {
                exerciseCode: code,
                exerciseName: exercise.name,
                category,
                sets,
                reps,
                durationSeconds: hold,
                restSeconds: rest,
                index: state?.index,
                total: state?.total,
                nextExercises: state?.nextExercises || [],
              },
            })
          }
        />
      )}
      {activeModal === "upload" && (
        <UploadVideoModal
          onClose={closeModal}
          // Chọn file video -> sang màn quét video để hệ thống chấm điểm.
          onAnalyze={(files) => {
            const picked = files?.[0];
            if (!picked) return;
            closeModal();
            navigate("/session/scan", {
              state: {
                exerciseCode: code,
                exerciseName: exercise.name,
                category,
                sets,
                reps,
                durationSeconds: hold,
                restSeconds: rest,
                index: state?.index,
                total: state?.total,
                nextExercises: state?.nextExercises || [],
              },
            });
          }}
        />
      )}
    </div>
  );
}
