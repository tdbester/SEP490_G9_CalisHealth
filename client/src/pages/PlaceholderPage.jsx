import "./PlaceholderPage.css";

export default function PlaceholderPage({ title, description }) {
  return (
    <div className="placeholder">
      <div className="placeholder-header">
        <div>
          <h2 className="placeholder-title">{title}</h2>
          {description && <p className="placeholder-desc">{description}</p>}
        </div>
        <span className="placeholder-badge">Sắp ra mắt</span>
      </div>

      <div className="placeholder-card">
        <svg
          className="placeholder-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2 17h20v4H2zM7 17V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v10" />
          <path d="M10 9h4" />
          <path d="M10 13h4" />
          <circle cx="18" cy="6" r="3" />
          <path d="M18 9v3" />
        </svg>
        <h3 className="placeholder-card-title">Tính năng đang được phát triển</h3>
        <p className="placeholder-card-desc">
          Màn này sẽ được bổ sung ở sprint tiếp theo. Vui lòng quay lại sau.
        </p>
      </div>
    </div>
  );
}
