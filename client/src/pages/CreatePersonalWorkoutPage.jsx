import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  getApiErrorMessage,
  validateWorkoutDescription,
  validateWorkoutExercises,
  validateWorkoutName,
} from "./libraryFormValidation";
import { createMyWorkout, getAvailableWorkoutExercises } from "../api/library";
import useUndoDelete from "../hooks/useUndoDelete";
import { getLevelBadgeStyle } from "../utils/levelBadge";

function DumbbellIcon({ size = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={`${size} text-[#9d7aff]`} aria-hidden="true">
      <rect x="2" y="9" width="4" height="6" rx="1" />
      <rect x="18" y="9" width="4" height="6" rx="1" />
      <line x1="6" y1="12" x2="18" y2="12" />
      <line x1="8" y1="8" x2="8" y2="16" />
      <line x1="16" y1="8" x2="16" y2="16" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-500" aria-hidden="true">
      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}

function LevelBadge({ level }) {
  const displayLevel = level || "Intermediate";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${getLevelBadgeStyle(displayLevel)}`}>
      {displayLevel}
    </span>
  );
}

export default function CreatePersonalWorkoutPage() {
  const navigate = useNavigate();
  const submissionLock = useRef(false);
  const { requestDelete, confirmationModal } = useUndoDelete();

  const [availableExercises, setAvailableExercises] = useState([]);
  const [exercisePage, setExercisePage] = useState(1);
  const [workoutName, setWorkoutName] = useState("");
  const [note, setNote]               = useState("");
  const [search, setSearch]           = useState("");
  const [levelFilter, setLevelFilter] = useState("All levels");
  const [selected, setSelected]       = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [touchedFields, setTouchedFields] = useState({});
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let active = true;
    getAvailableWorkoutExercises()
      .then((items) => {
        if (active) {
          setAvailableExercises(items.map((exercise) => ({
            id: exercise.id,
            title: exercise.title,
            level: String(exercise.level).toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase()),
            muscles: exercise.targetMuscle,
            defaultSets: exercise.defaultSets,
            defaultReps: exercise.defaultReps,
            defaultDuration: exercise.defaultDuration,
          })));
        }
      })
      .catch((error) => {
        if (active) {
          setErrorMessage(error.response?.data?.message || "Could not load accepted exercises.");
          toast.error("Could not load accepted exercises.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredExercises = useMemo(() =>
    availableExercises.filter((ex) => {
      const matchSearch = ex.title.toLowerCase().includes(search.toLowerCase());
      const matchLevel  = levelFilter === "All levels" || ex.level === levelFilter;
      return matchSearch && matchLevel;
    }),
  [availableExercises, search, levelFilter]);
  const exercisePageSize = 6;
  const exercisePageCount = Math.max(1, Math.ceil(filteredExercises.length / exercisePageSize));
  const visibleExercises = filteredExercises.slice(
    (exercisePage - 1) * exercisePageSize,
    exercisePage * exercisePageSize
  );
  useEffect(() => {
    if (exercisePage > exercisePageCount) setExercisePage(exercisePageCount);
  }, [exercisePage, exercisePageCount]);

  const totalExercises = selected.length;
  const totalSets      = selected.reduce((sum, e) => sum + Number(e.sets || 0), 0);
  const estimatedMin   = Math.round(totalSets * 1.2);
  const nameError = validateWorkoutName(workoutName);
  const descriptionError = validateWorkoutDescription(note);
  const exerciseErrors = validateWorkoutExercises(selected);
  const validationErrors = {
    ...exerciseErrors,
    ...(nameError ? { name: nameError } : {}),
    ...(descriptionError ? { description: descriptionError } : {}),
  };
  const isDirty = Boolean(workoutName || note || selected.length);
  const showFieldError = (field) =>
    Boolean((hasSubmitted || touchedFields[field]) && validationErrors[field]);
  const markFieldTouched = (field) =>
    setTouchedFields((current) => ({ ...current, [field]: true }));
  const focusFirstInvalidField = () => {
    const firstInvalidId = [
      "workout-name",
      "workout-description",
      "workout-exercises",
      ...selected.flatMap((_, index) => [
        `workout-sets-${index}`,
        `workout-reps-${index}`,
        `workout-rest-${index}`,
      ]),
    ].find((id) => {
      if (id === "workout-name") return validationErrors.name;
      if (id === "workout-description") return validationErrors.description;
      if (id === "workout-exercises") return validationErrors.list;
      const [, field, index] = id.match(/^workout-(sets|reps|rest)-(\d+)$/) || [];
      return field && validationErrors[`${field}-${index}`];
    });
    const firstInvalid = firstInvalidId && document.getElementById(firstInvalidId);
    firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });
    firstInvalid?.focus();
  };

  const handleAdd = (ex) =>
    setSelected((prev) => [...prev, {
      ...ex,
      uniqueKey: `${ex.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      exerciseId: ex.id,
      sets: ex.defaultSets ?? 3,
      reps: ex.defaultDuration != null ? ex.defaultDuration : ex.defaultReps ?? 8,
      countBy: ex.defaultDuration != null ? "Duration" : "Reps",
      restSec: 60,
    }]);

  const handleRemove = (exercise) => {
    const itemIndex = selected.findIndex((item) => item.uniqueKey === exercise.uniqueKey);
    requestDelete({
      onOptimisticDelete: () => {
        setSelected((current) => current.filter((item) => item.uniqueKey !== exercise.uniqueKey));
      },
      onUndo: () => {
        setSelected((current) => {
          if (current.some((item) => item.uniqueKey === exercise.uniqueKey)) return current;
          const restored = [...current];
          restored.splice(Math.max(0, Math.min(itemIndex, restored.length)), 0, exercise);
          return restored;
        });
      },
      onDelete: async () => {},
      successMessage: "Exercise removed from workout.",
    });
  };

  const moveUp = (idx) => {
    if (idx === 0) return;
    setSelected((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveDown = (idx) => {
    if (idx === selected.length - 1) return;
    setSelected((prev) => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const updateField = (idx, field, value) =>
    setSelected((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));

  const handleCreate = async () => {
    if (submissionLock.current) return;
    setHasSubmitted(true);
    if (Object.keys(validationErrors).length > 0) {
      setErrorMessage("");
      toast.warning("Please fill in all required fields correctly.");
      focusFirstInvalidField();
      return;
    }
    const name = workoutName.trim();

    submissionLock.current = true;
    setIsCreating(true);
    try {
      await createMyWorkout({
        title: name,
        description: note.trim(),
        isSharedWithCommunity: false,
        items: selected.map((exercise, orderIndex) => ({
          exerciseId: Number(exercise.id),
          orderIndex,
          sets: Number(exercise.sets),
          reps: exercise.countBy === "Reps" ? Number(exercise.reps) : null,
          duration: exercise.countBy === "Duration" ? Number(exercise.reps) : null,
          countBy: exercise.countBy === "Duration" ? "SECONDS" : "REPS",
          restSeconds: Number(exercise.restSec),
        })),
      });
    } catch (error) {
      const message = getApiErrorMessage(error, "Could not save this workout.");
      setErrorMessage(message);
      toast.error(message);
      return;
    } finally {
      submissionLock.current = false;
      setIsCreating(false);
    }

    setErrorMessage("");
    toast.success("Workout created successfully!");
    navigate("/library/workouts");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-28 text-white">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Create personal workout</h1>
        <p className="mt-1 text-xs text-slate-400">Build your own workout from exercises that have been accepted.</p>
      </div>

      {/* Workout Details */}
      <div className="rounded-2xl border border-[#231b46] bg-[#120d29]/90 p-6 space-y-5">
        <p className="text-sm font-semibold text-white">Workout details</p>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-slate-400">Workout name</label>
            <span className="text-xs text-slate-500">{workoutName.length}/60</span>
          </div>
          <input
            id="workout-name"
            type="text" maxLength={60} value={workoutName}
            onChange={(e) => {
              setWorkoutName(e.target.value);
            }}
            onBlur={() => {
              markFieldTouched("name");
              setWorkoutName((value) => value.trim());
            }}
            placeholder="Upper body push day"
            className={`w-full rounded-xl border ${showFieldError("name") && nameError ? "border-rose-500 focus:border-rose-500" : "border-[#231b46] focus:border-[#7c3aed]"} bg-[#0c0820] px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors`}
          />
          {showFieldError("name") && nameError && <p className="text-rose-400 text-[11px] mt-1">{nameError}</p>}
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-slate-400">Note (optional)</label>
            <span className="text-xs text-slate-500">{note.length}/200</span>
          </div>
          <textarea
            maxLength={200} rows={3} value={note}
            onChange={(e) => {
              setNote(e.target.value);
            }}
            onBlur={() => {
              markFieldTouched("description");
              setNote((value) => value.trim());
            }}
            placeholder="Anything you want to remember about this workout"
            className="w-full resize-none rounded-xl border border-[#231b46] bg-[#0c0820] px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-[#7c3aed] focus:outline-none transition-colors"
          />
          {showFieldError("description") && descriptionError && <p className="text-rose-400 text-[11px] mt-1">{descriptionError}</p>}
        </div>
      </div>
      {errorMessage && (
        <p role="alert" className="rounded-xl border border-rose-800/60 bg-rose-950/30 px-4 py-3 text-xs text-rose-300">
          {errorMessage}
        </p>
      )}

      {/* Two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* LEFT: Accepted exercises */}
        <div className="rounded-2xl border border-[#231b46] bg-[#120d29]/90 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Accepted exercises</p>
            <span className="text-xs text-slate-400">{availableExercises.length} available</span>
          </div>
          <div className="rounded-xl border border-[#231b46] bg-[#0d0922] p-3.5 text-xs text-slate-400 leading-relaxed">
            Only exercises accepted by the system can be added. Pending and rejected ones are not available until they pass the checks.
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <SearchIcon />
              </span>
              <input
                type="text" placeholder="Search by title" value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setExercisePage(1);
                }}
                className="w-full rounded-xl border border-[#231b46] bg-[#0d0922] py-2.5 pl-9 pr-3 text-xs text-slate-300 placeholder-slate-500 focus:border-[#7c3aed] focus:outline-none"
              />
            </div>
            <select
              value={levelFilter} onChange={(e) => {
                setLevelFilter(e.target.value);
                setExercisePage(1);
              }}
              className="rounded-xl border border-[#231b46] bg-[#0d0922] py-2.5 px-3 text-xs text-slate-300 focus:outline-none cursor-pointer"
            >
              <option>All levels</option>
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>
          </div>
          <div className="space-y-2.5">
            {visibleExercises.map((ex) => (
                <div key={ex.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#231b46] bg-[#0d0922] p-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#181238]">
                      <DumbbellIcon />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-white">{ex.title}</span>
                        <LevelBadge level={ex.level} />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{ex.muscles}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => handleAdd(ex)}
                    className="shrink-0 rounded-xl border border-[#2b2257] bg-[#161133] px-4 py-1.5 text-xs font-medium text-slate-200 hover:bg-[#20174a] transition-colors">
                    + Add
                  </button>
                </div>
            ))}
            {filteredExercises.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-500">No exercises found.</p>
            )}
          </div>
          {filteredExercises.length > 0 && (
            <div className="flex items-center justify-between border-t border-[#231b46] pt-3">
              <button
                type="button"
                onClick={() => setExercisePage((page) => Math.max(1, page - 1))}
                disabled={exercisePage === 1}
                className="rounded-lg border border-[#2b2257] bg-[#161133] px-3 py-1.5 text-xs text-slate-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: exercisePageCount }, (_, index) => index + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setExercisePage(page)}
                    aria-current={page === exercisePage ? "page" : undefined}
                    className={`h-8 min-w-8 rounded-lg px-2 text-xs ${
                      page === exercisePage
                        ? "bg-[#643bf6] font-semibold text-white"
                        : "border border-[#2b2257] bg-[#161133] text-slate-300 hover:text-white"
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setExercisePage((page) => Math.min(exercisePageCount, page + 1))}
                disabled={exercisePage === exercisePageCount}
                className="rounded-lg border border-[#2b2257] bg-[#161133] px-3 py-1.5 text-xs text-slate-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* RIGHT: Workout exercises */}
        <div className="flex flex-col rounded-2xl border border-[#231b46] bg-[#120d29]/90 p-6 gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Workout exercises</p>
            <span className="text-xs text-slate-400">{totalExercises} added</span>
          </div>

          {selected.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#181238]">
                <DumbbellIcon size="h-6 w-6" />
              </div>
              <p className="text-xs font-medium text-slate-400">No exercises added yet</p>
              <p className="mt-1 text-[11px] text-slate-500">Click "+ Add" on the left to build your workout.</p>
            </div>
          )}
          {hasSubmitted && exerciseErrors.list && (
            <p id="workout-exercises" tabIndex={-1} className="text-rose-400 text-[11px] mt-1">{exerciseErrors.list}</p>
          )}

          <div className="space-y-3">
            {selected.map((ex, idx) => (
              <div key={ex.uniqueKey} className="rounded-xl border border-[#231b46] bg-[#0d0922] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 shrink-0 rounded-full bg-[#201748] flex items-center justify-center text-[11px] font-bold text-[#a855f7]">
                    {idx + 1}
                  </div>
                  <span className="flex-1 ml-1 text-xs font-semibold text-white truncate">{ex.title}</span>
                  <button type="button" onClick={() => moveUp(idx)} disabled={idx === 0}
                    aria-label="Move up"
                    className="h-8 w-8 shrink-0 rounded-lg border border-[#2b2257] bg-[#181238] flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronUpIcon />
                  </button>
                  <button type="button" onClick={() => moveDown(idx)} disabled={idx === selected.length - 1}
                    aria-label="Move down"
                    className="h-8 w-8 shrink-0 rounded-lg border border-[#2b2257] bg-[#1a113b] flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronDownIcon />
                  </button>
                  <button type="button" onClick={() => handleRemove(ex)}
                    aria-label="Remove exercise"
                    className="h-8 w-8 shrink-0 rounded-lg border border-rose-900/50 bg-rose-950/40 flex items-center justify-center text-rose-400 hover:bg-rose-900/60 transition-colors">
                    <XIcon />
                  </button>
                </div>
                <div className={`grid gap-2.5 ${ex.countBy === "Duration" ? "grid-cols-2" : "grid-cols-3"}`}>
                  <div className="col-span-full">
                    <label className="block text-[10px] text-slate-400 mb-1">Count by</label>
                    <p className="rounded-lg border border-[#231b46] bg-[#080518] p-2 text-center text-xs text-white">
                      {ex.countBy === "Duration" ? `Duration (${ex.reps} seconds)` : "Sets & Reps"}
                    </p>
                  </div>
                  {ex.countBy === "Reps" ? (
                    <>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Sets</label>
                        <input id={`workout-sets-${idx}`} type="number" value={ex.sets} readOnly
                          className="w-full cursor-not-allowed rounded-lg border border-[#231b46] bg-[#080518] p-2 text-center text-xs text-slate-300 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Reps</label>
                        <input id={`workout-reps-${idx}`} type="number" value={ex.reps} readOnly
                          className="w-full cursor-not-allowed rounded-lg border border-[#231b46] bg-[#080518] p-2 text-center text-xs text-slate-300 focus:outline-none" />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Duration (seconds)</label>
                      <input id={`workout-reps-${idx}`} type="number" value={ex.reps} readOnly
                        className="w-full cursor-not-allowed rounded-lg border border-[#231b46] bg-[#080518] p-2 text-center text-xs text-slate-300 focus:outline-none" />
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Rest (sec)</label>
                    <input id={`workout-rest-${idx}`} type="number" min="10" max="120" step="5" value={ex.restSec}
                      onChange={(e) => {
                        updateField(idx, "restSec", e.target.value);
                      }}
                      onBlur={() => markFieldTouched(`rest-${idx}`)}
                      className={`w-full rounded-lg border ${showFieldError(`rest-${idx}`) && exerciseErrors[`rest-${idx}`] ? "border-rose-500 focus:border-rose-500" : "border-[#231b46] focus:border-[#7c3aed]"} bg-[#080518] p-2 text-center text-xs text-white focus:outline-none`} />
                    {showFieldError(`rest-${idx}`) && exerciseErrors[`rest-${idx}`] && <p className="text-rose-400 text-[11px] mt-1">{exerciseErrors[`rest-${idx}`]}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalExercises > 0 && (
            <p className="pt-1 text-xs text-slate-400">
              <span className="font-medium text-slate-300">{totalExercises}</span>{" "}
              {totalExercises === 1 ? "exercise" : "exercises"}{" "}
              <span className="font-medium text-slate-300">{totalSets}</span>{" "}
              {totalSets === 1 ? "set" : "sets"} · About{" "}
              <span className="font-medium text-slate-300">{estimatedMin}</span> min
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[#1c163a] pt-6">
        <span className="text-xs text-slate-400">
          {totalExercises} {totalExercises === 1 ? "exercise" : "exercises"} in this workout
        </span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => { toast.info("Action cancelled"); navigate(-1); }}
            className="rounded-xl border border-[#2b2257] bg-[#141030] px-6 py-2.5 text-xs font-semibold text-slate-300 hover:bg-[#1f1847] transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleCreate} disabled={!isDirty || isCreating || Object.keys(validationErrors).length > 0}
            className="rounded-xl bg-[#643bf6] px-7 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-[#522cd9] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {isCreating && <span className="mr-2 inline-block h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent align-[-2px] animate-spin" />}
            {isCreating ? "Creating..." : "Create workout"}
          </button>
        </div>
      </div>
      {confirmationModal}
    </div>
  );
}
