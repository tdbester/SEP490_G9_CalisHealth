import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { getMemberExercises, createMemberExercise } from "../api/library";
import { FAVORITE_ITEM_TYPES } from "../api/favorites";
import FavoriteButton from "../components/favorites/FavoriteButton";
import { getLevelBadgeStyle } from "../utils/levelBadge";
import { getLevelLabel } from "../utils/levelLabel";
import ConfirmDialog from "../components/common/ConfirmDialog";
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
  { value: "All", labelKey: "member.customExercise.muscleAll" },
  { value: "Chest", labelKey: "member.customExercise.muscleChest" },
  { value: "Back", labelKey: "member.customExercise.muscleBack" },
  { value: "Legs", labelKey: "member.customExercise.muscleLegs" },
  { value: "Core", labelKey: "member.customExercise.muscleCore" },
  { value: "Arms", labelKey: "member.customExercise.muscleArms" },
  { value: "Shoulders", labelKey: "member.customExercise.muscleShoulders" },
  { value: "Glutes", labelKey: "member.customExercise.muscleGlutes" },
  { value: "Full body", labelKey: "member.customExercise.muscleFullBody" },
];

const LEVEL_OPTIONS = [
  { value: "All levels", labelKey: "member.customExercise.levelAll" },
  { value: "Beginner", labelKey: "member.customExercise.levelBeginner" },
  { value: "Intermediate", labelKey: "member.customExercise.levelIntermediate" },
  { value: "Advanced", labelKey: "member.customExercise.levelAdvanced" },
];

