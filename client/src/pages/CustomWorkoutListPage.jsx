import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCommunityWorkouts } from "../api/library";
import { getLevelBadgeStyle } from "../utils/levelBadge";

const STORAGE_KEY = "custom_workouts";
const PERSONAL_STORAGE_KEY = "my_custom_workouts";

const customWorkouts = [
  {
    id: "1",
    title: "Upper body push day",
    level: "Intermediate",
    description: "Shoulder and tricep focus, finishing with a core hold.",
    author: { name: "Linh Tran", avatarText: "LT" },
    postedTime: "2 days ago",
    savesCount: 42,
    exercisesCount: 3,
    setsCount: 9,
    duration: "About 9 min",
  },
  {
    id: "2",
    title: "Beginner full body",
    level: "Beginner",
    description: "Easy start for the first weeks. Rest as long as you need.",
    author: { name: "An Nguyen", avatarText: "AN" },
    postedTime: "4 days ago",
    savesCount: 97,
    exercisesCount: 4,
    setsCount: 12,
    duration: "About 14 min",
  },
  {
    id: "3",
    title: "Planche progression",
    level: "Advanced",
    description: "Shoulder strength and wrist prep for planche training.",
    author: { name: "Minh Pham", avatarText: "MP" },
    postedTime: "1 week ago",
    savesCount: 31,
    exercisesCount: 3,
    setsCount: 11,
    duration: "About 15 min",
  },
  {
    id: "4",
    title: "10-minute core",
    level: "Beginner",
    description: "Quick core session you can do anywhere.",
    author: { name: "Mai Vo", avatarText: "MV" },
    postedTime: "1 week ago",
    savesCount: 67,
    exercisesCount: 2,
    setsCount: 6,
    duration: "About 6 min",
  },
  {
    id: "5",
    title: "Pull day basics",
    level: "Intermediate",
    description: "Build up to your first strict pull-up.",
    author: { name: "Duc Hoang", avatarText: "DH" },
    postedTime: "2 weeks ago",
    savesCount: 54,
    exercisesCount: 4,
    setsCount: 13,
    duration: "About 15 min",
  },
];

function loadCustomWorkouts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let communityWorkouts = customWorkouts;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        communityWorkouts = parsed;
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(customWorkouts));
      }
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customWorkouts));
    }

    const personalRaw = localStorage.getItem(PERSONAL_STORAGE_KEY);
    const personalWorkouts = personalRaw ? JSON.parse(personalRaw) : [];
    if (!Array.isArray(personalWorkouts)) {
      throw new Error("Saved personal workouts are not in the expected format.");
    }

    const sharedWorkouts = personalWorkouts
      .filter((workout) => workout.isShared)
      .map((workout) => {
        const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
        const exercisesCount = Number(workout.exercisesCount ?? exercises.length);
        const setsCount = Number(
          workout.setsCount ??
            exercises.reduce((total, exercise) => total + Number(exercise.sets || 0), 0)
        );
        const estimatedMinutes = Math.max(1, Math.round(setsCount));

        return {
          ...workout,
          author: workout.author || { name: "You", avatarText: "YO" },
          postedTime:
            workout.postedTime ||
            workout.createdLabel?.replace(/^Created\s+/i, "") ||
            "Just now",
          savesCount: Number(workout.savesCount || 0),
          exercisesCount,
          setsCount,
          duration: workout.duration || `About ${estimatedMinutes} min`,
        };
      });
    const communityIds = new Set(communityWorkouts.map((workout) => String(workout.id)));
    return [
      ...sharedWorkouts.filter((workout) => !communityIds.has(String(workout.id))),
      ...communityWorkouts,
    ];
  } catch {
    return customWorkouts;
  }
}

function BarbellIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 7v10" />
      <path d="M18 7v10" />
      <path d="M3 10v4" />
      <path d="M21 10v4" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  );
}

function ListIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 6h2v2H4zm0 5h2v2H4zm0 5h2v2H4zm4-10h14v2H8zm0 5h14v2H8zm0 5h14v2H8z" />
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

