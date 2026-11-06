import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SessionTopbar from "../components/session/SessionTopbar";
import formCorrectionApi from "../api/formCorrection";
import { libraryApi } from "../api/client";
import "./FormCorrectionPage.css";

/**
 * Màn "Form correction" (Figma 549:992).
 *
 * Member xem chi tiết lỗi form AI phát hiện trong buổi tập vừa rồi:
 *  - Cột trái: hình minh hoạ dạng + chip các lỗi kèm số đo.
 *  - Cột phải: danh sách lỗi, các bước sửa ("How to fix") và 2 nút hành động.
 *
 * Dữ liệu đo đến từ tracker (đọc qua `location.state.issueStats`), còn ngưỡng
 * chấm form và các bước sửa lấy từ API `GET /member/form-correction`.
 */

/** Số bước sửa tối đa hiển thị (Figma hiển thị 3 bước). */
const MAX_TIPS = 3;

/** Cấu hình mặc định khi bài tập không khai báo (khớp với màn tracking). */
const DEFAULT_REPS = 12;
const DEFAULT_SETS = 3;
const DEFAULT_HOLD_SECONDS = 30;

/**
 * Nhãn hiển thị cho chip số đo trên hình minh hoạ.
 *
 * @param {object} stat
 * @returns {string}
 */
function metricLabel(stat) {
  switch (stat.key) {
    case "depth":
      return "Hip";
    case "torso":
      return "Torso";
    case "knee":
      return "Knee";
    default: {
      const joint = (stat.joint || "").toUpperCase();
      return joint.charAt(0) + joint.slice(1).toLowerCase();
    }
  }
}

/**
 * Định dạng số đo của một lỗi.
 *
 * @param {object} stat - số liệu đo từ tracker
 * @returns {string} ví dụ "Hip 112° · target ≤ 95°"
 */
function formatMetric(stat) {
  const label = metricLabel(stat);
  if (stat.key === "knee") {
    return `${label} ${stat.measured}° inward`;
  }
  const sign = stat.direction === "min" ? "≥" : "≤";
  return `${label} ${stat.measured}° · target ${sign} ${stat.target}°`;
}

/**
 * Tên góc đo dùng trong dòng mô tả chi tiết.
 *
 * @param {object} stat
 * @returns {string}
 */
function measuredAngleName(stat) {
  switch (stat.key) {
    case "depth":
      return "knee";
    case "torso":
      return "torso";
    default:
      return (stat.joint || "joint").toLowerCase();
  }
}

/**
 * Mô tả chi tiết một lỗi (dòng phụ dưới tên lỗi).
 *
 * @param {object} stat
 * @returns {string}
 */
function formatDetail(stat) {
  if (stat.key === "knee") {
    const deviation = Math.max(0, stat.measured - stat.target);
    const seen =
      stat.occurrences > 0
        ? `seen in ${stat.occurrences}/${stat.totalReps} reps`
        : "seen in this set";
    return `${deviation}° deviation · ${seen}`;
  }
  const sign = stat.direction === "min" ? "≥" : "≤";
  return `Avg ${measuredAngleName(stat)} angle ${stat.measured}° (target ${sign} ${stat.target}°)`;
}

/**
 * Vị trí neo của chip số đo theo khớp (Figma chip nằm cạnh khớp tương ứng).
 *
 * @param {object} item - lỗi form
 * @returns {string} class modifier
 */
function metricPositionClass(item) {
  switch (item.key) {
    case "depth":
      return "fc-metric--hip";
    case "torso":
      return "fc-metric--torso";
    case "knee":
      return "fc-metric--knee";
    case "alignment":
      return "fc-metric--hip";
    default: {
      const joint = (item.joint || "").toUpperCase();
      if (joint === "SHOULDER") return "fc-metric--shoulder";
      if (joint === "ELBOW") return "fc-metric--elbow";
      if (joint === "KNEE") return "fc-metric--knee";
      return "fc-metric--hip";
    }
  }
}

/**
 * Minh hoạ dạng người với các điểm khớp bị lỗi (Figma vẽ skeleton tay).
 *
 * @param {string[]} activeJoints - các khớp đang bị lỗi (để tô đỏ)
 */
