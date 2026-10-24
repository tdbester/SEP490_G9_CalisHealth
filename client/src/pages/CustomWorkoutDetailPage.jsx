import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCommunityWorkout } from "../api/library";

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

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-12 text-white">
      <button
        type="button"
        onClick={() => navigate("/library/custom")}
        className="text-sm text-violet-300 transition-colors hover:text-white"
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
              <span className="rounded-full border border-violet-800 bg-violet-950/50 px-3 py-1 text-xs text-violet-200">
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
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Exercises</h2>
            {workout.exercises?.length ? (
              workout.exercises.map((exercise, index) => (
                <article
                  key={`${exercise.exerciseId}-${index}`}
                  className="rounded-xl border border-[#302653] bg-[#120d29] p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{index + 1}. {exercise.title}</h3>
                    <span className="text-xs text-slate-400">{exercise.level}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{exercise.targetMuscle}</p>
                  <p className="mt-3 text-sm text-slate-200">
                    {exercise.sets} sets · {exercise.countBy === "sec" ? `${exercise.reps} sec` : `${exercise.reps} reps`} · {exercise.restSec}s rest
                  </p>
                </article>
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