function LevelBadge({ level }) {
  const displayLevel = level || "Intermediate";
  return (
    <span className={`rounded-full px-3 py-0.5 text-[11px] font-medium capitalize ${getLevelBadgeStyle(displayLevel)}`}>
      {displayLevel}
    </span>
  );
}

function parseMinutes(duration) {
  const match = String(duration).match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function FilterDropdown({ value, onChange, options, widthClass }) {
  return (
    <div className={`relative h-7 ${widthClass} min-w-0`}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="block h-7 w-full min-w-0 rounded-lg border border-[#302653] bg-[#1b1538] px-2.5 pr-7 text-[10px] leading-none text-slate-200 cursor-pointer appearance-none focus:outline-none focus:border-[#6340f1]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-[#120d29] text-slate-300">
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute inset-y-0 right-2 my-auto h-3 w-3 text-slate-400" />
    </div>
  );
}

const LEVEL_OPTIONS = [
  { value: "all", label: "All levels" },
  { value: "Beginner", label: "Beginner" },
  { value: "Intermediate", label: "Intermediate" },
  { value: "Advanced", label: "Advanced" },
];

const LENGTH_OPTIONS = [
  { value: "all", label: "Any length" },
  { value: "short", label: "Under 10 min" },
  { value: "medium", label: "10–15 min" },
  { value: "long", label: "Over 15 min" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "saved", label: "Most saved" },
];

export default function CustomWorkoutListPage() {
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [length, setLength] = useState("all");
  const [sort, setSort] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  useEffect(() => {
    let active = true;
    const loadWorkouts = async () => {
      const firstPage = await getCommunityWorkouts({ page: 0, size: 5 });
      const remainingPages = await Promise.all(
        Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, (_, index) =>
          getCommunityWorkouts({ page: index + 1, size: 5 }),
        ),
      );
      if (active) {
        setWorkouts([firstPage, ...remainingPages].flatMap((response) => response.content || []));
      }
    };
    loadWorkouts()
      .catch((error) => {
        if (active) {
          setErrorMessage(error.response?.data?.message || "Could not load community workouts.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredWorkouts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const next = workouts.filter((workout) => {
      const matchesQuery =
        !needle ||
        workout.title.toLowerCase().includes(needle) ||
        workout.author?.name?.toLowerCase().includes(needle);
      const matchesLevel = level === "all" || workout.level === level;
      const minutes = parseMinutes(workout.duration);
      const matchesLength =
        length === "all" ||
        (length === "short" && minutes < 10) ||
        (length === "medium" && minutes >= 10 && minutes <= 15) ||
        (length === "long" && minutes > 15);
      return matchesQuery && matchesLevel && matchesLength;
    });

    if (sort === "saved") {
      return [...next].sort((a, b) => b.savesCount - a.savesCount);
    }
    if (sort === "oldest") {
      return [...next].reverse();
    }
    return next;
  }, [workouts, query, level, length, sort]);
  const totalPages = Math.ceil(filteredWorkouts.length / pageSize);
  const visibleWorkouts = filteredWorkouts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    } else if (totalPages === 0 && currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Custom workout list</h1>
          <p className="text-xs text-slate-400 mt-1">
            Workouts other members built from accepted exercises. Browse them for ideas.
          </p>
        </div>
        {errorMessage && <p role="alert" className="text-xs text-rose-400">{errorMessage}</p>}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/library/workouts")}
            className="rounded-xl border border-[#2b2257] bg-[#14102e] hover:bg-[#1f1945] text-slate-200 text-xs font-semibold px-4 py-2.5 flex items-center gap-2 transition-all"
          >
            <ListIcon />
            My custom workouts
          </button>
          <button
            type="button"
            onClick={() => navigate("/library/workouts/new")}
            className="rounded-xl bg-[#643bf6] hover:bg-[#522cd9] text-white text-xs font-semibold px-5 py-2.5 shadow-md active:scale-95 transition-all"
          >
            + Create workout
          </button>
        </div>
      </div>

      <div className="w-full rounded-2xl border border-[#231b46] bg-[#120d29]/90 px-5 py-3.5 text-xs text-slate-300 flex items-center">
        Every exercise inside these workouts has passed the automatic checks.
      </div>

      <div className="mt-4 grid w-full grid-cols-1 items-center gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_7rem_7rem_5.25rem]">
        <div className="relative h-7 min-w-0 sm:col-span-2 lg:col-span-1">
          <SearchIcon className="absolute inset-y-0 left-2 my-auto h-3 w-3 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by workout or member"
            className="h-7 w-full rounded-lg border border-[#302653] bg-[#1b1538] pl-[26px] pr-2 text-[10px] leading-none text-slate-200 placeholder-slate-400 focus:outline-none focus:border-[#6340f1]"
          />
        </div>
        <FilterDropdown value={level} onChange={(value) => { setLevel(value); setCurrentPage(1); }} options={LEVEL_OPTIONS} widthClass="w-full" />
        <FilterDropdown value={length} onChange={(value) => { setLength(value); setCurrentPage(1); }} options={LENGTH_OPTIONS} widthClass="w-full" />
        <FilterDropdown value={sort} onChange={(value) => { setSort(value); setCurrentPage(1); }} options={SORT_OPTIONS} widthClass="w-full" />
      </div>

      <p className="text-xs font-medium text-slate-400 my-3">
        {filteredWorkouts.length} workout{filteredWorkouts.length === 1 ? "" : "s"}
      </p>

      <div className="space-y-3">
        {visibleWorkouts.map((workout) => (
          <div
            key={workout.id}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/library/custom/${workout.id}`)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                navigate(`/library/custom/${workout.id}`);
              }
            }}
            className="rounded-2xl border border-[#231b46] bg-[#120d29]/90 p-5 flex items-start gap-4 hover:border-[#3b2d75] transition-all cursor-pointer"
          >
            <div className="h-11 w-11 rounded-xl bg-[#201748] text-[#9d7aff] flex items-center justify-center flex-shrink-0">
              <BarbellIcon />
            </div>
            <div className="flex-1">
              <div>
                <h3 className="text-base font-semibold text-white mr-3 inline-block">{workout.title}</h3>
                <LevelBadge level={workout.level} />
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{workout.description}</p>
              <div className="text-[11px] text-slate-400 mt-2.5 flex items-center">
                <span className="h-5 w-5 rounded-full bg-[#3b2d75] text-[#b89eff] text-[10px] font-bold flex items-center justify-center mr-2 inline-flex">
                  {workout.author.avatarText}
                </span>
                <span>
                  {workout.author.name} · {workout.postedTime} · {workout.savesCount} saved
                </span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="bg-[#181236] border border-[#281f52] text-slate-300 text-[11px] font-medium px-3 py-1 rounded-full">
                  {workout.exercisesCount} exercises
                </span>
                <span className="bg-[#181236] border border-[#281f52] text-slate-300 text-[11px] font-medium px-3 py-1 rounded-full">
                  {workout.setsCount} sets
                </span>
                <span className="bg-[#181236] border border-[#281f52] text-slate-300 text-[11px] font-medium px-3 py-1 rounded-full">
                  {workout.duration}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {filteredWorkouts.length > 0 && (
        <div className="mt-5 flex items-center justify-between border-t border-[#1f193f] pt-4">
          <p className="text-xs text-slate-400">
            Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredWorkouts.length)} of {filteredWorkouts.length} workouts
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage <= 1}
              className="rounded-md border border-[#22184c] bg-[#130d2e] px-3 py-1.5 text-xs font-medium text-[#8a82af] hover:border-[#382672] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 transition-all"
            >
              Previous
            </button>
            {Array.from({ length: Math.max(totalPages, 1) }, (_, index) => index + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`h-8 min-w-8 rounded-md px-2 text-xs transition-all ${
                  page === currentPage
                    ? "bg-[#6340f1] text-white font-bold shadow-sm"
                    : "border border-[#22184c] bg-[#130d2e] text-[#8a82af] hover:border-[#382672] hover:text-white"
                }`}
                aria-current={page === currentPage ? "page" : undefined}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-md border border-[#22184c] bg-[#130d2e] px-3 py-1.5 text-xs font-medium text-[#8a82af] hover:border-[#382672] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
