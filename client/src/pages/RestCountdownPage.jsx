import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SessionTopbar from "../components/session/SessionTopbar";
import VoiceToggleButton from "../components/session/VoiceToggleButton";
import "./RestCountdownPage.css";

/** Key lưu cấu hình phiên để sống sót khi F5 (location.state mất khi reload). */
const SESSION_CONFIG_KEY = "calishealth.tracking.session";
/** Key lưu các set đã hoàn thành khi member bấm "Continue" sang màn nghỉ. */
const COMPLETED_SETS_KEY = "calishealth.tracking.completedSets";
/** Key lưu số liệu set vừa xong để màn nghỉ hiển thị "Last set summary". */
const LAST_SET_KEY = "calishealth.tracking.lastSet";

/** Cỡ vòng tròn đếm ngược (px) — khớp Figma 551:1374 (280 x 280). */
const RING_SIZE = 280;
/** Bán kính vòng tròn. */
const RING_RADIUS = 122;

/** Đọc cấu hình phiên từ sessionStorage. */
function readSessionConfig() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_CONFIG_KEY) || "null") || {};
  } catch {
    return {};
  }
}

/** Đọc số liệu set vừa xong (reps / form / góc khớp) cho phần "Last set summary". */
function readLastSet() {
  try {
    return JSON.parse(sessionStorage.getItem(LAST_SET_KEY) || "null") || null;
  } catch {
    return null;
  }
}

/** Màu nhấn theo % form: >=80 xanh lá, >=60 hổ phách, <60 hồng. */
function formTone(score) {
  if (score == null) return "";
  if (score >= 80) return "is-good";
  if (score >= 60) return "is-warn";
  return "is-bad";
}

/**
 * Màn đếm ngược nghỉ giữa các set ("Rest between sets").
 *
 * Member bấm "Continue" ở màn tracking -> sang màn này -> hết giờ hoặc bấm
 * "Skip rest" để quay lại màn tracking và bắt đầu set tiếp theo.
 */