export default function MemberExerciseListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Search & Filter States
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("All levels");
  const [selectedMuscles, setSelectedMuscles] = useState(["All"]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedExercise, setSelectedExercise] = useState(null);

  // Modal Create Exercise State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
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
        toast.warning(t("member.customExercise.requiredFields"));
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
      toast.success(t("member.customExercise.createdSuccess"));
    } catch (err) {
      console.error("Failed to create exercise:", err);
      toast.error(t("member.customExercise.createFailed"));
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
        <span>{t("member.customExercise.backToLibrary")}</span>
      </button>

      {/* Header Trang với Action Button tạo bài tập */}
      <header className="member-page-header">
        <div className="header-meta">
          <h1 className="member-page-title">{t("member.customExercise.pageTitle")}</h1>
          <p className="member-page-description">
            {t("member.customExercise.pageDescription")}
          </p>
        </div>

        <button
          type="button"
          className="create-exercise-btn"
          onClick={() => setShowCreateModal(true)}
        >
          <PlusIcon />
          <span>{t("member.customExercise.addCustom")}</span>
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
              placeholder={t("member.customExercise.searchPlaceholder")}
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
                <option key={lvl.value} value={lvl.value}>
                  {t(lvl.labelKey)}
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
              const active = mg.value === "All" ? isAllActive : !isAllActive && selectedMuscles.includes(mg.value);
              return (
                <button
                  key={mg.value}
                  type="button"
                  className={`muscle-chip ${active ? "active" : ""}`}
                  onClick={() => handleMuscleToggle(mg.value)}
                >
                  {t(mg.labelKey)}
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
            <h3 className="empty-title">{t("member.customExercise.emptyTitle")}</h3>
            <p className="empty-desc">
              {t("member.customExercise.emptyDesc")}
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                type="button"
                className="empty-clear-btn"
                onClick={handleClearFilters}
              >
                {t("member.customExercise.clearFilters")}
              </button>
              <button
                type="button"
                className="create-exercise-btn"
                style={{ padding: "9px 20px" }}
                onClick={() => setShowCreateModal(true)}
              >
                <PlusIcon />
                <span>{t("member.customExercise.createExercise")}</span>
              </button>
            </div>
          </div>
        ) : (
          exercises.map((item) => {
            const level = item.level || item.difficultyLevel || "Intermediate";

            const detailText =
              item.details ||
              t("member.customExercise.detailSummary", {
                muscle: item.muscleGroup || t("member.customExercise.defaultFullBody"),
                sets: item.sets || t("member.customExercise.defaultSets"),
                reps: item.repsOrDuration || t("member.customExercise.defaultReps"),
                equipment: item.equipment || t("member.customExercise.defaultEquipment"),
              });

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
                      <span className="member-badge-pill">{t("member.customExercise.customPill")}</span>
                    </div>
                    <p className="exercise-row-details">{detailText}</p>
                  </div>
                </div>

                {/* Right: Star + Level chip đồng đều 110px + Arrow */}
                <div className="row-right">
                  <FavoriteButton
                    itemType={FAVORITE_ITEM_TYPES.MEMBER_EXERCISE}
                    itemId={item.id || item.code}
                    label={item.name}
                  />
                  <span className={`level-badge ${getLevelBadgeStyle(level)}`}>
                    {getLevelLabel(level)}
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
            aria-label={t("member.customExercise.previousPage")}
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
            aria-label={t("member.customExercise.nextPage")}
          >
            <ChevronRightIcon />
          </button>
        </div>
      )}

      {/* Modal Tạo Bài Tập Mới (Dedicated Member Feature) */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setConfirmCancel(true)}>
          <div className="modal-content modal-form" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setConfirmCancel(true)}
              aria-label={t("common.ui.closeAria")}
            >
              &times;
            </button>

            <h2 className="modal-title">{t("member.customExercise.modalTitle")}</h2>
            <p className="modal-subtitle">
              {t("member.customExercise.modalSubtitle")}
            </p>

            <form onSubmit={handleCreateSubmit} className="create-form">
              <div className="form-group">
                <label className="form-label">{t("member.customExercise.fieldName")}</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder={t("member.customExercise.namePlaceholder")}
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label className="form-label">{t("member.customExercise.fieldMuscleGroup")}</label>
                  <select
                    className="form-input"
                    value={createForm.muscleGroup}
                    onChange={(e) => setCreateForm({ ...createForm, muscleGroup: e.target.value })}
                  >
                    {MUSCLE_GROUPS.filter((m) => m.value !== "All").map((m) => (
                      <option key={m.value} value={m.value}>
                        {t(m.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group flex-1">
                  <label className="form-label">{t("member.customExercise.fieldLevel")}</label>
                  <select
                    className="form-input"
                    value={createForm.level}
                    onChange={(e) => setCreateForm({ ...createForm, level: e.target.value })}
                  >
                    {LEVEL_OPTIONS.filter((l) => l.value !== "All levels").map((l) => (
                      <option key={l.value} value={l.value}>
                        {t(l.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label className="form-label">{t("member.customExercise.fieldEquipment")}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={t("member.customExercise.equipmentPlaceholder")}
                    value={createForm.equipment}
                    onChange={(e) => setCreateForm({ ...createForm, equipment: e.target.value })}
                  />
                </div>

                <div className="form-group flex-1">
                  <label className="form-label">{t("member.customExercise.fieldTarget")}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={t("member.customExercise.targetPlaceholder")}
                    value={createForm.repsOrDuration}
                    onChange={(e) => setCreateForm({ ...createForm, repsOrDuration: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t("member.customExercise.fieldInstructions")}</label>
                <textarea
                  rows={3}
                  className="form-input form-textarea"
                  placeholder={t("member.customExercise.instructionsPlaceholder")}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setConfirmCancel(true)}
                >
                  {t("member.customExercise.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={submitting || !createForm.name.trim()}
                  className="create-exercise-btn"
                >
                  {submitting
                    ? t("member.customExercise.saving")
                    : t("member.customExercise.saveExercise")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmCancel}
        title={t("member.customExercise.discardTitle")}
        message={t("member.customExercise.discardMessage")}
        confirmLabel={t("member.customExercise.discardConfirm")}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          setShowCreateModal(false);
        }}
      />

      {/* Modal Detail Preview */}
      {selectedExercise && (
        <div className="modal-overlay" onClick={() => setSelectedExercise(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setSelectedExercise(null)}
              aria-label={t("member.customExercise.closeAria")}
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
                    className={`level-badge ${getLevelBadgeStyle(selectedExercise.level || selectedExercise.difficultyLevel)}`}
                  >
                    {getLevelLabel(selectedExercise.level || selectedExercise.difficultyLevel || "Intermediate")}
                  </span>
                  <span className="member-badge-pill">{t("member.customExercise.customAddedPill")}</span>
                </div>
              </div>
            </div>

            <div style={{ background: "#17102b", padding: 16, borderRadius: 10, marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: "#a89bd0", marginBottom: 6 }}>
                {t("member.customExercise.parameters")}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#c084fc" }}>
                {selectedExercise.details ||
                  t("member.customExercise.detailSummary", {
                    muscle:
                      selectedExercise.muscleGroup
                      || t("member.customExercise.defaultFullBody"),
                    sets: selectedExercise.sets || t("member.customExercise.defaultSets"),
                    reps:
                      selectedExercise.repsOrDuration
                      || t("member.customExercise.defaultReps"),
                    equipment:
                      selectedExercise.equipment
                      || t("member.customExercise.defaultEquipment"),
                  })}
              </div>
            </div>

            <p style={{ color: "#a89bd0", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px 0" }}>
              {selectedExercise.description
                || t("member.customExercise.defaultDescription")}
            </p>

            <button
              type="button"
              className="empty-clear-btn"
              style={{ width: "100%", padding: "11px 0" }}
              onClick={() => setSelectedExercise(null)}
            >
              {t("member.customExercise.close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
