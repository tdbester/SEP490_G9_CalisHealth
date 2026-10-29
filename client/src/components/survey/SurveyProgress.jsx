/** "Step n of m" + thanh tiến độ chia đoạn (Figma: nhãn căn phải, phía trên thanh). */
export default function SurveyProgress({ current, total }) {
  return (
    <div className="survey-progress">
      <p className="survey-progress-label">
        Step {current} of {total}
      </p>
      <div
        className="survey-progress-bar"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-label={`Step ${current} of ${total}`}
      >
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={i < current ? "is-done" : ""} />
        ))}
      </div>
    </div>
  );
}
