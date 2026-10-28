import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { getMemberExercises, createMemberExercise } from "../api/library";
import "./MemberExerciseListPage.css";

// SVG Icons
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

function DumbbellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43 1.43 1.43 2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43 1.43-1.43z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
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

export default function MemberExerciseListPage() {
  const navigate = useNavigate();

  // Search & Filter States
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("All levels");
  const [selectedMuscles, setSelectedMuscles] = useState(["All"]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedExercise, setSelectedExercise] = useState(null);

  // Modal Create Exercise State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    muscleGroup: "Full body",
    level: "Intermediate",
    equipment: "Bodyweight",
    sets: 3,
    repsOrDuration: "10 reps",
    description: "",
  });

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch Member Exercises
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const isAll = selectedMuscles.includes("All") || selectedMuscles.length === 0;
      const musclesQuery = isAll ? undefined : selectedMuscles.join(",");

      const data = await getMemberExercises({
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
      console.error("Failed to fetch member exercises:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedLevel, selectedMuscles, debouncedSearch, currentPage]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Toggle Multi-select muscle group chip
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

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      toast.warning("Please fill in all required fields correctly.");
      return;
    }

    setSubmitting(true);
    try {
      await createMemberExercise(createForm);
      setShowCreateModal(false);
      setCreateForm({
        name: "",
        muscleGroup: "Full body",
        level: "Intermediate",
        equipment: "Bodyweight",
        sets: 3,
        repsOrDuration: "10 reps",
        description: "",
      });
      fetchList();
      toast.success("Exercise created successfully!");
    } catch (err) {
      console.error("Failed to create exercise:", err);
      toast.error("Failed to create. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const isAllActive = selectedMuscles.includes("All") || selectedMuscles.length === 0;

  return (
    <div className="member-exercise-page">
      {/* Back button */}
      <button
        type="button"
        className="back-link-btn"
        onClick={() => navigate("/library")}
      >
        <ChevronLeftIcon />
        <span>Back to Library</span>
      </button>

      {/* Header Trang với Action Button tạo bài tập */}
      <header className="member-page-header">
        <div className="header-meta">
          <h1 className="member-page-title">Member Provided Exercises</h1>
          <p className="member-page-description">
            Browse and manage exercises you added yourself.
          </p>
        </div>

        <button
          type="button"
          className="create-exercise-btn"
          onClick={() => setShowCreateModal(true)}
        >
          <PlusIcon />
          <span>Add Custom Exercise</span>
        </button>
      </header>

      {/* Bộ Lọc Filter: Row 1 = Search Box & Level Dropdown, Row 2 = Muscle Groups Chips */}
      <div className="filters-container">
        {/* Row 1: Search & Level */}
        <div className="filters-row-search">
          <div className="search-box-wrap">
            <SearchIcon />
            <input
              type="text"
              className="search-input"
              placeholder="Search by exercise name or muscle group..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <div className="level-select-wrap">
            <select
              className="level-select"
              value={selectedLevel}
              onChange={(e) => {
                setSelectedLevel(e.target.value);
                setCurrentPage(1);
              }}
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

        {/* Row 2: Multi-select Muscle Group Chips */}
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

      {/* Danh sách bài tập do Member tự tạo */}
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
            <h3 className="empty-title">No custom exercises found</h3>
            <p className="empty-desc">
              You haven't added any custom exercises matching these filters. Click below to add one!
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                type="button"
                className="empty-clear-btn"
                onClick={handleClearFilters}
              >
                Clear all filters
              </button>
              <button
                type="button"
                className="create-exercise-btn"
                style={{ padding: "9px 20px" }}
                onClick={() => setShowCreateModal(true)}
              >
                <PlusIcon />
                <span>Create Exercise</span>
              </button>
            </div>
          </div>
        ) : (
          exercises.map((item) => {
            const levelClass =
              item.level?.toLowerCase() === "beginner"
                ? "beginner"
                : item.level?.toLowerCase() === "advanced"
                ? "advanced"
                : "intermediate";

            const detailText =
              item.details ||
              `${item.muscleGroup || "Full body"} • ${item.sets || 3} sets • ${
                item.repsOrDuration || "10 reps"
              } • ${item.equipment || "Bodyweight"}`;

            return (
              <div
                key={item.id || item.code}
                className="exercise-row-card"
                onClick={() => {
                  const targetSlug =
                    item.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ||
                    item.id ||
                    item.code;
                  navigate(`/library/exercise/${targetSlug}`);
                }}
              >
                {/* Left: Dumbbell icon badge + Name + Details */}
                <div className="row-left">
                  <div className="exercise-icon-badge">
                    <DumbbellIcon />
                  </div>
                  <div className="exercise-meta">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h3 className="exercise-row-name">{item.name}</h3>
                      <span className="member-badge-pill">Custom</span>
                    </div>
                    <p className="exercise-row-details">{detailText}</p>
                  </div>
                </div>

                {/* Right: Chip Level đồng đều 110px + Arrow */}
                <div className="row-right">
                  <span className={`level-badge ${levelClass}`}>
                    {item.level || "Intermediate"}
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

      {/* Phân trang */}
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

      {/* Modal Tạo Bài Tập Mới (Dedicated Member Feature) */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content modal-form" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setShowCreateModal(false)}
              aria-label="Close"
            >
              &times;
            </button>

            <h2 className="modal-title">Add Custom Exercise</h2>
            <p className="modal-subtitle">
              Add your personalized bodyweight or calisthenics movement to your library.
            </p>

            <form onSubmit={handleCreateSubmit} className="create-form">
              <div className="form-group">
                <label className="form-label">Exercise Name *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Ring Archer Push-ups"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label className="form-label">Primary Muscle Group</label>
                  <select
                    className="form-input"
                    value={createForm.muscleGroup}
                    onChange={(e) => setCreateForm({ ...createForm, muscleGroup: e.target.value })}
                  >
                    {MUSCLE_GROUPS.filter((m) => m !== "All").map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group flex-1">
                  <label className="form-label">Difficulty Level</label>
                  <select
                    className="form-input"
                    value={createForm.level}
                    onChange={(e) => setCreateForm({ ...createForm, level: e.target.value })}
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label className="form-label">Equipment</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Bodyweight, Rings, Pull-up bar"
                    value={createForm.equipment}
                    onChange={(e) => setCreateForm({ ...createForm, equipment: e.target.value })}
                  />
                </div>

                <div className="form-group flex-1">
                  <label className="form-label">Target Reps / Time</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 10 reps or 30 sec"
                    value={createForm.repsOrDuration}
                    onChange={(e) => setCreateForm({ ...createForm, repsOrDuration: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Instructions &amp; Form Notes</label>
                <textarea
                  rows={3}
                  className="form-input form-textarea"
                  placeholder="Describe the execution cues, tempo, or progression notes..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !createForm.name.trim()}
                  className="create-exercise-btn"
                >
                  {submitting ? "Saving..." : "Save Exercise"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail Preview */}
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
                <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
                  <span
                    className={`level-badge ${
                      selectedExercise.level?.toLowerCase() === "beginner"
                        ? "beginner"
                        : selectedExercise.level?.toLowerCase() === "advanced"
                        ? "advanced"
                        : "intermediate"
                    }`}
                  >
                    {selectedExercise.level}
                  </span>
                  <span className="member-badge-pill">Custom Added</span>
                </div>
              </div>
            </div>

            <div style={{ background: "#17102b", padding: 16, borderRadius: 10, marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: "#a89bd0", marginBottom: 6 }}>Parameters:</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#c084fc" }}>
                {selectedExercise.details ||
                  `${selectedExercise.muscleGroup || "Full body"} • ${
                    selectedExercise.sets || 3
                  } sets • ${selectedExercise.repsOrDuration || "10 reps"} • ${
                    selectedExercise.equipment || "Bodyweight"
                  }`}
              </div>
            </div>

            <p style={{ color: "#a89bd0", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px 0" }}>
              {selectedExercise.description ||
                "Member customized calisthenics exercise stored in your personal exercise catalog."}
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
