import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import SessionTopbar from "../components/session/SessionTopbar";
import AiSupportModal from "../components/session/AiSupportModal";
import { readWorkoutResults, readWorkoutOrigin, clearWorkoutOrigin } from "../utils/workoutResults";
import "./ExerciseResultPage.css";

/** Ngưỡng đạt của bài tập — Figma hiển thị "Pass threshold: 70% accuracy". */
const PASS_THRESHOLD = 70;

/** Bán kính vòng tròn accuracy (Figma: vòng 236px, stroke 24px). */
const RING_SIZE = 236;
const RING_RADIUS = 98;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * Chuẩn hoá phần trăm cho vòng tròn: số 0-100 -> 0-1.
 * @param {number} value
 */
function toRatio(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1, Math.max(0, number / 100));
}

/**
 * Màn "Exercise result & assessment" (Figma 549:1175).
 *
 * Đây là màn KẾT QUẢ CUỐI CÙNG của một buổi tập — hiển thị tổng hợp tất cả
 * bài member đã tập (qua camera hoặc upload video), không phải kết quả riêng
 * của một bài.
 *
 * Mở tới khi:
 *  - Member bấm "Finish workout" ở bài cuối cùng của buổi tập.
 *  - Hoặc hệ thống quét xong video đẩy lên.
 */
