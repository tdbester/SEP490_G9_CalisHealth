import { useNavigate, useSearchParams } from "react-router-dom";

export default function LibraryDetailPlaceholder({ title, type: itemType }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const source = params.get("source") || "all";
  const filterType = params.get("type") || "all";

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", color: "#FFFFFF" }}>
      <button
        onClick={() => navigate("/library")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "transparent",
          color: "#A89BD0",
          border: "none",
          fontSize: 14,
          cursor: "pointer",
          marginBottom: 20,
          padding: 0,
        }}
      >
        &larr; Back to Library
      </button>

      <div
        style={{
          background: "#21183C",
          border: "1px solid #35275E",
          borderRadius: 14,
          padding: 32,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "#FFFFFF" }}>
            {title}
          </h1>
          <span
            style={{
              background: "rgba(139, 92, 246, 0.2)",
              color: "#C084FC",
              padding: "4px 10px",
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {source === "system" ? "System" : source === "member" ? "Member Added" : "Custom"}
            {filterType !== "all" ? ` • ${filterType}` : ""}
          </span>
        </div>

        <p style={{ color: "#A89BD0", fontSize: 14, margin: "0 0 24px 0" }}>
          Viewing list of {itemType} filtered by {source} / {filterType}. (Detailed table/card view will be loaded here).
        </p>

        <div
          style={{
            padding: 36,
            textAlign: "center",
            border: "1px dashed #473577",
            borderRadius: 10,
            color: "#A89BD0",
            fontSize: 14,
          }}
        >
          List view module connected successfully via query params:
          <br />
          <code style={{ color: "#C084FC", display: "inline-block", marginTop: 8 }}>
            source={source}&amp;type={filterType}
          </code>
        </div>
      </div>
    </div>
  );
}
