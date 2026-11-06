import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getSystemWorkout } from "../api/library";
import { mockSystemWorkouts } from "./WorkoutSystemListPage";
import { getLevelBadgeStyle } from "../utils/levelBadge";
import { startLibraryWorkout } from "../utils/libraryWorkout";

export default function SystemWorkoutDetailPage() {
  const { id, workoutId } = useParams();
  const currentWorkoutId = workoutId || id;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const isMock = searchParams.get("mock") === "true";
  const category = ["skill", "skills"].includes(searchParams.get("type")) ? "skills" : "health";

  useEffect(() => {
    let active = true;
    setWorkout(null);
    setErrorMessage("");
    if (isMock) {
      const sample = mockSystemWorkouts.find((item) => String(item.id) === currentWorkoutId);
      if (sample) {
        setWorkout({
          title: sample.title,
          description: sample.description,
          level: sample.level,
          totalExercises: sample.exerciseCount,
          totalSets: sample.totalSets,
          estimatedDuration: Number(String(sample.totalTime || "").match(/\d+/)?.[0] || 0),
          exercises: sample.exercises || [],
        });
      } else {
        setErrorMessage("Could not find this sample system workout.");
      }
      return () => {
        active = false;
      };
    }

    getSystemWorkout(currentWorkoutId)
      .then((result) => {
        if (active) setWorkout(result);
      })
      .catch((error) => {
        if (active) {
          setErrorMessage(error.response?.data?.message || "Could not load this system workout.");
        }
      });
    return () => {
      active = false;
    };
  }, [currentWorkoutId, isMock]);

  const openExercise = (exercise) => {
    const exerciseId = exercise.exerciseId ?? exercise.id;
    if (exerciseId == null) {
      setErrorMessage("This workout exercise does not have a valid exercise ID.");
      return;
    }

    const typeParam = category === "skills" ? "skills" : "health";
    const query = new URLSearchParams({
      workoutId: String(currentWorkoutId),
      type: typeParam,
    });
    if (isMock) query.set("mock", "true");

    navigate(`/library/exercises/system/${exerciseId}?${query.toString()}`, {
      state: {
        exercise: {
          ...exercise,
          id: exerciseId,
          name: exercise.name || exercise.exerciseTitle || "Exercise",
          muscleGroup: exercise.muscleGroup || exercise.targetMuscle || "Full body",
        },
        backPath: `/library/workouts/system/${currentWorkoutId}?type=${typeParam}${isMock ? "&mock=true" : ""}`,
      },
    });
  };

  /**
   * Bấm "Start workout" -> xếp hàng toàn bộ bài trong workout và mở buổi tập với
   * AI Pose Tracking, giống luồng kế hoạch ngày (Exercise 1 of N -> ... -> kết quả).
   */
  const startWorkout = () => {
    const started = startLibraryWorkout(navigate, workout?.exercises || []);
    if (!started) {
      setErrorMessage("This workout has no exercise you can start yet.");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-12 text-white">
      <button
        type="button"
        onClick={() => navigate(`/library/workouts/system?type=${category}`)}
        className="mb-6 inline-flex items-center gap-2 rounded-xl border border-[#3c3063] bg-[#1a1438] px-4 py-2 text-xs font-semibold text-slate-300 transition-all hover:bg-[#251d4d] hover:text-white"
      >
        &larr; Back to system workouts
      </button>
      {errorMessage ? (
        <div role="alert" className="rounded-xl border border-rose-900 bg-rose-950/40 p-5 text-sm text-rose-200">
          {errorMessage}
        </div>
      ) : !workout ? (
        <p className="py-8 text-sm text-slate-400">Loading workout...</p>
      ) : (
        <>
          <section className="space-y-4 rounded-2xl border border-[#302653] bg-[#120d29] p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold">{workout.title}</h1>
              <span className={`rounded-full px-3 py-1 text-xs capitalize ${getLevelBadgeStyle(workout.level)}`}>
                {workout.level}
              </span>
            </div>
            {workout.description && <p className="text-sm text-slate-300">{workout.description}</p>}
            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
              <span className="rounded-full bg-[#201748] px-3 py-1">{workout.totalExercises} exercises</span>
              <span className="rounded-full bg-[#201748] px-3 py-1">{workout.totalSets} sets</span>
              <span className="rounded-full bg-[#201748] px-3 py-1">Total time: {workout.estimatedDuration} min</span>
            </div>
            {!isMock && (
              <button
                type="button"
                onClick={startWorkout}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-600/80 bg-emerald-700 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-600"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Start workout
              </button>
            )}
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Exercises</h2>
            {workout.exercises?.length ? workout.exercises.map((exercise, index) => {
              const name = exercise.name || exercise.exerciseTitle || "Exercise";
              const level = exercise.level || "Beginner";
              const dosage = exercise.duration != null
                ? (typeof exercise.duration === "string" ? exercise.duration : `${exercise.duration} sec`)
                : exercise.reps == null
                  ? "—"
                  : typeof exercise.reps === "string"
                    ? exercise.reps
                    : `${exercise.reps} reps`;
              const rest = exercise.rest ?? `${exercise.restSeconds ?? 0}s`;
              const muscleGroup = exercise.muscleGroup || exercise.targetMuscle || "Full body";
              return (
              <button
                type="button"
                key={`${exercise.id ?? exercise.exerciseId}-${index}`}
                onClick={() => openExercise({ ...exercise, name, level, dosage, rest, muscleGroup })}
                className="w-full cursor-pointer rounded-xl border border-[#302653] bg-[#120d29] p-5 text-left text-white transition-colors hover:border-[#523d8c]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{index + 1}. {name}</h3>
                  <span className={`rounded-full px-3 py-1 text-xs capitalize ${getLevelBadgeStyle(level)}`}>{level}</span>
                </div>
                <p className="mt-2 text-sm text-slate-400">{muscleGroup}</p>
                <p className="mt-3 text-sm text-slate-200">
                  {exercise.sets} sets · {dosage} · {rest} rest
                </p>
              </button>
            );
            }) : (
              <p className="text-sm text-slate-400">No exercises in this workout.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