export default function ExerciseResultPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { t } = useTranslation();

  /** Popup AI Support đang mở hay không. */
  const [aiOpen, setAiOpen] = useState(false);

  /** Kết quả từng bài đã tích lũy trong buổi tập. */
  const exerciseResults = useMemo(() => {
    const stored = readWorkoutResults();
    // Nếu mở trực tiếp không có dữ liệu -> dùng dữ liệu truyền qua state.
    if (stored.length > 0) return stored;
    if (state?.exerciseName) {
      return [
        {
          exerciseCode: state.exerciseCode,
          exerciseName: state.exerciseName,
          isHold: Boolean(state.isHold),
          accuracy: Number(state.accuracy ?? 0),
          validCount: Number(state.validReps ?? 0),
          invalidCount: Number(state.invalidReps ?? 0),
          totalCount: Number(state.totalReps ?? 0),
          formIssues: Array.isArray(state.formIssues) ? state.formIssues : [],
          issueStats: Array.isArray(state.issueStats) ? state.issueStats : [],
          source: "camera",
        },
      ];
    }
    return [];
  }, [state]);

  /**
   * Tách số liệu theo 2 loại bài: bài REPS (đếm lần) và bài HOLD (đếm giây).
   *
   * Buổi tập có thể trộn cả 2 loại — nếu cộng chung thì "9 rep + 28 giây"
   * thành "37" là vô nghĩa, nên phải tính riêng rồi mới hiển thị.
   */
  const metrics = useMemo(() => {
    const empty = { valid: 0, invalid: 0, total: 0 };
    const reps = { ...empty };
    const hold = { ...empty };
    const formIssues = Array.from(
      new Set(exerciseResults.flatMap((item) => item.formIssues || [])),
    );

    let counted = 0;
    let valid = 0;

    for (const item of exerciseResults) {
      const target = item.isHold ? hold : reps;
      const itemValid = item.validCount || 0;
      const itemInvalid = item.invalidCount || 0;
      target.valid += itemValid;
      target.invalid += itemInvalid;
      target.total += itemValid + itemInvalid;
      counted += itemValid + itemInvalid;
      valid += itemValid;
    }

    const hasRepsExercises = exerciseResults.some((item) => !item.isHold);
    const hasHoldExercises = exerciseResults.some((item) => item.isHold);

    return {
      reps,
      hold,
      formIssues,
      exerciseCount: exerciseResults.length,
      /** Có bài REPS trong buổi tập (dùng để chọn đơn vị hiển thị). */
      hasRepsExercises,
      /** Có bài HOLD trong buổi tập. */
      hasHoldExercises,
      /** Nhóm có số liệu thực (dùng để hiển thị thanh tiến độ). */
      hasReps: reps.total > 0,
      hasHold: hold.total > 0,
      accuracy: counted > 0 ? Math.round((valid / counted) * 100) : 0,
    };
  }, [exerciseResults]);

  const passed = metrics.accuracy >= PASS_THRESHOLD;
  const ringOffset = RING_CIRCUMFERENCE * (1 - toRatio(metrics.accuracy));

  /**
   * Nhãn đơn vị đo. Bài HOLD tính theo giây, bài REPS tính theo số lần.
   * Nếu buổi tập chỉ gồm 1 loại thì dùng nhãn của loại đó.
   */
  const labels =
    metrics.hasHoldExercises && !metrics.hasRepsExercises
      ? {
          valid: t("member.result.labelCleanSeconds"),
          invalid: t("member.result.labelUncleanSeconds"),
          total: t("member.result.labelTotalSeconds"),
        }
      : {
          valid: t("member.result.labelValidReps"),
          invalid: t("member.result.labelInaccurateReps"),
          total: t("member.result.labelTotalReps"),
        };

  /** Nhóm số liệu chính hiển thị (ưu tiên nhóm có dữ liệu thực). */
  const primary = metrics.hasReps
    ? metrics.reps
    : metrics.hasHold
      ? metrics.hold
      : metrics.hasRepsExercises
        ? metrics.reps
        : metrics.hold;

  /**
   * Quay lại nơi member bắt đầu buổi tập.
   *
   * Tập từ kế hoạch ngày -> về "/plan"; tập từ thư viện -> về "/library".
   */
  const origin = readWorkoutOrigin();
  const backToPlan = useCallback(() => {
    clearWorkoutOrigin();
    navigate(origin);
  }, [navigate, origin]);

  /**
   * Màn kết quả chỉ mở MỘT lần — sau bài cuối cùng của buổi tập — nên không
   * còn nút "Next exercise" ở đây.
   */

  /**
   * Bài tập dùng làm ngữ cảnh cho AI Support.
   *
   * Ưu tiên bài có accuracy thấp nhất (vì đó là bài member cần hỏi nhất);
   * nếu không có bài nào thì lấy bài đầu tiên.
   */
  const focusExercise = useMemo(() => {
    if (exerciseResults.length === 0) return null;
    return [...exerciseResults].sort(
      (left, right) => (left.accuracy ?? 0) - (right.accuracy ?? 0),
    )[0];
  }, [exerciseResults]);

  /** Mở hộp thoại "Ask AI Support". */
  const askAiSupport = useCallback(() => {
    setAiOpen(true);
  }, []);

  /**
   * Mở màn "Form correction" (Figma 549:992).
   *
   * Mang theo số liệu đo chi tiết của lỗi form (nếu tracker đã lưu) để màn
   * đó hiển thị đúng góc đo, ngưỡng mục tiêu và số rep bị lỗi.
   */
  const openFormCorrection = useCallback(() => {
    if (!focusExercise) {
      toast.error(t("member.correction.noExerciseToCorrect"));
      return;
    }
    navigate("/session/correction", {
      state: {
        exerciseCode: focusExercise.exerciseCode,
        exerciseName: focusExercise.exerciseName,
        formIssues: focusExercise.formIssues ?? [],
        issueStats: focusExercise.issueStats ?? [],
      },
    });
  }, [navigate, focusExercise]);

  return (
    <div className="rs-page">
      <SessionTopbar showBack={false} />

      <main className="rs-body">
        {/* ------------------------------------------------------- tiêu đề */}
        <header className="rs-head">
          <span className="rs-head-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h1 className="rs-title">{t("member.result.titleLabel")}</h1>
          {metrics.exerciseCount > 0 && (
            <p className="rs-head-meta">
              {t("member.result.exerciseCompleted", {
                count: metrics.exerciseCount,
                plural: metrics.exerciseCount === 1 ? "" : "s",
              })}
            </p>
          )}
        </header>

        <div className="rs-grid">
          {/* ------------------------------------- cột trái: vòng accuracy */}
          <section className="rs-card rs-card--ring">
            <div className="rs-ring-wrap">
              <svg
                width={RING_SIZE}
                height={RING_RADIUS * 2 + 40}
                viewBox="0 0 236 236"
                aria-hidden="true"
              >
                {/* Vòng nền. */}
                <circle
                  cx="118"
                  cy="118"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="#1f1c3d"
                  strokeWidth="24"
                />
                {/* Vòng tiến trình theo accuracy. */}
                <circle
                  cx="118"
                  cy="118"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="24"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={ringOffset}
                  transform="rotate(-90 118 118)"
                />
              </svg>
              <div className="rs-ring-center">
                <p className="rs-ring-value">{metrics.accuracy}%</p>
                <p className="rs-ring-label">{t("member.result.accuracyLabel")}</p>
              </div>
            </div>

            <p className={`rs-verdict${passed ? " is-pass" : " is-fail"}`}>
              {t(
                passed ? "member.result.verdictPassed" : "member.result.verdictFailed",
                {
                  count: metrics.formIssues.length,
                  plural: metrics.formIssues.length === 1 ? "" : "s",
                },
              )}
            </p>
            <p className="rs-threshold">
              {t("member.result.passThreshold", { threshold: PASS_THRESHOLD })}
            </p>
          </section>

          {/* --------------------------------------- cột phải: thống kê */}
          <div className="rs-side">
            <div className="rs-stat-row">
              <section className="rs-card rs-card--stat">
                <p className="rs-stat-value is-valid">{primary.valid}</p>
                <p className="rs-stat-label">{labels.valid}</p>
              </section>
              <section className="rs-card rs-card--stat">
                <p className="rs-stat-value is-invalid">{primary.invalid}</p>
                <p className="rs-stat-label">{labels.invalid}</p>
              </section>
            </div>

            <section className="rs-card rs-card--total">
              <div className="rs-card-row">
                <p className="rs-card-label">{labels.total}</p>
                <p className="rs-total-value">{primary.total}</p>
              </div>
              <div className="rs-bar">
                <span
                  className="rs-bar-fill"
                  style={{
                    width: `${
                      primary.total > 0
                        ? Math.round((primary.valid / primary.total) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </section>

            {/* Buổi tập trộn cả bài REPS và bài HOLD -> hiển thị thêm số giây
                của nhóm bài HOLD để không trộn đơn vị đo. */}
            {metrics.hasRepsExercises && metrics.hasHoldExercises && (
              <section className="rs-card rs-card--total">
                <div className="rs-card-row">
                  <p className="rs-card-label">{labels.total}</p>
                  <p className="rs-total-value">{metrics.hold.total}</p>
                </div>
                <div className="rs-bar">
                  <span
                    className="rs-bar-fill"
                    style={{
                      width: `${
                        metrics.hold.total > 0
                          ? Math.round((metrics.hold.valid / metrics.hold.total) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </section>
            )}

            {/* Danh sách bài đã tập trong buổi này. */}
            {exerciseResults.length > 0 && (
              <section className="rs-card rs-card--exercises">
                <p className="rs-card-title">{t("member.result.exercisesCompleted")}</p>
                <ul className="rs-exercise-list">
                  {exerciseResults.map((item) => (
                    <li key={item.exerciseCode} className="rs-exercise-item">
                      <span className="rs-exercise-name">{item.exerciseName}</span>
                      <span
                        className={`rs-exercise-score${
                          (item.accuracy ?? 0) >= PASS_THRESHOLD ? " is-pass" : " is-fail"
                        }`}
                      >
                        {item.accuracy ?? 0}%
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="rs-card rs-card--issues">
              <div className="rs-card-row">
                <span className="rs-issue-dot" aria-hidden="true" />
                <p className="rs-card-title">
                  {t("member.result.formIssuesDetected", {
                    count: metrics.formIssues.length,
                    plural: metrics.formIssues.length === 1 ? "" : "s",
                  })}
                </p>
              </div>
              {metrics.formIssues.length > 0 ? (
                <ul className="rs-issues">
                  {metrics.formIssues.map((issue) => (
                    <li key={issue} className="rs-issue">
                      • {issue}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rs-issue-empty">{t("member.result.noFormIssues")}</p>
              )}
            </section>

            <button type="button" className="rs-btn rs-btn--support" onClick={askAiSupport}>
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M10 3a6 6 0 0 0-6 6v3a2 2 0 0 0 2 2h1v-5H6V9a4 4 0 1 1 8 0v1h-2v5h3a2 2 0 0 0 2-2V9a6 6 0 0 0-6-6Z"
                  fill="currentColor"
                />
              </svg>
              {t("member.result.aiSupportTitle")}
              <svg className="rs-btn-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M7.5 4l5 6-5 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <button
              type="button"
              className="rs-btn rs-btn--correction"
              onClick={openFormCorrection}
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M10 5v7M10 15.5v.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              {t("member.result.viewFormCorrection")}
            </button>

            <p className="rs-note">
              {t("member.result.correctionNote", { threshold: PASS_THRESHOLD })}
            </p>
          </div>
        </div>
      </main>

      <footer className="rs-footer">
        <button type="button" className="rs-back-btn" onClick={backToPlan}>
          {origin === "/library"
            ? t("member.result.backToLibrary")
            : t("member.result.backToPlan")}
        </button>
      </footer>

      <AiSupportModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        exerciseCode={focusExercise?.exerciseCode}
        exerciseName={focusExercise?.exerciseName}
        formIssues={focusExercise?.formIssues ?? []}
        accuracy={focusExercise?.accuracy ?? null}
        source={focusExercise?.source ?? "camera"}
      />
    </div>
  );
}
