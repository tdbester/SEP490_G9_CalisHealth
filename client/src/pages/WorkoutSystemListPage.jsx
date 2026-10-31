import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { getSystemWorkouts } from "../api/library";
import { getLevelBadgeStyle } from "../utils/levelBadge";
import "./ExerciseListPage.css";

const MUSCLE_GROUPS = ["All", "Full body", "Chest", "Back", "Arms", "Core", "Legs"];
const LEVEL_OPTIONS = ["All levels", "Beginner", "Intermediate", "Advanced"];
const PAGE_SIZE = 5;

function toNumberOrNull(value) {
  if (value == null) return null;
  const parsed = Number(String(value).match(/\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export const mockSystemWorkouts = [
  {
    id: 1,
    title: "Full Body Health Maintenance",
    type: "health",
    level: "BEGINNER",
    muscleGroup: "Full body",
    exerciseCount: 5,
    totalSets: 15,
    totalTime: "20 min",
    description: "Daily full body routine for mobility and wellness.",
    exercises: [
      { id: 11, name: "Jumping Jacks", sets: 3, reps: "30 reps", rest: "45s", muscleGroup: "Full body", level: "Beginner" },
      { id: 12, name: "Bodyweight Squat", sets: 3, reps: "12 reps", rest: "60s", muscleGroup: "Legs", level: "Beginner" },
      { id: 13, name: "Push-up", sets: 3, reps: "10 reps", rest: "60s", muscleGroup: "Chest", level: "Beginner" },
      { id: 14, name: "Glute Bridge", sets: 3, reps: "12 reps", rest: "45s", muscleGroup: "Legs", level: "Beginner" },
      { id: 15, name: "Plank", sets: 3, duration: "30 sec", rest: "45s", muscleGroup: "Core", level: "Beginner" },
    ],
  },
  {
    id: 2,
    title: "Core & Posture Booster",
    type: "health",
    level: "INTERMEDIATE",
    muscleGroup: "Core",
    exerciseCount: 4,
    totalSets: 12,
    totalTime: "15 min",
    description: "Strengthen core stability and spinal alignment.",
    exercises: [
      { id: 21, name: "Dead Bug", sets: 3, reps: "10 reps", rest: "45s", muscleGroup: "Core", level: "Beginner" },
      { id: 22, name: "Bird Dog", sets: 3, reps: "10 reps", rest: "45s", muscleGroup: "Core", level: "Beginner" },
      { id: 23, name: "Side Plank", sets: 3, duration: "30 sec", rest: "45s", muscleGroup: "Core", level: "Intermediate" },
      { id: 24, name: "Superman Hold", sets: 3, duration: "30 sec", rest: "45s", muscleGroup: "Back", level: "Intermediate" },
    ],
  },
  {
    id: 3,
    title: "Upper Body Endurance",
    type: "health",
    level: "BEGINNER",
    muscleGroup: "Arms",
    exerciseCount: 6,
    totalSets: 18,
    totalTime: "25 min",
    description: "Light push and pull endurance workout.",
    exercises: [
      { id: 31, name: "Incline Push-up", sets: 3, reps: "12 reps", rest: "60s", muscleGroup: "Chest", level: "Beginner" },
      { id: 32, name: "Knee Push-up", sets: 3, reps: "12 reps", rest: "60s", muscleGroup: "Arms", level: "Beginner" },
      { id: 33, name: "Australian Row", sets: 3, reps: "10 reps", rest: "60s", muscleGroup: "Back", level: "Beginner" },
      { id: 34, name: "Arm Circles", sets: 3, duration: "30 sec", rest: "30s", muscleGroup: "Arms", level: "Beginner" },
      { id: 35, name: "Wall Push-up", sets: 3, reps: "15 reps", rest: "45s", muscleGroup: "Chest", level: "Beginner" },
      { id: 36, name: "Superman", sets: 3, reps: "12 reps", rest: "45s", muscleGroup: "Back", level: "Beginner" },
    ],
  },
  {
    id: 4,
    title: "Legs & Lower Body Wellness",
    type: "health",
    level: "BEGINNER",
    muscleGroup: "Legs",
    exerciseCount: 4,
    totalSets: 12,
    totalTime: "18 min",
    description: "Bodyweight leg exercises for muscle tone.",
    exercises: [
      { id: 41, name: "Bodyweight Squat", sets: 3, reps: "15 reps", rest: "60s", muscleGroup: "Legs", level: "Beginner" },
      { id: 42, name: "Reverse Lunge", sets: 3, reps: "10 reps", rest: "60s", muscleGroup: "Legs", level: "Beginner" },
      { id: 43, name: "Calf Raise", sets: 3, reps: "15 reps", rest: "45s", muscleGroup: "Legs", level: "Beginner" },
      { id: 44, name: "Glute Bridge", sets: 3, reps: "12 reps", rest: "45s", muscleGroup: "Legs", level: "Beginner" },
    ],
  },
  {
    id: 101,
    title: "Handstand Progression Workout",
    type: "skills",
    level: "INTERMEDIATE",
    muscleGroup: "Arms",
    exerciseCount: 5,
    totalSets: 15,
    totalTime: "30 min",
    description: "Balance drills and shoulder conditioning for handstand.",
    exercises: [
      { id: 1011, name: "Pike Push-up", sets: 4, reps: "10 reps", rest: "60s", muscleGroup: "Shoulders/Arms", level: "Intermediate" },
      { id: 1012, name: "Wall Handstand Hold", sets: 4, duration: "30 sec", rest: "60s", muscleGroup: "Shoulders/Core", level: "Intermediate" },
      { id: 1013, name: "Hollow Body Hold", sets: 4, duration: "45 sec", rest: "45s", muscleGroup: "Core", level: "Beginner" },
      { id: 1014, name: "Wrist Lean", sets: 3, duration: "30 sec", rest: "45s", muscleGroup: "Arms", level: "Beginner" },
      { id: 1015, name: "Wall Walk", sets: 3, reps: "5 reps", rest: "60s", muscleGroup: "Shoulders", level: "Intermediate" },
    ],
  },
  {
    id: 102,
    title: "Front Lever Foundations",
    type: "skills",
    level: "ADVANCED",
    muscleGroup: "Back",
    exerciseCount: 4,
    totalSets: 16,
    totalTime: "35 min",
    description: "Targeted pulling strength for front lever holds.",
    exercises: [
      { id: 1021, name: "Tuck Front Lever Hold", sets: 4, duration: "12 sec", rest: "90s", muscleGroup: "Back/Core", level: "Intermediate" },
      { id: 1022, name: "Scapular Pull-up", sets: 4, reps: "8 reps", rest: "75s", muscleGroup: "Back", level: "Intermediate" },
      { id: 1023, name: "Inverted Row", sets: 4, reps: "10 reps", rest: "75s", muscleGroup: "Back", level: "Intermediate" },
      { id: 1024, name: "Hollow Body Hold", sets: 4, duration: "30 sec", rest: "60s", muscleGroup: "Core", level: "Beginner" },
    ],
  },
  {
    id: 103,
    title: "Planche Strength Builder",
    type: "skills",
    level: "ADVANCED",
    muscleGroup: "Full body",
    exerciseCount: 5,
    totalSets: 15,
    totalTime: "40 min",
    description: "Straight-arm pushing progressions for planche.",
    exercises: [
      { id: 1031, name: "Planche Lean", sets: 3, duration: "20 sec", rest: "90s", muscleGroup: "Shoulders/Core", level: "Intermediate" },
      { id: 1032, name: "Pseudo Planche Push-up", sets: 3, reps: "8 reps", rest: "90s", muscleGroup: "Chest/Arms", level: "Advanced" },
      { id: 1033, name: "Tuck Planche Hold", sets: 3, duration: "10 sec", rest: "120s", muscleGroup: "Full body", level: "Advanced" },
      { id: 1034, name: "Straight-arm Plank", sets: 3, duration: "30 sec", rest: "60s", muscleGroup: "Core", level: "Intermediate" },
      { id: 1035, name: "Wrist Conditioning", sets: 3, reps: "12 reps", rest: "45s", muscleGroup: "Arms", level: "Beginner" },
    ],
  },
  {
    id: 104,
    title: "Muscle-up Explosive Power",
    type: "skills",
    level: "INTERMEDIATE",
    muscleGroup: "Chest",
    exerciseCount: 4,
    totalSets: 12,
    totalTime: "25 min",
    description: "Explosive pull-ups and transition drills.",
    exercises: [
      { id: 1041, name: "Explosive Pull-up", sets: 3, reps: "5 reps", rest: "90s", muscleGroup: "Back/Arms", level: "Advanced" },
      { id: 1042, name: "Jumping Muscle-up Transition", sets: 3, reps: "6 reps", rest: "75s", muscleGroup: "Chest", level: "Intermediate" },
      { id: 1043, name: "Straight Bar Dip", sets: 3, reps: "8 reps", rest: "75s", muscleGroup: "Chest/Arms", level: "Intermediate" },
      { id: 1044, name: "Hollow Body Hold", sets: 3, duration: "30 sec", rest: "45s", muscleGroup: "Core", level: "Beginner" },
    ],
  },
].map((workout) => ({
  ...workout,
  exercises: workout.exercises.map((exercise) => ({
    ...exercise,
    level: exercise.level || "Beginner",
    muscleGroup: exercise.muscleGroup || workout.muscleGroup || "Full body",
    sets: toNumberOrNull(exercise.sets) ?? 3,
    reps: toNumberOrNull(exercise.reps),
    duration: toNumberOrNull(exercise.duration),
    rest: exercise.rest || "60s",
    description: exercise.description
      || `${exercise.name} develops ${(exercise.muscleGroup || workout.muscleGroup || "target muscle").toLowerCase()} strength and supports ${(exercise.level || "beginner").toLowerCase()} training.`,
    instructions: exercise.instructions || [
      `Set up in a stable position for ${exercise.name}.`,
      `Perform each repetition with controlled movement and steady breathing.`,
      `Return to the starting position and complete the prescribed sets.`,
    ],
    videoUrl: exercise.videoUrl || "",
    tips: exercise.tips || "Keep your movement controlled and stop if you feel pain.",
  })),
}));

function HeartIcon({ className = "h-3.5 w-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function StarIcon({ className = "h-3.5 w-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function DumbbellIcon({ className = "h-7 w-7 text-[#9d7aff]" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 7v10M18 7v10M3 10v4M21 10v4M3 12h18" />
    </svg>
  );
}

function SearchIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
    </svg>
  );
}

function ChevronDownIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06z" clipRule="evenodd" />
    </svg>
  );
}

function ChevronLeftIcon({ className = "h-3.5 w-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02z" clipRule="evenodd" />
    </svg>
  );
}

function ChevronRightIcon({ className = "h-3.5 w-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06.02z" clipRule="evenodd" />
    </svg>
  );
}

function RadioIcon({ checked }) {
  return checked ? (
    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 border-[#a855f7]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#c084fc]" />
    </span>
  ) : (
    <span className="h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-[#75699c]" />
  );
}

function getLevelLabel(level) {
  const normalized = String(level || "BEGINNER").toUpperCase();
  return normalized.charAt(0) + normalized.slice(1).toLowerCase();
}

function getMinutes(totalTime) {
  const match = String(totalTime || "").match(/\d+/);
  const minutes = match ? Number(match[0]) : 0;
  return Number.isFinite(minutes) ? minutes : 0;
}

function normalizeWorkout(workout) {
  const rawDuration = Number(workout.estimatedDuration ?? workout.duration);
  const duration = Number.isFinite(rawDuration) ? rawDuration : 0;
  const minutesFromLabel = getMinutes(workout.totalTime);
  const totalTime = minutesFromLabel > 0
    ? `${minutesFromLabel} min`
    : `About ${duration} min`;
  return {
    id: workout.id,
    title: workout.title,
    type: String(workout.type || "").toLowerCase(),
    level: getLevelLabel(workout.level),
    muscleGroup: workout.muscleGroup || "Full body",
    exerciseCount: Number(workout.exerciseCount ?? workout.exercisesCount ?? workout.totalExercises ?? 0),
    totalSets: Number.isFinite(Number(workout.totalSets ?? workout.setsCount))
      ? Number(workout.totalSets ?? workout.setsCount)
      : 0,
    totalTime,
    description: workout.description || "",
    isMock: Boolean(workout.isMock),
  };
}

function matchesMuscleGroup(workout, selectedGroup) {
  if (selectedGroup === "All") return true;
  const groups = String(workout.muscleGroup || "")
    .toLowerCase()
    .split(/[,&/]/)
    .map((group) => group.trim());
  if (selectedGroup === "Full body") {
    return groups.some((group) => group.includes("full body") || group.includes("whole body"));
  }
  if (selectedGroup === "Arms") {
    return groups.some((group) => /arm|shoulder|tricep|bicep/.test(group));
  }
  return groups.some((group) => group.includes(selectedGroup.toLowerCase()));
}

function ExerciseCard({ workout, onClick }) {
  const level = workout.level || workout.difficultyLevel || "Intermediate";
  const details = [
    workout.muscleGroup,
    `${workout.exerciseCount} exercises`,
    `${workout.totalSets} sets`,
    workout.totalTime,
  ].filter(Boolean).join(" • ");

  return (
    <button
      type="button"
      onClick={() => onClick(workout)}
      className="exercise-row-card group flex w-full items-center justify-between rounded-xl border border-[#22184c] bg-[#130d2e] px-3 py-2 text-left transition-all hover:border-[#382672]"
    >
      <span className="mr-3 flex min-w-0 flex-1 items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#201748]">
          <DumbbellIcon className="h-7 w-7 text-[#9d7aff]" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-xs font-semibold text-white transition-colors group-hover:text-purple-300">
            {workout.title}
          </span>
          <span className="mt-0.5 truncate text-[10px] text-slate-400">{details}</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center">
        <span className={`min-w-[96px] rounded-full px-4 py-1.5 text-center text-xs font-bold tracking-wide capitalize ${getLevelBadgeStyle(level)}`}>
          {level}
        </span>
      </span>
    </button>
  );
}

function FilterSidebar({ selectedMuscles, onToggleMuscle, isAllActive, getMuscleCount }) {
  return (
    <aside className="w-full shrink-0 rounded-2xl border border-[#22184c] bg-[#130d2e] p-3 md:w-48">
      <h2 className="mb-2 px-1 text-[10.5px] font-bold uppercase tracking-wider text-[#8a82af]">
        MUSCLE GROUP
      </h2>
      <div className="flex flex-col gap-1">
        {MUSCLE_GROUPS.map((muscleGroup) => {
          const active = muscleGroup === "All"
            ? isAllActive
            : !isAllActive && selectedMuscles.includes(muscleGroup);
          return (
            <button
              key={muscleGroup}
              type="button"
              onClick={() => onToggleMuscle(muscleGroup)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                active
                  ? "bg-[#3b2d68] text-white font-medium border border-[#6351a4]"
                  : "bg-transparent text-slate-400 hover:bg-[#1f1a3a] hover:text-white"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <RadioIcon checked={active} />
                <span className="truncate text-xs">{muscleGroup}</span>
              </span>
              <span className={`ml-2 shrink-0 text-[11px] opacity-60 ${active ? "font-semibold" : ""}`}>
                {getMuscleCount(muscleGroup)}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function SearchFilterBar({ searchInput, onSearchChange, selectedLevel, onLevelChange }) {
  return (
    <div className="flex items-center gap-4 mb-4 w-full">
      <div className="flex-1 relative flex items-center">
        <div className="absolute left-3.5 pointer-events-none flex items-center justify-center">
          <SearchIcon className="w-4 h-4 text-[#655c88]" />
        </div>
        <input
          type="text"
          className="w-full rounded-xl bg-[#130d2e] border border-[#22184c] pl-10 pr-4 py-2.5 text-xs md:text-sm text-white placeholder-[#655c88] outline-none focus:border-[#6340f1] transition-all"
          placeholder="Search workouts..."
          value={searchInput}
          onChange={onSearchChange}
        />
      </div>
      <div className="w-56 flex-shrink-0 relative flex items-center">
        <select
          className="w-full appearance-none rounded-xl bg-[#130d2e] border border-[#22184c] px-4 py-2.5 pr-10 text-xs md:text-sm font-medium text-white outline-none focus:border-[#6340f1] cursor-pointer transition-all"
          value={selectedLevel}
          onChange={onLevelChange}
        >
          {LEVEL_OPTIONS.map((option) => (
            <option key={option} value={option} className="bg-[#130d2e] text-white">
              {option}
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
      {visiblePages.map((number) => {
        const isActive = currentPage === number;
        return (
          <button
            key={number}
            type="button"
            className={`h-7 w-7 rounded-md text-xs transition-all cursor-pointer ${
              isActive
                ? "bg-[#6340f1] text-white font-bold shadow-sm"
                : "border border-[#22184c] bg-[#130d2e] text-[#8a82af] hover:text-white hover:border-[#382672]"
            }`}
            onClick={() => onPageChange(number)}
          >
            {number}
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

export default function WorkoutSystemListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedType = searchParams.get("type")?.toLowerCase();
  const activeTab = selectedType === "skill" || selectedType === "skills"
    || (!selectedType && location.pathname.endsWith("/skill"))
    ? "skills"
    : "health";
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("All levels");
  const [selectedMuscles, setSelectedMuscles] = useState(["All"]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [workouts, setWorkouts] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => window.clearTimeout(handler);
  }, [searchInput]);

  const fetchWorkouts = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const firstPage = await getSystemWorkouts({
        type: activeTab === "skills" ? "SKILL" : "HEALTH",
        page: 0,
        size: 5,
      });
      const remainingPages = await Promise.all(
        Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, (_, index) =>
          getSystemWorkouts({
            type: activeTab === "skills" ? "SKILL" : "HEALTH",
            page: index + 1,
            size: 5,
          }),
        ),
      );
      const allWorkouts = [firstPage, ...remainingPages].flatMap((response) => response?.content || []);
      const apiWorkouts = Array.isArray(allWorkouts)
        ? allWorkouts.map((workout) => normalizeWorkout({
            ...workout,
            type: activeTab,
          }))
        : [];
      const matchingApiWorkouts = apiWorkouts.filter((workout) => workout.title);
      setWorkouts(matchingApiWorkouts.length
        ? matchingApiWorkouts
        : mockSystemWorkouts
            .filter((workout) => workout.type === activeTab)
            .map((workout) => normalizeWorkout({ ...workout, isMock: true })));
    } catch (error) {
      console.error("Could not load system workouts; showing sample workouts.", error);
      setWorkouts(mockSystemWorkouts
        .filter((workout) => workout.type === activeTab)
        .map((workout) => normalizeWorkout({ ...workout, isMock: true })));
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  const filteredWorkouts = useMemo(() => {
    const search = debouncedSearch.trim().toLowerCase();
    const allActive = selectedMuscles.includes("All") || selectedMuscles.length === 0;
    return workouts.filter((workout) => {
      const matchesSearch = !search
        || workout.title.toLowerCase().includes(search)
        || workout.description.toLowerCase().includes(search)
        || workout.muscleGroup.toLowerCase().includes(search);
      const matchesLevel = selectedLevel === "All levels" || workout.level === selectedLevel;
      const matchesMuscle = allActive || selectedMuscles.some((muscle) => matchesMuscleGroup(workout, muscle));
      return matchesSearch && matchesLevel && matchesMuscle;
    });
  }, [workouts, debouncedSearch, selectedLevel, selectedMuscles]);

  const totalPages = Math.ceil(filteredWorkouts.length / PAGE_SIZE);
  const visibleWorkouts = filteredWorkouts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const isAllActive = selectedMuscles.includes("All") || selectedMuscles.length === 0;
  const subtitle = "Browse workouts that support your health and skill goals.";

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, Math.max(totalPages, 1)));
  }, [totalPages]);

  const handleTabSwitch = (tab) => {
    setSelectedMuscles(["All"]);
    setSelectedLevel("All levels");
    setCurrentPage(1);
    setSearchParams({ type: tab === "skills" ? "skills" : "health" });
  };

  const handleMuscleToggle = (muscle) => {
    if (muscle === "All") {
      setSelectedMuscles(["All"]);
      setCurrentPage(1);
      return;
    }
    setSelectedMuscles((current) => {
      const withoutAll = current.filter((value) => value !== "All");
      const next = withoutAll.includes(muscle)
        ? withoutAll.filter((value) => value !== muscle)
        : [...withoutAll, muscle];
      return next.length ? next : ["All"];
    });
    setCurrentPage(1);
  };

  const getMuscleCount = useCallback((muscle) => (
    workouts.filter((workout) => matchesMuscleGroup(workout, muscle)).length
  ), [workouts]);

  const handleCardClick = (workout) => {
    const typeParam = activeTab === "skills" ? "skills" : "health";
    const mockParam = workout.isMock ? "&mock=true" : "";
    navigate(`/library/workouts/system/${workout.id}?type=${typeParam}${mockParam}`);
  };

  const clearFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setSelectedLevel("All levels");
    setSelectedMuscles(["All"]);
    setCurrentPage(1);
  };

  return (
    <div className="exercise-list-page w-full max-w-7xl mx-auto text-white">
      <header className="exercise-header mb-4">
        <h1 className="exercise-title text-xl md:text-2xl font-bold text-white tracking-tight mb-1">
          Workout for health &amp; skill list
        </h1>
        <p className="exercise-description text-xs md:text-sm text-[#8a82af]">{subtitle}</p>
      </header>

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
          aria-selected={activeTab === "skills"}
          className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "skills"
              ? "bg-[#5b32e8] text-white shadow-md shadow-purple-900/30"
              : "text-[#8a82af] hover:text-white bg-transparent"
          }`}
          onClick={() => handleTabSwitch("skills")}
        >
          <StarIcon className="h-3.5 w-3.5" />
          <span>Skills</span>
        </button>
      </div>

      <SearchFilterBar
        searchInput={searchInput}
        onSearchChange={(event) => setSearchInput(event.target.value)}
        selectedLevel={selectedLevel}
        onLevelChange={(event) => {
          setSelectedLevel(event.target.value);
          setCurrentPage(1);
        }}
      />

      <div className="flex flex-col md:flex-row items-start gap-4 w-full">
        <FilterSidebar
          selectedMuscles={selectedMuscles}
          onToggleMuscle={handleMuscleToggle}
          isAllActive={isAllActive}
          getMuscleCount={getMuscleCount}
        />

        <main className="flex-1 w-full min-w-0">
          <div className="text-xs font-medium text-[#8a82af] mb-1.5 px-1">
            {filteredWorkouts.length} workouts
          </div>
          <div className="space-y-1.5">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-14 rounded-2xl border border-[#22184c] bg-[#130d2e] animate-pulse"
                />
              ))
            ) : errorMessage ? (
              <div role="alert" className="rounded-2xl border border-rose-900 bg-rose-950/40 p-5 text-sm text-rose-200">
                {errorMessage}
              </div>
            ) : visibleWorkouts.length === 0 ? (
              <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-[#22184c] bg-[#130d2e] text-[#8a82af]">
                <div className="w-10 h-10 mx-auto mb-2 text-purple-400 flex items-center justify-center">
                  <DumbbellIcon className="h-6 w-6 text-[#9d7aff]" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">No workouts found</h3>
                <p className="text-xs text-[#8a82af] mb-3">
                  Try adjusting your search keywords, filter, or difficulty level.
                </p>
                <button
                  type="button"
                  className="bg-[#5b32e8] hover:bg-[#4d28d0] text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer"
                  onClick={clearFilters}
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              visibleWorkouts.map((workout) => (
                <ExerciseCard key={`${workout.type}-${workout.id}`} workout={workout} onClick={handleCardClick} />
              ))
            )}
          </div>
          <PaginationBar currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </main>
      </div>
    </div>
  );
}