function PoseFigure({ activeJoints = [] }) {
  const isActive = (joint) => activeJoints.includes(joint);

  return (
    <svg
      className="fc-figure"
      viewBox="0 0 168 443"
      role="img"
      aria-label="Pose illustration with the joints that need correction"
    >
      {/* Đường nét cơ thể (tư thế squat, nhìn chính diện). */}
      <g
        fill="none"
        stroke="#a78bfa"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Vòng đầu. */}
        <circle cx="84" cy="30" r="23" />
        {/* Cổ -> thân -> hông. */}
        <path d="M84 53 L84 240" />
        {/* Vai -> khuỷu -> bàn tay. */}
        <path d="M56 76 L42 150 L52 196" />
        <path d="M112 76 L126 150 L116 196" />
        {/* Hông -> gối -> bàn chân. */}
        <path d="M84 240 L48 330" />
        <path d="M84 240 L120 330" />
        <path d="M48 330 L44 412" />
        <path d="M120 330 L124 412" />
        {/* Bàn chân. */}
        <path d="M44 412 L28 422" />
        <path d="M124 412 L140 422" />
      </g>

      {/* Các điểm khớp: xanh = đạt, đỏ = đang bị lỗi.
          Với cặp khớp đối xứng chỉ một bên bị tô đỏ (Figma: gối trái lỗi,
          gối phải vẫn xanh). */}
      <g>
        {[
          { joint: "KNEE", side: "left", cx: 48, cy: 330 },
          { joint: "KNEE", side: "right", cx: 120, cy: 330 },
          { joint: "HIP", side: "center", cx: 84, cy: 240 },
          { joint: "SHOULDER", side: "left", cx: 56, cy: 76 },
          { joint: "SHOULDER", side: "right", cx: 112, cy: 76 },
          { joint: "ELBOW", side: "left", cx: 42, cy: 150 },
          { joint: "ELBOW", side: "right", cx: 126, cy: 150 },
        ].map((point) => {
          const isProblem = isActive(point.joint) && point.side !== "right";
          const color = isProblem ? "#fb7185" : "#34d399";
          return (
            <g key={`${point.joint}-${point.side}`}>
              <circle cx={point.cx} cy={point.cy} r="14.5" fill={color} opacity="0.25" />
              <circle cx={point.cx} cy={point.cy} r="9.5" fill={color} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export default function FormCorrectionPage() {
  const navigate = useNavigate();
  const { state } = useLocation();

  /** Bài tập member vừa tập. */
  const exerciseCode = state?.exerciseCode || "";
  const exerciseName = state?.exerciseName || "Exercise";

  /** Số liệu đo chi tiết của các lỗi form (từ tracker). */
  const issueStats = useMemo(
    () => (Array.isArray(state?.issueStats) ? state.issueStats : []),
    [state?.issueStats],
  );

  /** Tên các lỗi form (dùng khi không có số liệu đo chi tiết). */
  const formIssues = useMemo(
    () => (Array.isArray(state?.formIssues) ? state.formIssues : []),
    [state?.formIssues],
  );

  /** Kế hoạch sửa form từ server (ngưỡng chấm + bước sửa). */
  const [plan, setPlan] = useState(null);

  /** Các khớp đang bị lỗi -> server dùng để ưu tiên bước sửa đúng lỗi. */
  const failedJoints = useMemo(
    () =>
      Array.from(
        new Set(
          (Array.isArray(state?.issueStats) ? state.issueStats : [])
            .map((stat) => stat.joint)
            .filter(Boolean)
            .map((joint) => joint.toUpperCase()),
        ),
      ),
    [state?.issueStats],
  );

  useEffect(() => {
    if (!exerciseCode) return undefined;
    let cancelled = false;
    formCorrectionApi
      .getPlan(exerciseCode, failedJoints)
      .then((data) => {
        if (!cancelled) setPlan(data);
      })
      .catch(() => {
        // Không lấy được kế hoạch -> vẫn hiển thị phần lỗi đã đo.
      });
    return () => {
      cancelled = true;
    };
  }, [exerciseCode, failedJoints]);

  /**
   * Danh sách lỗi hiển thị.
   *
   * Ưu tiên số liệu đo chi tiết; nếu tracker chưa lưu được (bài cũ) thì dựng
   * từ danh sách tên lỗi để màn vẫn có nội dung.
   */
  const issues = useMemo(() => {
    if (issueStats.length > 0) {
      return issueStats.map((stat) => ({
        key: stat.key,
        title: stat.label,
        detail: formatDetail(stat),
        joint: stat.joint,
        measured: stat.measured,
        target: stat.target,
        direction: stat.direction,
      }));
    }
    return formIssues.map((label, index) => ({
      key: `issue-${index}`,
      title: label,
      detail: "Detected by the AI pose tracker during your last set.",
      joint: "",
      measured: null,
      target: null,
    }));
  }, [issueStats, formIssues]);

  /** Các khớp đang bị lỗi -> dùng tô đỏ trên hình minh hoạ. */
  const activeJoints = useMemo(
    () => Array.from(new Set(issues.map((item) => item.joint).filter(Boolean))),
    [issues],
  );

  /** Các bước sửa lấy từ server. */
  const howToFix = useMemo(() => {
    const tips = plan?.howToFix ?? [];
    return tips.slice(0, MAX_TIPS);
  }, [plan]);

  /**
   * Tập lại bài này -> đi thẳng vào màn đếm reps/hồi để làm lại.
   *
   * Cấu hình (sets/reps/giây) lấy lại từ thư viện bài tập vì màn kết quả
   * không mang theo cấu hình buổi tập.
   */
  const retryExercise = useCallback(async () => {
    if (!exerciseCode) {
      navigate("/session/result", { replace: true });
      return;
    }
    try {
      const exercise = await libraryApi.exercise(exerciseCode);
      navigate("/session/tracking", {
        replace: true,
        state: {
          exerciseCode,
          exerciseName: exercise.name || exerciseName,
          category: exercise.category || "REPS",
          sets: exercise.defaultSets ?? DEFAULT_SETS,
          reps: exercise.defaultReps ?? DEFAULT_REPS,
          durationSeconds: exercise.duration ?? DEFAULT_HOLD_SECONDS,
        },
      });
    } catch {
      // Không lấy được cấu hình -> vẫn cho member vào màn chi tiết bài tập.
      navigate(`/exercises/${encodeURIComponent(exerciseCode)}`, { replace: true });
    }
  }, [navigate, exerciseCode, exerciseName]);

  /** Bỏ qua và tiếp tục -> quay lại màn kết quả. */
  const skipAndContinue = useCallback(() => {
    navigate("/session/result", { replace: true });
  }, [navigate]);

  /** Nội dung giải thích ngắn về form correction (nút "?"). */
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="fc-page">
      <SessionTopbar onBack={() => navigate(-1)} />

      <main className="fc-body">
        {/* ---------------------------------------------------------- tiêu đề */}
        <header className="fc-head">
          <button type="button" className="fc-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <h1 className="fc-title">Form correction</h1>
          <button
            type="button"
            className="fc-help"
            aria-label="What is form correction?"
            aria-expanded={showHelp}
            title="Form correction shows the joints the AI tracker flagged and how to fix them"
            onClick={() => setShowHelp((value) => !value)}
          >
            ?
          </button>
        </header>

        {showHelp ? (
          <p className="fc-help-text">
            The AI pose tracker watched your last set and flagged the joints that
            drifted outside the target range. The numbers next to each joint are
            what it measured — the highlighted points on the illustration are the
            joints to fix first.
          </p>
        ) : null}

        <div className="fc-grid">
          {/* ------------------------------------------- cột trái: hình dạng */}
          <section className="fc-card fc-card--figure">
            <div className="fc-figure-wrap">
              <PoseFigure activeJoints={activeJoints} />
            </div>

            <p className="fc-issues-count">
              {issues.length} issue{issues.length === 1 ? "" : "s"} found
            </p>

            <div className="fc-metrics">
              {issues.map((item) => (
                <span
                  key={item.key}
                  className={`fc-metric ${metricPositionClass(item)}`}
                >
                  {item.measured != null && item.target != null
                    ? formatMetric({
                        key: item.key,
                        joint: item.joint,
                        measured: item.measured,
                        target: item.target,
                        direction: item.direction,
                      })
                    : item.title}
                </span>
              ))}
            </div>
          </section>

          {/* ------------------------------------------ cột phải: chi tiết */}
          <div className="fc-side">
            {/* Danh sách lỗi. */}
            <section className="fc-card fc-card--issues">
              {issues.length > 0 ? (
                issues.map((item, index) => (
                  <div key={item.key} className="fc-issue">
                    {index > 0 ? <div className="fc-issue-divider" /> : null}
                    <div className="fc-issue-row">
                      <span className="fc-issue-dot" aria-hidden="true" />
                      <div className="fc-issue-body">
                        <p className="fc-issue-title">{item.title}</p>
                        <p className="fc-issue-detail">{item.detail}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="fc-empty">
                  No form issues recorded for this exercise — nice work!
                </p>
              )}
            </section>

            {/* Bước sửa. */}
            <section className="fc-card fc-card--fix">
              <h2 className="fc-fix-title">How to fix</h2>
              {howToFix.length > 0 ? (
                <ol className="fc-steps">
                  {howToFix.map((tip, index) => (
                    <li key={`${tip.title}-${index}`} className="fc-step">
                      <span className="fc-step-num" aria-hidden="true">
                        {index + 1}
                      </span>
                      <div className="fc-step-body">
                        <p className="fc-step-title">{tip.title}</p>
                        {tip.detail ? (
                          <p className="fc-step-detail">{tip.detail}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="fc-empty">
                  Keep the tempo slow and hold the correct position at the bottom
                  of each rep.
                </p>
              )}
            </section>

            {/* Hành động. */}
            <button type="button" className="fc-btn fc-btn--retry" onClick={retryExercise}>
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M16 10a6 6 0 1 1-1.8-4.3M16 3v4h-4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Retry exercise
            </button>
            <button type="button" className="fc-btn fc-btn--skip" onClick={skipAndContinue}>
              Skip &amp; continue
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
