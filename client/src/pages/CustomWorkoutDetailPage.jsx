import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCommunityWorkout } from "../api/library";
import { getLevelBadgeStyle } from "../utils/levelBadge";
import { startLibraryWorkout } from "../utils/libraryWorkout";

export default function CustomWorkoutDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    getCommunityWorkout(id)
      .then((data) => {
        if (active) setWorkout(data);
      })
      .catch((error) => {
        if (active) {
          setErrorMessage(error.response?.data?.message || "Could not load this workout.");
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  const openExercise = (exercise) => {
    const exerciseId = exercise.exerciseId ?? exercise.id;
    if (exerciseId == null) {
      setErrorMessage("This workout exercise does not have a valid exercise ID.");
      return;
    }

    const path = exercise.isSystem
      ? `/library/exercises/system/${exerciseId}`
      : `/library/member/${exerciseId}`;
    navigate(path, {
      state: {
        exercise: {
          ...exercise,
          id: exerciseId,
          name: exercise.name || exercise.title || "Exercise",
          muscleGroup: exercise.muscleGroup || exercise.targetMuscle || "",
        },
        backPath: `/library/custom/${id}`,
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
        onClick={() => navigate("/library/custom")}
        className="text-slate-300 hover:text-white bg-[#1f1a3a] border border-[#3b2d68] hover:bg-[#2c2452] px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-2"
      >
        &larr; Back to community workouts
      </button>

      {errorMessage ? (
        <div role="alert" className="rounded-xl border border-rose-900 bg-rose-950/40 p-5 text-sm text-rose-200">
          {errorMessage}
        </div>
      ) : !workout ? (
        <p className="text-sm text-slate-400">Loading workout...</p>
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
            <p className="text-xs text-slate-400">
              By {workout.author.name} · {workout.postedTime} · {workout.savesCount} saved
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
              <span className="rounded-full bg-[#201748] px-3 py-1">{workout.exercisesCount} exercises</span>
              <span className="rounded-full bg-[#201748] px-3 py-1">{workout.setsCount} sets</span>
              <span className="rounded-full bg-[#201748] px-3 py-1">{workout.duration}</span>
            </div>
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
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Exercises</h2>
            {workout.exercises?.length ? (
              workout.exercises.map((exercise, index) => (
                <button
                  type="button"
                  key={`${exercise.exerciseId}-${index}`}
                  onClick={() => openExercise(exercise)}
                  className="w-full cursor-pointer rounded-xl border border-[#302653] bg-[#120d29] p-5 text-left text-white transition-all hover:border-purple-500/50 hover:bg-[#251f47]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{index + 1}. {exercise.title}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${getLevelBadgeStyle(exercise.level || exercise.difficultyLevel)}`}>
                      {exercise.level || exercise.difficultyLevel || "Intermediate"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{exercise.targetMuscle}</p>
                  <p className="mt-3 text-sm text-slate-200">
                    {exercise.sets} sets · {exercise.countBy === "sec" ? `${exercise.reps} sec` : `${exercise.reps} reps`} · {exercise.restSec}s rest
                  </p>
                </button>
              ))
            ) : (
              <p className="text-sm text-slate-400">No exercises in this workout.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
