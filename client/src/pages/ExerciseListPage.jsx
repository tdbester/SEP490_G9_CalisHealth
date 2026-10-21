import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getExercises } from "../api/library";
import "./ExerciseListPage.css";

// SVG Icons
function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="search-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg className="select-arrow" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// Icon Quả tạ (Dumbbell icon) đồng nhất cho danh sách bài tập
function DumbbellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43 1.43 1.43 2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43 1.43-1.43z" />
    </svg>
  );
}

const MUSCLE_GROUPS = [
  "All",
  "Chest",
  "Back",
  "Legs",
  "Core",
  "Full body",
  "Arm/Shoulders",
];

const LEVEL_OPTIONS = ["All levels", "Beginner", "Intermediate", "Advanced"];

export default function ExerciseListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL param (Chỉ phục vụ 2 danh mục hệ thống: health và skill)
  const paramType = searchParams.get("type");
  const initialTab =
    paramType && paramType.toLowerCase() === "skill" ? "skill" : "health";

  const [activeTab, setActiveTab] = useState(initialTab);

  // Debounced Search: searchInput hiển thị tức thì, debouncedSearch gọi API sau 300ms
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [selectedLevel, setSelectedLevel] = useState("All levels");

  // 2. NÂNG CẤP BỘ LỌC NHÓM CƠ THÀNH DẠNG MULTI-SELECT (mảng selectedMuscles)
  const [selectedMuscles, setSelectedMuscles] = useState(["All"]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedExercise, setSelectedExercise] = useState(null);

  // Sync tab with URL query parameter (chỉ health hoặc skill)
  useEffect(() => {
    if (paramType) {
      setActiveTab(paramType.toLowerCase() === "skill" ? "skill" : "health");
    }
  }, [paramType]);

  // Debounce handler (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchInput]);

  // Fetch Exercises from API với hỗ trợ Multi-select Muscle Groups
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const isAll = selectedMuscles.includes("All") || selectedMuscles.length === 0;
      const musclesQuery = isAll ? undefined : selectedMuscles.join(",");

      const data = await getExercises({
        type: activeTab,
        source: "system",
        level: selectedLevel === "All levels" ? "all" : selectedLevel,
        muscleGroup: isAll ? "all" : musclesQuery,
        muscles: musclesQuery,
        search: debouncedSearch.trim() || undefined,
        page: currentPage,
        size: pageSize,
      });

      if (data) {
        setExercises(data.items || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error("Failed to fetch exercises:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedLevel, selectedMuscles, debouncedSearch, currentPage]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Event handlers
  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchParams({ type: tab });
  };

  const handleSearchChange = (e) => {
    setSearchInput(e.target.value);
  };

  const handleLevelChange = (e) => {
    setSelectedLevel(e.target.value);
    setCurrentPage(1);
  };

  // 2. Logic xử lý toggle chip nhóm cơ Multi-select
  const handleMuscleToggle = (mg) => {
    if (mg === "All") {
      setSelectedMuscles(["All"]);
      setCurrentPage(1);
      return;
    }

    setSelectedMuscles((prev) => {
      const withoutAll = prev.filter((item) => item !== "All");
      let updated;
      if (withoutAll.includes(mg)) {
        updated = withoutAll.filter((item) => item !== mg);
      } else {
        updated = [...withoutAll, mg];
      }

      // Nếu bỏ chọn hết tất cả nhóm cơ cụ thể -> tự động quay về "All"
      if (updated.length === 0) {
        return ["All"];
      }
      return updated;
    });
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setSelectedLevel("All levels");
    setSelectedMuscles(["All"]);
    setCurrentPage(1);
  };

  // Đổi linh hoạt Subtitle chỉ giữa 2 tab Health và Skills
  const subtitle =
    activeTab === "skill"
      ? "Browse calisthenics skills and the exercises that build up to them."
      : "Browse exercises that support your health goals.";

  const isAllActive = selectedMuscles.includes("All") || selectedMuscles.length === 0;

  return (
    <div className="exercise-list-page">
      {/* Back button */}
      <button
        type="button"
        className="back-link-btn"
        onClick={() => navigate("/library")}
      >
        <ChevronLeftIcon />
        <span>Back to Library</span>
      </button>

      {/* Header Trang với Subtitle linh hoạt theo Tab */}
      <header className="exercise-header">
        <h1 className="exercise-title">Exercise for health &amp; skill list</h1>
        <p className="exercise-description">{subtitle}</p>
      </header>

      {/* BỘ LỌC VỚI THỨ TỰ 3 DÒNG TỪ TRÊN XUỐNG */}
      <div className="filters-container">
        {/* Dòng 1: Tab Health / Skill (Chỉ 2 danh mục hệ thống) */}
        <div className="filters-row-tabs">
          <div className="section-switch" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "health"}
              className={`switch-tab ${activeTab === "health" ? "active" : ""}`}
              onClick={() => handleTabSwitch("health")}
            >
              <HeartIcon />
              <span>Health</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "skill"}
              className={`switch-tab ${activeTab === "skill" ? "active" : ""}`}
              onClick={() => handleTabSwitch("skill")}
            >
              <StarIcon />
              <span>Skills</span>
            </button>
          </div>
        </div>

        {/* Dòng 2: Thanh Search Box đi kèm Dropdown Level bên cạnh */}
        <div className="filters-row-search">
          <div className="search-box-wrap">
            <SearchIcon />
            <input
              type="text"
              className="search-input"
              placeholder="Search by exercise name or muscle group..."
              value={searchInput}
              onChange={handleSearchChange}
            />
          </div>

          <div className="level-select-wrap">
            <select
              className="level-select"
              value={selectedLevel}
              onChange={handleLevelChange}
            >
              {LEVEL_OPTIONS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
            <ArrowDownIcon />
          </div>
        </div>

        {/* Dòng 3: Dòng các Chip lọc nhóm cơ dạng Multi-select */}
        <div className="filters-row-chips">
          <div className="muscle-chips-wrap">
            {MUSCLE_GROUPS.map((mg) => {
              const active = mg === "All" ? isAllActive : !isAllActive && selectedMuscles.includes(mg);
              return (
                <button
                  key={mg}
                  type="button"
                  className={`muscle-chip ${active ? "active" : ""}`}
                  onClick={() => handleMuscleToggle(mg)}
                >
                  {mg}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Danh sách bài tập (Exercise List) */}
      <div className="exercise-list">
        {loading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="skeleton-row" />
          ))
        ) : exercises.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <DumbbellIcon />
            </div>
            <h3 className="empty-title">No exercises found</h3>
            <p className="empty-desc">
              Try adjusting your search keywords, muscle filter, or difficulty level.
            </p>
            <button
              type="button"
              className="empty-clear-btn"
              onClick={handleClearFilters}
            >
              Clear all filters
            </button>
          </div>
        ) : (
          exercises.map((item) => {
            const levelClass =
              item.level?.toLowerCase() === "beginner"
                ? "beginner"
                : item.level?.toLowerCase() === "advanced"
                ? "advanced"
                : "intermediate";

            // Cấu trúc Detail: [Nhóm cơ] • [Số sets] • [Reps hoặc Thời gian] • [Dụng cụ]
            const detailText =
              item.details ||
              `${item.muscleGroup || "Full body"} • ${item.sets || 3} sets • ${
                item.repsOrDuration || "12 reps"
              } • ${item.equipment || "Bodyweight"}`;

            return (
              <div
                key={item.id || item.code}
                className="exercise-row-card"
                onClick={() => setSelectedExercise(item)}
              >
                {/* Left: Dumbbell Icon + Name + Details */}
                <div className="row-left">
                  <div className="exercise-icon-badge">
                    <DumbbellIcon />
                  </div>
                  <div className="exercise-meta">
                    <h3 className="exercise-row-name">{item.name}</h3>
                    <p className="exercise-row-details">{detailText}</p>
                  </div>
                </div>

                {/* Right: Chip Level 110px thẳng cột mép phải */}
                <div className="row-right">
                  <span className={`level-badge ${levelClass}`}>
                    {item.level || "Beginner"}
                  </span>
                  <div className="row-arrow-icon">
                    <ChevronRightIcon />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Phân trang (Pagination) */}
      {!loading && totalPages > 1 && (
        <div className="pagination-wrap">
          <button
            type="button"
            className="page-btn"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeftIcon />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
            <button
              key={num}
              type="button"
              className={`page-btn ${currentPage === num ? "active" : ""}`}
              onClick={() => setCurrentPage(num)}
            >
              {num}
            </button>
          ))}

          <button
            type="button"
            className="page-btn"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Next page"
          >
            <ChevronRightIcon />
          </button>
        </div>
      )}

      {/* Modal Detail Preview khi click vào Row Card */}
      {selectedExercise && (
        <div className="modal-overlay" onClick={() => setSelectedExercise(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setSelectedExercise(null)}
              aria-label="Close"
            >
              &times;
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
              <div className="exercise-icon-badge" style={{ width: 48, height: 48 }}>
                <DumbbellIcon />
              </div>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#fff" }}>
                  {selectedExercise.name}
                </h2>
                <span
                  className={`level-badge ${
                    selectedExercise.level?.toLowerCase() === "beginner"
                      ? "beginner"
                      : selectedExercise.level?.toLowerCase() === "advanced"
                      ? "advanced"
                      : "intermediate"
                  }`}
                  style={{ marginTop: 6 }}
                >
                  {selectedExercise.level}
                </span>
              </div>
            </div>

            <div style={{ background: "#17102b", padding: 16, borderRadius: 10, marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: "#a89bd0", marginBottom: 6 }}>Parameters:</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#c084fc" }}>
                {selectedExercise.details ||
                  `${selectedExercise.muscleGroup || "Full body"} • ${
                    selectedExercise.sets || 3
                  } sets • ${selectedExercise.repsOrDuration || "12 reps"} • ${
                    selectedExercise.equipment || "Bodyweight"
                  }`}
              </div>
            </div>

            <p style={{ color: "#a89bd0", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px 0" }}>
              {selectedExercise.description ||
                "Comprehensive bodyweight exercise instruction focusing on optimal muscular recruitment, alignment, and tempo."}
            </p>

            <button
              type="button"
              className="empty-clear-btn"
              style={{ width: "100%", padding: "11px 0" }}
              onClick={() => setSelectedExercise(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
