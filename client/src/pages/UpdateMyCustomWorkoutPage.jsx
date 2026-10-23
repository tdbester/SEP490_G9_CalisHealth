import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { validateWorkoutExercises, validateWorkoutName } from "./libraryFormValidation";
import { getAvailableWorkoutExercises, getMyWorkout, updateMyWorkout } from "../api/library";

const STORAGE_KEY = "my_custom_workouts";
const LEVEL_PRIORITY = { Beginner: 1, Intermediate: 2, Advanced: 3 };

const DEFAULT_EXERCISES = [
  { id: "pike-push-up", name: "Pike push-up", level: "Intermediate", sets: 3, reps: 8, restSec: 45, countBy: "reps" },
  { id: "diamond-push-up", name: "Diamond push-up", level: "Intermediate", sets: 3, reps: 10, restSec: 45, countBy: "reps" },
  { id: "plank", name: "Plank", level: "Beginner", sets: 3, reps: 30, restSec: 30, countBy: "sec" },
];

const ADDABLE_EXERCISES = [
  { id: "australian-row", name: "Australian row", level: "Beginner", countBy: "reps", reps: 8 },
  { id: "bodyweight-squat", name: "Bodyweight squat", level: "Beginner", countBy: "reps", reps: 10 },
  { id: "hollow-body-hold", name: "Hollow body hold", level: "Beginner", countBy: "sec", reps: 30 },
  { id: "tuck-planche-lean", name: "Tuck planche lean", level: "Advanced", countBy: "sec", reps: 20 },
];

function createExerciseList(workout) {
  if (Array.isArray(workout?.exercises) && workout.exercises.length > 0) {
    return workout.exercises.map((exercise, index) => ({
      id: exercise.id || exercise.code || `exercise-${index}`,
      name: exercise.name || exercise.title || "Exercise",
      level: exercise.level || "Beginner",
      sets: exercise.sets ?? 3,
      reps: exercise.reps ?? 8,
      restSec: exercise.restSec ?? 45,
      countBy: exercise.countBy === "Duration" ? "sec" : exercise.countBy || "reps",
    }));
  }
  return DEFAULT_EXERCISES.map((exercise) => ({ ...exercise }));
}

function readWorkout(id) {
  const raw = localStorage.getItem(STORAGE_KEY);
  const workouts = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(workouts)) {
    throw new Error("Saved workouts are not in the expected format.");
  }
  const workout = workouts.find((item) => String(item.id) === id);
  if (workout) return workout;
  if (id === "1" || id === "sample-upper-body-push") {
    return {
      id,
      title: "Upper body push day",
      level: "Intermediate",
      description: "Shoulder and tricep focus, finishing with a core hold.",
      isShared: true,
      exercises: DEFAULT_EXERCISES,
    };
  }
  return null;
}

function DragHandle() {
  return (
    <svg viewBox="0 0 12 18" fill="currentColor" className="h-4 w-3 text-slate-500" aria-hidden="true">
      <circle cx="3" cy="3" r="1.2" /><circle cx="9" cy="3" r="1.2" />
      <circle cx="3" cy="9" r="1.2" /><circle cx="9" cy="9" r="1.2" />
      <circle cx="3" cy="15" r="1.2" /><circle cx="9" cy="15" r="1.2" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4" aria-hidden="true">
      <circle cx="10" cy="10" r="8" />
      <path d="m7 7 6 6m0-6-6 6" />
    </svg>
  );
}

function LevelBadge({ level }) {
  const styles = {
    Beginner: "border-emerald-700/70 bg-emerald-950/50 text-emerald-400",
    Intermediate: "border-amber-700/70 bg-amber-950/50 text-amber-400",
    Advanced: "border-rose-700/70 bg-rose-950/50 text-rose-400",
  };
  return (
    <span className={`rounded-full border px-3 py-1 text-[11px] ${styles[level] || styles.Beginner}`}>
      {level}
    </span>
  );
}

export default function UpdateMyCustomWorkoutPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [workout, setWorkout] = useState(null);
  const [availableExercises, setAvailableExercises] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [exercises, setExercises] = useState([]);
  const [baseline, setBaseline] = useState("");
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [touchedFields, setTouchedFields] = useState({});

  useEffect(() => {
    let active = true;
    Promise.all([getMyWorkout(id), getAvailableWorkoutExercises()])
      .then(([currentWorkout, available]) => {
        if (!active) return;
        const initialExercises = createExerciseList(currentWorkout);
        const initialForm = {
          title: currentWorkout.title || "",
          description: currentWorkout.description || "",
          isShared: Boolean(currentWorkout.isShared),
          exercises: initialExercises,
        };
        setAvailableExercises(available.map((exercise) => ({
          id: exercise.id,
          name: exercise.title,
          level: String(exercise.level).toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase()),
          countBy: exercise.defaultDuration ? "sec" : "reps",
          reps: exercise.defaultDuration || exercise.defaultReps || 8,
        })));
        setWorkout(currentWorkout);
        setTitle(initialForm.title);
        setDescription(initialForm.description);
        setIsShared(initialForm.isShared);
        setExercises(initialExercises);
        setBaseline(JSON.stringify(initialForm));
      })
      .catch((error) => {
        if (active) setErrorMessage(error.response?.data?.message || "Could not load workout.");
      });
    return () => {
      active = false;
    };
  }, [id]);

  const totalSets = exercises.reduce((total, exercise) => {
    const sets = Number(exercise.sets);
    return total + (Number.isFinite(sets) ? sets : 0);
  }, 0);
  const estimatedMinutes = Math.max(1, Math.round(totalSets));
  const level = exercises.reduce(
    (currentLevel, exercise) =>
      LEVEL_PRIORITY[exercise.level] > LEVEL_PRIORITY[currentLevel] ? exercise.level : currentLevel,
    "Beginner"
  );
  const currentForm = useMemo(
    () => JSON.stringify({ title, description, isShared, exercises }),
    [title, description, isShared, exercises]
  );
  const isDirty = baseline !== "" && baseline !== currentForm;
  const nameError = validateWorkoutName(title);
  const exerciseErrors = validateWorkoutExercises(exercises);
  const validationErrors = { ...exerciseErrors, ...(nameError ? { name: nameError } : {}) };
  const showFieldError = (field) => hasSubmitted || touchedFields[field];
  const markFieldTouched = (field) =>
    setTouchedFields((current) => ({ ...current, [field]: true }));
  const focusFirstInvalidField = () => {
    const firstInvalidId = [
      "workout-title",
      "workout-exercises",
      ...exercises.flatMap((_, index) => [
        `workout-sets-${index}`,
        `workout-reps-${index}`,
        `workout-rest-${index}`,
      ]),
    ].find((id) => {
      if (id === "workout-title") return validationErrors.name;
      if (id === "workout-exercises") return validationErrors.list;
      const [, field, index] = id.match(/^workout-(sets|reps|rest)-(\d+)$/) || [];
      return field && validationErrors[`${field}-${index}`];
    });
    const firstInvalid = firstInvalidId && document.getElementById(firstInvalidId);
    firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });
    firstInvalid?.focus();
  };

  const updateExercise = (index, field, value) => {
    setExercises((current) =>
      current.map((exercise, currentIndex) =>
        currentIndex === index ? { ...exercise, [field]: value } : exercise
      )
    );
  };

  const removeExercise = (index) => {
    setExercises((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const addExercise = (exercise) => {
    setExercises((current) => [
      ...current,
      { ...exercise, sets: 3, restSec: 45 },
    ]);
    setAddMenuOpen(false);
  };

  const moveExercise = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= exercises.length) return;
    setExercises((current) => {
      const reordered = [...current];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      return reordered;
    });
  };

  const handleSave = async () => {
    if (!workout) return;
    setHasSubmitted(true);
    if (Object.keys(validationErrors).length > 0) {
      toast.warning("Please fill in all required fields correctly.");
      focusFirstInvalidField();
      return;
    }

    try {
      await updateMyWorkout(id, {
        title: title.trim(),
        description: description.trim(),
        isSharedWithCommunity: isShared,
        items: exercises.map((exercise, orderIndex) => ({
          exerciseId: Number(exercise.id),
          orderIndex,
          sets: Number(exercise.sets),
          reps: exercise.countBy === "sec" ? null : Number(exercise.reps),
          duration: exercise.countBy === "sec" ? Number(exercise.reps) : null,
          countBy: exercise.countBy === "sec" ? "SECONDS" : "REPS",
          restSeconds: Number(exercise.restSec),
        })),
      });
      toast.success("Saved changes successfully!");
      navigate("/library/workouts");
    } catch (error) {
      toast.error("Failed to save changes.");
      setErrorMessage(error.response?.data?.message || "Could not save workout.");
    }
  };

  if (!workout && !errorMessage) return null;

  return (
    <div className="workout-edit-page mx-auto max-w-5xl pb-24 text-white">
      <style>{`
        .workout-edit-page input[type="number"] {
          appearance: textfield;
          -moz-appearance: textfield;
        }
        .workout-edit-page input[type="number"]::-webkit-inner-spin-button,
        .workout-edit-page input[type="number"]::-webkit-outer-spin-button {
          appearance: none;
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>
      <button
        type="button"
        onClick={() => navigate("/library/workouts")}
        className="mb-2 inline-flex appearance-none items-center gap-1 rounded-md border border-transparent bg-transparent p-0 text-xs font-medium text-[#bba7ff] transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b6cff]"
      >
        &lt; My custom workout list
      </button>
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Update my custom workout</h1>
        <p className="mt-1 text-xs text-slate-400">
          Change the details or the exercises. Your saved version updates when you save.
        </p>
      </header>

      {errorMessage && (
        <p role="alert" className="mb-4 rounded-xl border border-rose-800/60 bg-rose-950/30 px-4 py-3 text-xs text-rose-300">
          {errorMessage}
        </p>
      )}

      {workout && (
        <>
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
            <div className="space-y-3">
              <section className="rounded-2xl border border-[#33285f] bg-[#15102e] p-5 shadow-sm shadow-purple-950/20">
                <h2 className="mb-4 text-sm font-semibold">Workout details</h2>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block text-xs text-slate-400" htmlFor="workout-title">
                    Workout name
                  </label>
                  <span className="text-xs text-slate-400">{title.length} / 60</span>
                </div>
                <input
                  id="workout-title"
                  value={title}
                  maxLength={60}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    markFieldTouched("name");
                  }}
                  className={`mb-1 w-full rounded-lg border ${showFieldError("name") && nameError ? "border-rose-500 focus:border-rose-500" : "border-[#493b79] focus:border-[#8b6cff]"} bg-[#1b1538] px-3 py-2.5 text-sm text-white focus:outline-none`}
                />
                {showFieldError("name") && nameError && <p className="mb-3 text-rose-400 text-[11px] mt-1">{nameError}</p>}
                {!showFieldError("name") || !nameError ? <div className="mb-3" /> : null}
                <label className="mb-1.5 block text-xs text-slate-400" htmlFor="workout-description">
                  Description
                </label>
                <textarea
                  id="workout-description"
                  value={description}
                  maxLength={150}
                  rows={3}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full resize-none rounded-lg border border-[#493b79] bg-[#1b1538] px-3 py-2.5 text-sm text-white focus:border-[#8b6cff] focus:outline-none"
                />
                <p className="mb-3 text-right text-[10px] text-slate-400">
                  {description.length} / 150
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={isShared}
                      onChange={(event) => setIsShared(event.target.checked)}
                      className="peer sr-only"
                    />
                    <span className={`relative flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors ${isShared ? "bg-[#643bf6]" : "bg-[#34285f]"}`}>
                      <span
                        className="h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
                        style={{ transform: isShared ? "translateX(16px)" : "translateX(0)" }}
                      />
                    </span>
                    Share with community
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Other members can view and save it
                  </span>
                </div>
              </section>

              <section className="rounded-2xl border border-[#33285f] bg-[#15102e] p-5 shadow-sm shadow-purple-950/20">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold">Exercises</h2>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setAddMenuOpen((open) => !open)}
                      className="rounded-lg border border-[#8d76d6] bg-[#1c1640] px-3 py-2 text-xs font-semibold text-white hover:bg-[#292052]"
                    >
                      + Add exercise
                    </button>
                    {addMenuOpen && (
                      <div className="absolute right-0 z-10 mt-2 w-52 rounded-xl border border-[#34285f] bg-[#120d29] p-1 shadow-xl">
                        {availableExercises.filter(
                          (exercise) => !exercises.some((item) => item.id === exercise.id)
                        ).map((exercise) => (
                          <button
                            key={exercise.id}
                            type="button"
                            onClick={() => addExercise(exercise)}
                            className="block w-full appearance-none rounded-lg border-0 bg-[#17112f] px-3 py-2 text-left text-xs text-slate-200 outline-none transition-colors hover:bg-[#30245b]"
                          >
                            {exercise.name}
                          </button>
                        ))}
                        {ADDABLE_EXERCISES.every((exercise) =>
                          exercises.some((item) => item.id === exercise.id)
                        ) && <p className="px-3 py-2 text-xs text-slate-400">No more exercises available.</p>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-2 hidden grid-cols-[minmax(120px,1fr)_56px_70px_58px_28px] gap-2 px-3 text-[10px] text-slate-400 sm:grid">
                  <span>Exercise</span><span>Sets</span><span>Reps / seconds</span><span>Rest</span><span />
                </div>
                {showFieldError("list") && exerciseErrors.list && (
                  <p id="workout-exercises" tabIndex={-1} className="text-rose-400 text-[11px] mt-1">{exerciseErrors.list}</p>
                )}
                <div className="space-y-2">
                  {exercises.map((exercise, index) => (
                    <div
                      key={`${exercise.id}-${index}`}
                      draggable
                      onDragStart={() => setDraggedIndex(index)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (draggedIndex !== null) moveExercise(draggedIndex, index);
                        setDraggedIndex(null);
                      }}
                      onDragEnd={() => setDraggedIndex(null)}
                      className={`grid grid-cols-[16px_minmax(90px,1fr)_48px_70px_54px_32px] items-center gap-2 rounded-xl border border-[#493b79] bg-[#211a45] px-2 py-2.5 sm:grid-cols-[16px_minmax(120px,1fr)_56px_70px_58px_32px] sm:px-3 ${
                        draggedIndex === index ? "opacity-50" : ""
                      }`}
                    >
                      <span className="cursor-grab" aria-label="Drag to reorder">
                        <DragHandle />
                      </span>
                      <span className="truncate text-xs font-semibold">{exercise.name}</span>
                      <div>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          step="1"
                          id={`workout-sets-${index}`}
                          aria-label={`${exercise.name} sets`}
                          value={exercise.sets}
                          onChange={(event) => {
                            updateExercise(index, "sets", event.target.value);
                            markFieldTouched(`sets-${index}`);
                          }}
                          className={`w-full rounded-lg border ${showFieldError(`sets-${index}`) && exerciseErrors[`sets-${index}`] ? "border-rose-500 focus:border-rose-500" : "border-[#643bf6]/70"} bg-[#120d29] px-1 py-2 text-center text-xs text-white focus:outline-none`}
                        />
                        {showFieldError(`sets-${index}`) && exerciseErrors[`sets-${index}`] && <p className="text-rose-400 text-[11px] mt-1">{exerciseErrors[`sets-${index}`]}</p>}
                      </div>
                      <div>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            max="999"
                            step="1"
                            id={`workout-reps-${index}`}
                            aria-label={`${exercise.name} reps or seconds`}
                            value={exercise.reps}
                            onChange={(event) => {
                              updateExercise(index, "reps", event.target.value);
                              markFieldTouched(`reps-${index}`);
                            }}
                            className={`w-full rounded-lg border ${showFieldError(`reps-${index}`) && exerciseErrors[`reps-${index}`] ? "border-rose-500 focus:border-rose-500" : "border-[#643bf6]/70"} bg-[#120d29] px-1 py-2 text-center text-xs text-white focus:outline-none`}
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-[9px] text-slate-400">
                            {exercise.countBy === "sec" ? "sec" : "reps"}
                          </span>
                        </div>
                        {showFieldError(`reps-${index}`) && exerciseErrors[`reps-${index}`] && <p className="text-rose-400 text-[11px] mt-1">{exerciseErrors[`reps-${index}`]}</p>}
                      </div>
                      <div>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="600"
                            step="1"
                            id={`workout-rest-${index}`}
                            aria-label={`${exercise.name} rest seconds`}
                            value={exercise.restSec}
                            onChange={(event) => {
                              updateExercise(index, "restSec", event.target.value);
                              markFieldTouched(`rest-${index}`);
                            }}
                            className={`w-full rounded-lg border ${showFieldError(`rest-${index}`) && exerciseErrors[`rest-${index}`] ? "border-rose-500 focus:border-rose-500" : "border-[#643bf6]/70"} bg-[#120d29] px-1 py-2 pr-3 text-center text-xs text-white focus:outline-none`}
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-[9px] text-slate-400">
                            s
                          </span>
                        </div>
                        {showFieldError(`rest-${index}`) && exerciseErrors[`rest-${index}`] && <p className="text-rose-400 text-[11px] mt-1">{exerciseErrors[`rest-${index}`]}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeExercise(index)}
                        aria-label={`Remove ${exercise.name}`}
                        className="flex h-8 w-8 appearance-none items-center justify-center rounded-lg border border-rose-700/80 bg-rose-950/60 p-0 text-[#ff9a83] transition-colors hover:border-rose-500 hover:bg-rose-900/80 hover:text-white"
                      >
                        <RemoveIcon />
                      </button>
                    </div>
                  ))}
                  {exercises.length === 0 && (
                    <p className="py-6 text-center text-xs text-slate-400">Add an exercise to this workout.</p>
                  )}
                </div>
              </section>
            </div>

            <aside className="rounded-2xl border border-[#33285f] bg-[#15102e] p-5 shadow-sm shadow-purple-950/20">
              <h2 className="mb-5 text-sm font-semibold">Summary</h2>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-[#231b46] pb-3">
                  <span className="text-slate-400">Level</span>
                  <LevelBadge level={level} />
                </div>
                <div className="flex items-center justify-between border-b border-[#231b46] pb-3">
                  <span className="text-slate-400">Exercises</span><strong>{exercises.length}</strong>
                </div>
                <div className="flex items-center justify-between border-b border-[#231b46] pb-3">
                  <span className="text-slate-400">Total sets</span><strong>{totalSets}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Estimated time</span>
                  <strong>About {estimatedMinutes} min</strong>
                </div>
              </div>
              <p className="mt-4 text-[10px] leading-relaxed text-slate-400">
                Level and time update on their own when you change the exercises.
              </p>
            </aside>
          </div>

          <footer className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-between border-t border-[#231b46] bg-[#0c0822] px-5 py-3 lg:pl-[calc(var(--sidebar-width)+32px)]">
            <span className={`flex items-center gap-2 text-xs ${isDirty ? "text-amber-300" : "text-slate-500"}`}>
              {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />}
              {isDirty ? "You have unsaved changes" : "All changes saved"}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="rounded-lg border border-[#514778] bg-[#120d29] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#201748]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty}
                className="rounded-lg bg-[#643bf6] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#522cd9] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save changes
              </button>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
