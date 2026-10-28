import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import LibraryDetailPlaceholder from "./LibraryDetailPlaceholder";
import { deleteMyWorkout, getMyWorkouts } from "../api/library";
import useUndoDelete from "../hooks/useUndoDelete";

const STORAGE_KEY = "my_custom_workouts";
const INITIALIZED_KEY = `${STORAGE_KEY}_initialized`;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const SAMPLE_WORKOUTS = [
  {
    id: "sample-upper-body-push",
    title: "Upper body push day",
    level: "Intermediate",
    description: "Shoulder and tricep focus, finishing with a core hold.",
    createdLabel: "Created 2 days ago",
    savesCount: 42,
    exercisesCount: 3,
    setsCount: 9,
    duration: "About 9 min",
    isShared: true,
    createdAt: new Date(Date.now() - 2 * DAY_IN_MS).toISOString(),
  },
  {
    id: "sample-morning-mobility",
    title: "Morning mobility",
    level: "Beginner",
    description: "Gentle warm-up for wrists, shoulders and hips.",
    createdLabel: "Created 5 days ago",
    savesCount: 0,
    exercisesCount: 4,
    setsCount: 8,
    duration: "About 10 min",
    isShared: false,
    createdAt: new Date(Date.now() - 5 * DAY_IN_MS).toISOString(),
  },
  {
    id: "sample-handstand-practice",
    title: "Handstand practice",
    level: "Advanced",
    description: "Wall holds and shoulder taps to build balance.",
    createdLabel: "Created 1 week ago",
    savesCount: 12,
    exercisesCount: 3,
    setsCount: 10,
    duration: "About 18 min",
    isShared: true,
    createdAt: new Date(Date.now() - 7 * DAY_IN_MS).toISOString(),
  },
  {
    id: "sample-leg-day",
    title: "Leg day, no equipment",
    level: "Intermediate",
    description: "Squat variations and lunges for a full leg session.",
    createdLabel: "Created 3 weeks ago",
    savesCount: 0,
    exercisesCount: 4,
    setsCount: 12,
    duration: "About 20 min",
    isShared: false,
    createdAt: new Date(Date.now() - 21 * DAY_IN_MS).toISOString(),
  },
];

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-500" aria-hidden="true">
      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
    </svg>
  );
}

function DumbbellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
      <path d="M6 7v10" />
      <path d="M18 7v10" />
      <path d="M3 10v4" />
      <path d="M21 10v4" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  );
}

