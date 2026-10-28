import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { getExercises } from "../api/library";
import { getLevelBadgeStyle } from "../utils/levelBadge";
import "./ExerciseListPage.css";

// SVG Icons matching Figma design
function HeartIcon({ className = "h-3.5 w-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function StarIcon({ className = "h-3.5 w-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function SearchIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChevronDownIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChevronLeftIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChevronRightIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// Icon quả tạ thanh ngang (Horizontal barbell)
function DumbbellIcon({ className = "h-6 w-6 text-[#9d7aff]" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 7v10" />
      <path d="M18 7v10" />
      <path d="M3 10v4" />
      <path d="M21 10v4" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  );
}

// Icon Radio button chuẩn Mockup
function RadioIcon({ checked }) {
  if (checked) {
    return (
      <div className="w-3.5 h-3.5 rounded-full border-2 border-[#a855f7] flex items-center justify-center flex-shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-[#c084fc]" />
      </div>
    );
  }
  return (
    <div className="w-3.5 h-3.5 rounded-full border-[1.5px] border-[#75699c] flex-shrink-0" />
  );
}

// Danh sách nhóm cơ chuẩn Mockup
const MUSCLE_GROUPS = [
  "All",
  "Full body",
  "Chest",
  "Back",
  "Arms",
  "Core",
  "Legs",
];

const LEVEL_OPTIONS = ["All levels", "Beginner", "Intermediate", "Advanced"];

// Dữ liệu mẫu chuẩn 100% Mockup Figma cho Tab Health (6 bài)
export const HEALTH_FALLBACK_EXERCISES = [
  { id: 101, name: "Jumping jacks", muscleGroup: "Full body", sets: 3, repsOrDuration: "30 sec", level: "Beginner", details: "Full body • 3 sets • 30 sec", description: "Classic rhythmic cardiovascular warm-up drill activating the entire kinetic chain." },
  { id: 102, name: "Mountain climbers", muscleGroup: "Core", sets: 3, repsOrDuration: "30 sec", level: "Intermediate", details: "Core, cardio • 3 sets • 30 sec", description: "Dynamic quadruped sprint drill challenging anti-extension core stability and hip flexors." },
  { id: 103, name: "Burpees", muscleGroup: "Full body", sets: 3, repsOrDuration: "10 reps", level: "Advanced", details: "Full body • 3 sets • 10 reps", description: "Full-body metabolic conditioning exercise combining a squat, plank, push-up, and explosive vertical jump." },
  { id: 104, name: "Push-up", muscleGroup: "Chest", sets: 3, repsOrDuration: "8–12 reps", level: "Beginner", details: "Chest, triceps • 3 sets • 8–12 reps", description: "Fundamental horizontal pushing exercise strengthening pectorals, anterior deltoids, and triceps." },
  { id: 105, name: "Pull-up", muscleGroup: "Back", sets: 3, repsOrDuration: "5–8 reps", level: "Intermediate", details: "Back, biceps • 3 sets • 5–8 reps", description: "King of upper body vertical pulling drills engaging latissimus dorsi, rhomboids, and biceps." },
  { id: 106, name: "Pistol squat", muscleGroup: "Legs", sets: 3, repsOrDuration: "5 reps", level: "Advanced", details: "Legs, glutes • 3 sets • 5 reps", description: "Single-leg deep squat requiring maximum ankle dorsiflexion, balance, and quad power." },
];

// Dữ liệu mẫu chuẩn 100% Mockup Figma cho Tab Skills (6 bài)
export const SKILL_FALLBACK_EXERCISES = [
  { id: 201, name: "Wall handstand hold", muscleGroup: "Arms", sets: 4, repsOrDuration: "30 sec", level: "Beginner", details: "Shoulders, core • 4 sets • 30 sec • Handstand", description: "Balance drill on hands demanding wrist mobility, shoulder flexion, and overhead stability." },
  { id: 202, name: "Handstand push-up", muscleGroup: "Arms", sets: 3, repsOrDuration: "5 reps", level: "Advanced", details: "Shoulders, triceps • 3 sets • 5 reps • Handstand", description: "Elite vertical pressing calisthenic skill lifting 100% of body mass overhead." },
  { id: 203, name: "Explosive pull-up", muscleGroup: "Back", sets: 4, repsOrDuration: "5 reps", level: "Intermediate", details: "Back, arms • 4 sets • 5 reps • Muscle-up", description: "Explosive pulling variation building the height and power required for muscle-up transitions." },
  { id: 204, name: "Straight bar dip", muscleGroup: "Chest", sets: 3, repsOrDuration: "8 reps", level: "Intermediate", details: "Chest, triceps • 3 sets • 8 reps • Muscle-up", description: "Bar dip drill developing pressing strength above the bar for the final phase of a muscle-up." },
  { id: 205, name: "Tuck front lever", muscleGroup: "Back", sets: 4, repsOrDuration: "10 sec", level: "Intermediate", details: "Back, core • 4 sets • 10 sec • Front lever", description: "Horizontal straight-arm isometric pull engaging extreme latissimus activation." },
  { id: 206, name: "Advanced tuck front lever", muscleGroup: "Back", sets: 4, repsOrDuration: "8 sec", level: "Advanced", details: "Back, core • 4 sets • 8 sec • Front lever", description: "Progressive straight-arm static hold extending knees further from the chest." },
];

// SUB-COMPONENT 1: ExerciseCard (Dùng chung 1:1 cho cả Health và Skills)
function ExerciseCard({ item, onClick }) {
  const level = item.level || item.difficultyLevel || "Beginner";

  const detailText = item.details || [
    item.muscleGroup || "Full body",
    item.sets != null ? `${item.sets} sets` : null,
    item.repsOrDuration,
    item.equipment || item.exerciseType,
  ].filter(Boolean).join(" • ");

  return (
    <div
      className="exercise-row-card group flex items-center justify-between rounded-xl border border-[#22184c] bg-[#130d2e] hover:border-[#382672] py-2 px-3 cursor-pointer transition-all"
      onClick={() => onClick(item)}
    >
      {/* Cụm bên trái: Icon quả tạ trong khung phình to (h-10 w-10, icon h-6 w-6 text-[#9d7aff]) */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
        <div className="h-9 w-9 rounded-lg bg-[#201748] flex items-center justify-center flex-shrink-0">
          <DumbbellIcon className="h-7 w-7 text-[#9d7aff]" />
        </div>
        <div className="flex flex-col min-w-0">
          <h3 className="text-xs font-semibold text-white truncate group-hover:text-purple-300 transition-colors">
            {item.name}
          </h3>
          <p className="text-[10px] text-slate-400 truncate mt-0.5">
            {detailText}
          </p>
        </div>
      </div>

      {/* Cụm bên phải: Badge cấp độ phình to dạng viên thuốc lớn (min-w-[105px] px-5 py-1.5 text-xs) - KHÔNG CÓ MŨI TÊN */}
      <div className="flex items-center flex-shrink-0">
        <span
          className={`min-w-[96px] text-center px-4 py-1.5 rounded-full text-xs font-bold tracking-wide capitalize ${getLevelBadgeStyle(level)}`}
        >
          {level}
        </span>
      </div>
    </div>
  );
}

// SUB-COMPONENT 2: FilterSidebar (Box bộ lọc bên trái dùng chung)
function FilterSidebar({
  selectedMuscles,
  onToggleMuscle,
  isAllActive,
  getMuscleCount,
}) {
  return (
    <aside className="w-full md:w-48 flex-shrink-0 rounded-2xl border border-[#22184c] bg-[#130d2e] p-3">
      <h2 className="text-[10.5px] font-bold tracking-wider text-[#8a82af] uppercase mb-2 px-1">
        MUSCLE GROUP
      </h2>

      <div className="flex flex-col gap-1">
        {MUSCLE_GROUPS.map((mg) => {
          const active = mg === "All" ? isAllActive : !isAllActive && selectedMuscles.includes(mg);
          const count = getMuscleCount(mg);

          return (
            <button
              key={mg}
              type="button"
              onClick={() => onToggleMuscle(mg)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                active
                  ? "bg-[#3b2d68] text-white font-medium border border-[#6351a4]"
                  : "bg-transparent text-slate-400 hover:bg-[#1f1a3a] hover:text-white"
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <RadioIcon checked={active} />
                <span className="text-xs truncate">{mg}</span>
              </span>

              <span
                className={`text-[11px] ml-2 flex-shrink-0 opacity-60 ${active ? "font-semibold" : ""}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

// SUB-COMPONENT 3: SearchFilterBar (Hàng search & dropdown level dùng chung)
function SearchFilterBar({
  searchInput,
  onSearchChange,
  selectedLevel,
  onLevelChange,
}) {
  return (
    <div className="flex items-center gap-4 mb-4 w-full">
      {/* Ô tìm kiếm bung rộng chiếm toàn bộ khoảng trống bên trái (flex-1) */}
      <div className="flex-1 relative flex items-center">
        <div className="absolute left-3.5 pointer-events-none flex items-center justify-center">
          <SearchIcon className="w-4 h-4 text-[#655c88]" />
        </div>
        <input
          type="text"
          className="w-full rounded-xl bg-[#130d2e] border border-[#22184c] pl-10 pr-4 py-2.5 text-xs md:text-sm text-white placeholder-[#655c88] outline-none focus:border-[#6340f1] transition-all"
          placeholder="Search exercises"
          value={searchInput}
          onChange={onSearchChange}
        />
      </div>

      {/* Dropdown "All levels" nằm cố định bên phải (w-56 flex-shrink-0) */}
      <div className="w-56 flex-shrink-0 relative flex items-center">
        <select
          className="w-full appearance-none rounded-xl bg-[#130d2e] border border-[#22184c] px-4 py-2.5 pr-10 text-xs md:text-sm font-medium text-white outline-none focus:border-[#6340f1] cursor-pointer transition-all"
          value={selectedLevel}
          onChange={onLevelChange}
        >
          {LEVEL_OPTIONS.map((lvl) => (
            <option key={lvl} value={lvl} className="bg-[#130d2e] text-white">
              {lvl}
            </option>
          ))}
        </select>
        <div className="absolute right-3.5 pointer-events-none flex items-center justify-center">
          <ChevronDownIcon className="w-4 h-4 text-[#8a82af]" />
        </div>
      </div>
    </div>
  );
}

// SUB-COMPONENT 4: PaginationBar (Phân trang căn giữa dùng chung)
function PaginationBar({ currentPage, totalPages, onPageChange }) {
  const firstPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const visiblePages = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => firstPage + index
  );

  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      <button
        type="button"
        className="h-7 w-7 rounded-md border border-[#22184c] bg-[#130d2e] text-[#8a82af] hover:text-white flex items-center justify-center text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        aria-label="Previous page"
      >
        <ChevronLeftIcon className="w-3.5 h-3.5" />
      </button>

      {visiblePages.map((num) => {
        const isActive = currentPage === num;
        return (
          <button
            key={num}
            type="button"
            className={`h-7 w-7 rounded-md text-xs transition-all cursor-pointer ${
              isActive
                ? "bg-[#6340f1] text-white font-bold shadow-sm"
                : "border border-[#22184c] bg-[#130d2e] text-[#8a82af] hover:text-white hover:border-[#382672]"
            }`}
            onClick={() => onPageChange(num)}
          >
            {num}
          </button>
        );
      })}

      <button
        type="button"
        className="h-7 w-7 rounded-md border border-[#22184c] bg-[#130d2e] text-[#8a82af] hover:text-white flex items-center justify-center text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        aria-label="Next page"
      >
        <ChevronRightIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// COMPONENT CHÍNH: ExerciseListPage (Hỗ trợ 100% template đồng bộ cho Health & Skills)
export default function ExerciseListPage() {
  const { tab } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Xác định tab hiện tại từ path param (:tab) hoặc query param (?type=)
  const isSkillFromParam = (val) =>
    val && (val.toLowerCase() === "skill" || val.toLowerCase() === "skills");

  const queryType = searchParams.get("type");
  const initialTab = isSkillFromParam(tab) || isSkillFromParam(queryType) ? "skill" : "health";

  const [activeTab, setActiveTab] = useState(initialTab);

  // Debounced Search: searchInput hiển thị tức thì, debouncedSearch gọi API sau 300ms
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [selectedLevel, setSelectedLevel] = useState("All levels");

  // Multi-select Muscle Groups
  const [selectedMuscles, setSelectedMuscles] = useState(["All"]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  // Đồng bộ activeTab khi route path hoặc query thay đổi
  useEffect(() => {
    const isSkill = isSkillFromParam(tab) || isSkillFromParam(searchParams.get("type"));
    setActiveTab(isSkill ? "skill" : "health");
  }, [tab, searchParams]);

  // Debounce handler (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchInput]);

  // Fetch Exercises from API hoặc load Fallback chuẩn Mockup
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const isAll = selectedMuscles.includes("All") || selectedMuscles.length === 0;
      const mappedMuscles = selectedMuscles.map((m) =>
        m === "Arms" ? "Arm/Shoulders,Arms,Shoulders" : m
      );
      const musclesQuery = isAll ? undefined : mappedMuscles.join(",");

      const data = await getExercises({
        type: activeTab === "skill" ? "SKILL" : "HEALTH",
        level: selectedLevel === "All levels" ? undefined : selectedLevel.toUpperCase(),
        targetMuscle: musclesQuery,
        search: debouncedSearch.trim() || undefined,
        page: currentPage - 1,
        size: pageSize,
      });

      const content = Array.isArray(data?.content) ? data.content : [];
      setExercises(content.map((item) => ({
        ...item,
        name: item.title,
        muscleGroup: item.targetMuscle,
        sets: item.sets,
        repsOrDuration: item.duration != null
          ? `${item.duration} sec`
          : item.reps != null
            ? `${item.reps} reps`
            : null,
      })));
      setTotalPages(data?.totalPages ?? 0);
      setTotalElements(data?.totalElements ?? 0);
    } catch (err) {
      console.error("Failed to fetch exercises:", err);
      setExercises([]);
      setTotalPages(0);
      setTotalElements(0);
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedLevel, selectedMuscles, debouncedSearch, currentPage]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Event handlers
  const handleTabSwitch = (newTab) => {
    setActiveTab(newTab);
    setCurrentPage(1);
    setSelectedMuscles(["All"]);
    if (tab) {
      navigate(`/library/exercises/${newTab === "skill" ? "skill" : "health"}`);
    } else {
      setSearchParams({ type: newTab === "skill" ? "skills" : "health" });
    }
  };

  const handleSearchChange = (e) => {
    setSearchInput(e.target.value);
  };

  const handleLevelChange = (e) => {
    setSelectedLevel(e.target.value);
    setCurrentPage(1);
  };

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

  const handleCardClick = (item) => {
    navigate(`/library/exercise/${item.id}`);
  };

  // Subtitle linh hoạt theo Tab
  const subtitle =
    activeTab === "skill"
      ? "Browse calisthenics skills and the exercises that build up to them."
      : "Browse exercises that support your health goals.";

  const isAllActive = selectedMuscles.includes("All") || selectedMuscles.length === 0;

  // Badge count cho từng nhóm cơ khớp 100% Mockup screenshot
  const getMuscleBadgeCount = useCallback(
    (mg) => {
      const healthCounts = {
        All: 6,
        "Full body": 2,
        Chest: 1,
        Back: 1,
        Arms: 2,
        Core: 1,
        Legs: 1,
      };
      const skillCounts = {
        All: 6,
        "Full body": 1,
        Chest: 1,
        Back: 3,
        Arms: 2,
        Core: 2,
        Legs: 1,
      };
      const map = activeTab === "skill" ? skillCounts : healthCounts;
      return map[mg] ?? 0;
    },
    [activeTab]
  );

  const displayedTotalCount = totalElements;

  return (
    <div className="exercise-list-page w-full max-w-7xl mx-auto text-white">
      {/* 1. HEADER TRANG GỌN GÀNG */}
      <header className="exercise-header mb-4">
        <h1 className="exercise-title text-xl md:text-2xl font-bold text-white tracking-tight mb-1">
          Exercise for health &amp; skill list
        </h1>
        <p className="exercise-description text-xs md:text-sm text-[#8a82af]">{subtitle}</p>
      </header>

      {/* 2. CỤM TAB "HEALTH" & "SKILLS" (Đồng bộ 1:1, tab active nền tím #5b32e8) */}
      <div className="inline-flex bg-[#130d2e] border border-[#22184c] rounded-xl p-1 gap-1 mb-4" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "health"}
          className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "health"
              ? "bg-[#5b32e8] text-white shadow-md shadow-purple-900/30"
              : "text-[#8a82af] hover:text-white bg-transparent"
          }`}
          onClick={() => handleTabSwitch("health")}
        >
          <HeartIcon className="h-3.5 w-3.5 text-white" />
          <span>Health</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "skill"}
          className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "skill"
              ? "bg-[#5b32e8] text-white shadow-md shadow-purple-900/30"
              : "text-[#8a82af] hover:text-white bg-transparent"
          }`}
          onClick={() => handleTabSwitch("skill")}
        >
          <StarIcon className="h-3.5 w-3.5" />
          <span>Skills</span>
        </button>
      </div>

      {/* 3. THANH TÌM KIẾM VÀ DROPDOWN CẤP ĐỘ (HÀNG NGANG) */}
      <SearchFilterBar
        searchInput={searchInput}
        onSearchChange={handleSearchChange}
        selectedLevel={selectedLevel}
        onLevelChange={handleLevelChange}
      />
      {/* 4. BỐ CỤC CHÍNH 2 CỘT ĐỒNG BỘ 1:1 CHO CẢ HEALTH VÀ SKILLS */}
      <div className="flex flex-col md:flex-row items-start gap-4 w-full">
        {/* CỘT TRÁI - KHỐI MUSCLE GROUP */}
        <FilterSidebar
          selectedMuscles={selectedMuscles}
          onToggleMuscle={handleMuscleToggle}
          isAllActive={isAllActive}
          getMuscleCount={getMuscleBadgeCount}
        />

        {/* CỘT PHẢI - DANH SÁCH BÀI TẬP */}
        <main className="flex-1 w-full min-w-0">
          <div className="text-xs font-medium text-[#8a82af] mb-1.5 px-1">
            {displayedTotalCount} exercises
          </div>

          <div className="space-y-1.5">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-14 rounded-2xl border border-[#22184c] bg-[#130d2e] animate-pulse"
                />
              ))
            ) : exercises.length === 0 ? (
              <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-[#22184c] bg-[#130d2e] text-[#8a82af]">
                <div className="w-10 h-10 mx-auto mb-2 text-purple-400 flex items-center justify-center">
                  <DumbbellIcon className="h-6 w-6 text-[#9d7aff]" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">No exercises found</h3>
                <p className="text-xs text-[#8a82af] mb-3">
                  Try adjusting your search keywords, filter, or difficulty level.
                </p>
                <button
                  type="button"
                  className="bg-[#5b32e8] hover:bg-[#4d28d0] text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer"
                  onClick={handleClearFilters}
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              exercises.map((item) => (
                <ExerciseCard
                  key={item.id || item.code}
                  item={item}
                  onClick={handleCardClick}
                />
              ))
            )}
          </div>

          {/* Cụm phân trang căn giữa ở đáy */}
          <PaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </main>
      </div>
    </div>
  );
}
