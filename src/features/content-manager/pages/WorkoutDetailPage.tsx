import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/features/auth/api/authApi';
import { Breadcrumb } from './ExerciseFormPage';

export function WorkoutDetailPage() {
  const { code = '' } = useParams();
  const { data: workout, isLoading, isError } = useQuery({
    queryKey: ['content', 'workouts', code],
    queryFn: () => authApi.workout(code),
    enabled: Boolean(code),
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
      <Breadcrumb current="Workout details" />
      {isLoading ? (
        <p role="status" className="mt-8 text-sm text-[#b4a8d1]">Loading workout…</p>
      ) : isError || !workout ? (
        <section className="mt-6 rounded-2xl border border-[#38265e] bg-[#191231] p-6">
          <h1 className="text-xl font-bold">Workout not found</h1>
          <p className="mt-2 text-sm text-[#b4a8d1]">This workout may have been removed or the link is invalid.</p>
          <Link to="/content/workouts" className="mt-4 inline-block text-sm text-violet-300 underline">Back to workout list</Link>
        </section>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div><h1 className="text-2xl font-bold">{workout.name}</h1><p className="mt-1 text-sm text-[#aa9bc9]">Workout details</p></div>
            <Link to="/content/workouts" className="rounded-lg border border-[#59427e] px-4 py-2 text-sm text-[#d5cce8] hover:bg-white/5">Back to list</Link>
          </div>
          <section className="mt-6 rounded-2xl border border-[#38265e] bg-[#191231] p-5 sm:p-7">
            <dl className="grid gap-5 sm:grid-cols-2">
              <Detail label="ID" value={workout.code} />
              <Detail label="Type" value={workout.type === 'DAILY_TRAINING_PLAN' ? 'Daily training plan' : 'Workout'} />
              <Detail label="Level" value={workout.level} />
              <Detail label="Status" value={workout.active ? 'Active' : 'Inactive'} />
              <div className="sm:col-span-2"><Detail label="Description" value={workout.description || '—'} /></div>
              <div className="sm:col-span-2"><Detail label="Content" value={workout.content || '—'} /></div>
            </dl>
            {workout.type === 'DAILY_TRAINING_PLAN' ? (
              <div className="mt-5 border-t border-[#38265e] pt-5">
                <h2 className="text-sm font-semibold text-white">7-day training schedule</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: 7 }, (_, dayIndex) => {
                    const items = workout.planItems.filter((item) => item.dayOfWeek === dayIndex + 1);
                    return (
                      <section key={dayIndex} className="rounded-lg border border-[#38265e] bg-[#17112e] p-3">
                        <h3 className="text-xs font-semibold text-violet-200">{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][dayIndex]}</h3>
                        {items.length === 0 ? (
                          <p className="mt-2 text-xs text-[#a99bc9]">Rest day</p>
                        ) : (
                          <ul className="mt-2 space-y-2">
                            {items.map((item) => (
                              <li key={item.exerciseCode} className="rounded-md border border-[#38265e] bg-[#100b20] p-2">
                                <p className="text-xs font-medium text-white">{item.exerciseName}</p>
                                <p className="mt-1 text-[10px] text-[#a99bc9]">{item.muscleGroup}</p>
                                <div className="mt-2 grid grid-cols-3 gap-1 text-[9px] text-[#c7b9e2]">
                                  <span>Beginner: {item.beginnerSets} × {item.beginnerReps}</span>
                                  <span>Intermediate: {item.intermediateSets} × {item.intermediateReps}</span>
                                  <span>Advanced: {item.advancedSets} × {item.advancedReps}</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-5 border-t border-[#38265e] pt-5">
                <h2 className="text-sm font-semibold text-white">Workout exercises</h2>
                {workout.exercises.length === 0 ? (
                  <p className="mt-3 text-sm text-[#b4a8d1]">No exercises are linked to this workout.</p>
                ) : (
                <ol className="mt-3 space-y-2">
                  {workout.exercises.map((exercise, index) => (
                    <li key={exercise.code} className="flex items-center gap-3 rounded-lg border border-[#38265e] bg-[#17112e] px-3 py-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#302354] text-xs text-violet-200">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{exercise.name}</p>
                        <p className="mt-0.5 truncate text-xs text-[#a99bc9]">{exercise.level} · {exercise.muscleGroup}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#38265e] bg-[#17112e] p-4"><dt className="text-xs text-[#a99bc9]">{label}</dt><dd className="mt-1.5 text-sm font-medium text-white">{value}</dd></div>;
}