export default function RestCountdownPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state } = useLocation();

  const config = useMemo(() => readSessionConfig(), []);
  const restSeconds = state?.restSeconds ?? config.restSeconds ?? 60;
  const exerciseName =
    state?.exerciseName ?? config.exerciseName ?? t("member.rest.defaultExerciseName");
  const totalSets = state?.totalSets ?? config.sets ?? 1;
  /**
   * Số thứ tự set tiếp theo (raw) — màn tracking gửi `currentSetNumber + 1`.
   * Member có thể bấm Continue nhiều lần kể cả khi hệ thống không nhận được
   * lần tập nào, nên giá trị này có thể vượt quá `totalSets`.
   */
  const rawNextSetNumber = state?.nextSetNumber ?? 1;
  /** Số set vừa xong — luôn nằm trong khoảng [1, totalSets]. */
  const doneSetNumber = Math.min(Math.max(rawNextSetNumber - 1, 0), totalSets);
  /** Set tiếp theo màn tracking sẽ khôi phục — chặn ở set cuối cùng. */
  const nextSetNumber = Math.min(rawNextSetNumber, totalSets);
  /** Hết set cuối thì không còn set kế tiếp — nút chính chuyển sang bài kế tiếp. */
  const isLastSet = doneSetNumber >= totalSets;
  /** Các bài còn lại trong buổi tập — dùng cho nút "Finish". */
  const nextExercises = useMemo(
    () => (Array.isArray(state?.nextExercises) ? state.nextExercises : []),
    [state?.nextExercises],
  );
  /** Các set đã hoàn thành — trả lại màn tracking để bắt đầu đúng set tiếp theo. */
  const completedSets = useMemo(
    () => (Array.isArray(state?.completedSets) ? state.completedSets : []),
    [state?.completedSets],
  );
  /** Số liệu set vừa xong để hiển thị bên phải. */
  const lastSet = useMemo(() => state?.lastSet ?? readLastSet(), [state?.lastSet]);

  const [remaining, setRemaining] = useState(restSeconds);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(restSeconds <= 0);

  // Lưu các set đã hoàn thành vào sessionStorage để sống sót khi F5.
  useEffect(() => {
    try {
      sessionStorage.setItem(COMPLETED_SETS_KEY, JSON.stringify(completedSets));
    } catch {
      // Bộ nhớ đầy / private mode -> bỏ qua, vẫn chạy được.
    }
  }, [completedSets]);

  const goBackToTracking = useCallback(() => {
    navigate("/session/tracking", {
      replace: true,
      state: {
        fromRest: true,
        completedSets,
        nextSetNumber,
        // Set cuối cùng đã xong -> màn tracking lưu kết quả rồi chuyển bài.
        finishWorkout: isLastSet,
      },
    });
  }, [navigate, completedSets, nextSetNumber, isLastSet]);

  // Đồng hồ đếm ngược.
  useEffect(() => {
    if (paused || finished) return undefined;
    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          setFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [paused, finished]);

  // Hết giờ -> tự động quay lại màn tracking để set tiếp theo bắt đầu.
  useEffect(() => {
    if (!finished) return undefined;
    const timer = setTimeout(() => goBackToTracking(), 1200);
    return () => clearTimeout(timer);
  }, [finished, goBackToTracking]);

  const total = Math.max(1, restSeconds);
  const progress = finished ? 1 : (total - remaining) / total;
  const circumference = 2 * Math.PI * RING_RADIUS;
  const isUrgent = !finished && remaining <= 3;

  /** Bài HOLD đo theo giây, bài REPS đo theo số lần. */
  const isHold = config.category === "HOLD";
  const metricValue = isHold
    ? `${lastSet?.totalSeconds ?? 0}s`
    : `${lastSet?.cleanReps ?? 0} / ${config.reps ?? 12}`;
  const metricLabel = isHold ? t("member.rest.holdMetric") : t("member.rest.repsMetric");

  /** Cấu hình bài kế tiếp trong buổi tập (nếu có). */
  const nextExerciseName = state?.nextExerciseName ?? config.exerciseName ?? exerciseName;
  const nextTarget = isHold
    ? t("member.rest.nextTargetSeconds", { count: config.durationSeconds ?? 30 })
    : t("member.rest.nextTargetReps", { count: config.reps ?? 12 });
  const nextVolume = t("member.rest.nextVolume", { sets: totalSets, target: nextTarget });

  /**
   * "End workout" -> quay lại màn tracking với cờ kết thúc buổi tập.
   * Màn tracking sẽ lưu kết quả rồi mở màn kết quả tổng hợp của buổi tập.
   */
  const handleEndWorkout = () => {
    navigate("/session/tracking", {
      replace: true,
      state: {
        fromRest: true,
        completedSets,
        endWorkout: true,
      },
    });
  };

  /** Hết set cuối thì không còn set kế tiếp — nút chính chuyển sang kết thúc buổi tập. */

  /**
   * Bấm logo CalisHealth -> về dashboard.
   *
   * Kết quả các set đã xong đã được lưu ở màn tracking trước khi sang màn
   * nghỉ, nên chỉ cần dọn session rồi rời đi.
   */
  const goToDashboard = useCallback(() => {
    window.speechSynthesis?.cancel();
    try {
      sessionStorage.removeItem(COMPLETED_SETS_KEY);
      sessionStorage.removeItem(LAST_SET_KEY);
    } catch {
      // Không quan trọng.
    }
    navigate("/");
  }, [navigate]);

  return (
    <div className="rc-page">
      <SessionTopbar
        onBack={goBackToTracking}
        onBrand={goToDashboard}
        right={<VoiceToggleButton className="vt-icon-btn" />}
      />

      <main className="rc-body">
        {/* ------------------------------------------------ cột trái: đồng hồ */}
        <section className="rc-stage">
          <div className="rc-stage-head">
            <span className="rc-rest-badge">
              <span className="rc-rest-dot" aria-hidden="true" />
              {t("member.rest.badge")}
            </span>
            <span className="rc-stage-meta">
              {t("member.rest.setProgress", { exercise: exerciseName, done: doneSetNumber, total: totalSets })}
            </span>
          </div>

          <div className="rc-stage-main">
            <h1 className="rc-title">{t("member.rest.title")}</h1>
            <p className="rc-subtitle">{t("member.rest.subtitle", { count: doneSetNumber })}</p>

            <div className="rc-timer-wrap">
              <svg
                className="rc-ring"
                width={RING_SIZE}
                height={RING_SIZE}
                viewBox="0 0 280 280"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient
                    id="rc-ring-gradient"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="1"
                    gradientUnits="objectBoundingBox"
                  >
                    <stop offset="0" stopColor="#ec4899" />
                    <stop offset="1" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
                <circle className="rc-ring-track" cx="140" cy="140" r={RING_RADIUS} />
                <circle
                  className={`rc-ring-fill${isUrgent ? " is-urgent" : ""}`}
                  cx="140"
                  cy="140"
                  r={RING_RADIUS}
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - progress)}
                />
              </svg>
              <div className="rc-timer">
                <span className="rc-timer-value">{finished ? "GO" : remaining}</span>
                <span className="rc-timer-label">{t("member.rest.secondsLeft")}</span>
              </div>
            </div>

            <div className="rc-adjust">
              <button
                type="button"
                className="rc-adjust-btn"
                onClick={() => setRemaining((prev) => Math.max(0, prev - 15))}
                disabled={finished}
              >
                {t("member.rest.minusSeconds")}
              </button>
              <button
                type="button"
                className="rc-adjust-btn"
                onClick={() => setRemaining((prev) => prev + 15)}
                disabled={finished}
              >
                {t("member.rest.plusSeconds")}
              </button>
            </div>

            <p className="rc-tip">
              {t("member.rest.tip")}
            </p>
          </div>
        </section>

        {/* ------------------------------------------------ cột phải: tổng kết */}
        <aside className="rc-panel">
          <p className="rc-panel-label">{t("member.rest.lastSetSummary")}</p>
          <section className="rc-summary">
            <div className="rc-summary-item">
              <p className="rc-summary-value">{metricValue}</p>
              <p className="rc-summary-label">{metricLabel}</p>
            </div>
            <span className="rc-summary-divider" aria-hidden="true" />
            <div className="rc-summary-item">
              <p className={`rc-summary-value ${formTone(lastSet?.formScore)}`}>
                {lastSet?.formScore != null ? `${lastSet.formScore}%` : "--"}
              </p>
              <p className="rc-summary-label">{t("member.rest.form")}</p>
            </div>
            <span className="rc-summary-divider" aria-hidden="true" />
            <div className="rc-summary-item">
              <p className="rc-summary-value">
                {lastSet?.angle != null ? `${lastSet.angle}°` : "--"}
              </p>
              <p className="rc-summary-label">
                {isHold ? t("member.rest.bodyAngle") : t("member.rest.avgKnee")}
              </p>
            </div>
          </section>

          <section className="rc-tip-card">
            <span className="rc-tip-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none">
                <path d="M10 2v2M10 16v2M2 10h2M16 10h2" strokeLinecap="round" />
                <circle cx="10" cy="10" r="4" />
              </svg>
            </span>
            <p className="rc-tip-text">
              {lastSet?.feedback || t("member.rest.defaultAiTip")}
            </p>
          </section>

          <section className="rc-next">
            <span className="rc-next-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 4l8 6-8 6-8-6 8-6z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div>
              <p className="rc-next-label">{t("member.rest.upNext")}</p>
              {isLastSet ? (
                <>
                  <p className="rc-next-title">
                    {nextExercises.length > 0
                      ? nextExercises[0].exerciseName
                      : t("member.rest.finishWorkout")}
                  </p>
                  <p className="rc-next-sub">
                    {nextExercises.length > 0
                      ? t("member.rest.nextExerciseInPlan")
                      : t("member.rest.lastExerciseOfWorkout")}
                  </p>
                </>
              ) : (
                <>
                  <p className="rc-next-title">
                    {t("member.rest.nextSetTitle", {
                      exercise: nextExerciseName,
                      done: nextSetNumber,
                      total: totalSets,
                    })}
                  </p>
                  <p className="rc-next-sub">{nextVolume}</p>
                </>
              )}
            </div>
          </section>

          <button type="button" className="rc-skip-btn" onClick={goBackToTracking}>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M6 4l8 6-8 6V4z" fill="currentColor" />
              <path d="M15 4v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            {isLastSet
              ? nextExercises.length > 0
                ? t("member.rest.nextExerciseAction", { name: nextExercises[0].exerciseName })
                : t("member.rest.finishWorkout")
              : t("member.rest.skipRestAction", { count: nextSetNumber })}
          </button>

          <button type="button" className="rc-end-btn" onClick={handleEndWorkout}>
            <span className="rc-end-dot" aria-hidden="true" />
            {t("member.rest.endWorkout")}
          </button>
        </aside>
      </main>
    </div>
  );
}