function LevelBadge({ level }) {
  const styles = {
    Beginner: "border-emerald-600/80 bg-emerald-950/70 text-emerald-200",
    Intermediate: "border-amber-600/80 bg-amber-950/70 text-amber-200",
    Advanced: "border-rose-600/80 bg-rose-950/70 text-rose-200",
  };

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${styles[level] || styles.Intermediate}`}>
      {level}
    </span>
  );
}

function FilterDropdown({ value, onChange, options, label }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-w-0 rounded-xl border border-[#231b46] bg-[#120d29] px-4 py-3 text-xs text-slate-300 focus:border-[#643bf6] focus:outline-none"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} className="bg-[#120d29]">
          {option.label}
        </option>
      ))}
    </select>
  );
}

function getMinutes(duration) {
  return Number(String(duration).match(/\d+/)?.[0] || 0);
}

function loadWorkouts() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const saved = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(saved)) {
    throw new Error("Saved workouts are not in the expected format.");
  }
  if (localStorage.getItem(INITIALIZED_KEY) === "true") return saved;

  const legacyRaw = localStorage.getItem("custom_workouts");
  const legacyWorkouts = legacyRaw ? JSON.parse(legacyRaw) : [];
  if (!Array.isArray(legacyWorkouts)) {
    throw new Error("Previously saved workouts are not in the expected format.");
  }
  const legacyPersonalWorkouts = legacyWorkouts
    .filter((workout) => String(workout.id).startsWith("personal-"))
    .map((workout) => ({
      ...workout,
      createdLabel: workout.createdLabel || `Created ${workout.postedTime || "recently"}`,
      isShared: false,
      createdAt: workout.createdAt || new Date().toISOString(),
    }));
  const existingWorkouts = [...saved, ...legacyPersonalWorkouts];
  const savedIds = new Set(existingWorkouts.map((workout) => workout.id));
  const initialWorkouts = [
    ...SAMPLE_WORKOUTS.filter((workout) => !savedIds.has(workout.id)),
    ...existingWorkouts,
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialWorkouts));
  localStorage.setItem(INITIALIZED_KEY, "true");
  return initialWorkouts;
}

export default function MyCustomWorkoutListPage() {
  const navigate = useNavigate();
  const { requestDelete, confirmationModal } = useUndoDelete();
  const [searchParams] = useSearchParams();
  const [workouts, setWorkouts] = useState([]);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [length, setLength] = useState("all");
  const [sort, setSort] = useState("newest");
  const [errorMessage, setErrorMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 3;

  useEffect(() => {
    let active = true;
    getMyWorkouts({ page: 0, size: 100 })
      .then((response) => {
        if (active) setWorkouts(response.content);
      })
      .catch((error) => {
        if (active) setErrorMessage(error.response?.data?.message || "Could not load workouts.");
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredWorkouts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = workouts.filter((workout) => {
      const minutes = getMinutes(workout.duration);
      const matchesName = workout.title.toLowerCase().includes(needle);
      const matchesLevel = level === "all" || workout.level === level;
      const matchesLength =
        length === "all" ||
        (length === "short" && minutes < 10) ||
        (length === "medium" && minutes >= 10 && minutes <= 15) ||
        (length === "long" && minutes > 15);
      return matchesName && matchesLevel && matchesLength;
    });

    if (sort === "oldest") {
      return [...filtered].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    }
    if (sort === "newest") {
      return [...filtered].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    if (sort === "saved") return [...filtered].sort((a, b) => b.savesCount - a.savesCount);
    return filtered;
  }, [workouts, query, level, length, sort]);
  const totalPages = Math.ceil(filteredWorkouts.length / pageSize);
  const visibleWorkouts = filteredWorkouts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, Math.max(totalPages, 1)));
  }, [totalPages]);

  const handleDelete = (workout) => {
    const itemIndex = workouts.findIndex((item) => String(item.id) === String(workout.id));
    requestDelete({
      onOptimisticDelete: () => {
        setWorkouts((current) => current.filter((item) => String(item.id) !== String(workout.id)));
      },
      onUndo: () => {
        setWorkouts((current) => {
          if (current.some((item) => String(item.id) === String(workout.id))) return current;
          const restored = [...current];
          restored.splice(Math.max(0, Math.min(itemIndex, restored.length)), 0, workout);
          return restored;
        });
      },
      onDelete: async () => {
        await deleteMyWorkout(workout.id);
        setErrorMessage("");
      },
      successMessage: "Deleted successfully",
    });
  };

  if (searchParams.get("source") === "system") {
    return <LibraryDetailPlaceholder title="Workouts" type="workouts" />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12 text-white">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My custom workout list</h1>
          <p className="mt-1 text-xs text-slate-400">
            Workouts you created. Edit or delete them, or build a new one.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/library/workouts/new")}
          className="shrink-0 rounded-xl border border-[#8065ff] bg-[#643bf6] px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-purple-950/40 transition-colors hover:bg-[#7554ff]"
        >
          + Create workout
        </button>
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            <SearchIcon />
          </span>
          <input
            type="search"
            aria-label="Search by workout name"
            placeholder="Search by workout name"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCurrentPage(1);
            }}
            className="w-full rounded-xl border border-[#231b46] bg-[#120d29] py-3 pl-10 pr-3 text-xs text-slate-300 placeholder-slate-500 focus:border-[#643bf6] focus:outline-none"
          />
        </div>
        <FilterDropdown
          label="Filter by level"
          value={level}
          onChange={(value) => {
            setLevel(value);
            setCurrentPage(1);
          }}
          options={[
            { value: "all", label: "All levels" },
            { value: "Beginner", label: "Beginner" },
            { value: "Intermediate", label: "Intermediate" },
            { value: "Advanced", label: "Advanced" },
          ]}
        />
        <FilterDropdown
          label="Filter by length"
          value={length}
          onChange={(value) => {
            setLength(value);
            setCurrentPage(1);
          }}
          options={[
            { value: "all", label: "Any length" },
            { value: "short", label: "Under 10 min" },
            { value: "medium", label: "10–15 min" },
            { value: "long", label: "Over 15 min" },
          ]}
        />
        <FilterDropdown
          label="Sort workouts"
          value={sort}
          onChange={(value) => {
            setSort(value);
            setCurrentPage(1);
          }}
          options={[
            { value: "newest", label: "Newest" },
            { value: "oldest", label: "Oldest" },
            { value: "saved", label: "Most saved" },
          ]}
        />
      </div>

      <p className="text-xs text-slate-400" aria-live="polite">
        {filteredWorkouts.length} {filteredWorkouts.length === 1 ? "workout" : "workouts"}
      </p>

      {errorMessage && (
        <p role="alert" className="rounded-xl border border-rose-800/60 bg-rose-950/30 px-4 py-3 text-xs text-rose-300">
          {errorMessage}
        </p>
      )}

      <div className="space-y-3">
        {visibleWorkouts.map((workout) => (
          <article
            key={workout.id}
            className="flex flex-col gap-4 rounded-2xl border border-[#33285f] bg-[#15102e] p-5 shadow-sm transition-colors hover:border-[#6046a6] sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#493b79] bg-[#261b50] text-[#b49aff]">
                <DumbbellIcon />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-white">{workout.title}</h2>
                  <LevelBadge level={workout.level} />
                </div>
                <p className="mt-1 text-[13px] text-slate-300">{workout.description}</p>
                <div className="mt-1 text-xs text-slate-300">
                  {workout.createdLabel || "Created just now"}
                  {workout.savesCount > 0 && ` · ${workout.savesCount} saved`}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[`${workout.exercisesCount} exercises`, `${workout.setsCount} sets`, workout.duration].map((pill) => (
                    <span key={pill} className="rounded-full border border-[#493b79] bg-[#0d0922] px-3 py-1 text-[11px] font-medium text-slate-200">
                      {pill}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-row-reverse items-center justify-between gap-3 sm:h-20 sm:flex-col sm:items-end sm:justify-between">
              <span
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
                  workout.isShared
                    ? "border-emerald-600/80 bg-emerald-950/70 text-emerald-200"
                    : "border-[#59477f] bg-[#211844] text-violet-200"
                }`}
              >
                {workout.isShared ? "Shared with community" : "Private"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleDelete(workout)}
                  className="rounded-lg border border-rose-700/80 bg-rose-950/50 px-4 py-2 text-xs font-semibold text-rose-200 transition-colors hover:bg-rose-900/70"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/library/workouts/${workout.id}/edit`)}
                  className="rounded-lg border border-[#8065ff] bg-[#643bf6] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#7554ff]"
                >
                  Edit
                </button>
              </div>
            </div>
          </article>
        ))}
        {filteredWorkouts.length === 0 && (
          <p className="rounded-2xl border border-[#231b46] bg-[#120d29]/90 py-12 text-center text-xs text-slate-400">
            No workouts match your filters.
          </p>
        )}
      </div>
      {confirmationModal}
      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between border-t border-[#1f193f] pt-4">
          <p className="text-xs text-slate-400">
            Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredWorkouts.length)} of {filteredWorkouts.length} workouts
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage <= 1}
              className="rounded-md border border-[#22184c] bg-[#130d2e] px-3 py-1.5 text-xs font-medium text-[#8a82af] transition-all hover:border-[#382672] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`h-8 min-w-8 rounded-md px-2 text-xs transition-all ${
                  page === currentPage
                    ? "bg-[#6340f1] font-bold text-white shadow-sm"
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
              className="rounded-md border border-[#22184c] bg-[#130d2e] px-3 py-1.5 text-xs font-medium text-[#8a82af] transition-all hover:border-[#382672] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
