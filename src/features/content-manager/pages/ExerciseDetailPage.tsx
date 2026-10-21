import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { API_URL } from '@/config';
import { authApi } from '@/features/auth/api/authApi';
import { Breadcrumb } from './ExerciseFormPage';

export function ExerciseDetailPage() {
  const { code = '' } = useParams();
  const { data: entry, isLoading, isError } = useQuery({
    queryKey: ['content', 'exercises', code],
    queryFn: () => authApi.exercise(code),
    enabled: Boolean(code),
  });
  const demoVideoUrl = entry?.demoVideoUrl
    ? new URL(entry.demoVideoUrl, new URL(API_URL, window.location.origin)).toString()
    : null;
  const anatomyImageUrl = entry?.anatomyImageUrl
    ? new URL(entry.anatomyImageUrl, new URL(API_URL, window.location.origin)).toString()
    : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
      <Breadcrumb current="Exercise details" />
      {isLoading ? (
        <p role="status" className="mt-8 text-sm text-[#b4a8d1]">Loading exercise…</p>
      ) : isError || !entry ? (
        <section className="mt-6 rounded-2xl border border-[#38265e] bg-[#191231] p-6">
          <h1 className="text-xl font-bold">Exercise or skill not found</h1>
          <p className="mt-2 text-sm text-[#b4a8d1]">This entry may have been removed or the link is invalid.</p>
          <Link to="/content/exercises" className="mt-4 inline-block text-sm text-violet-300 underline">Back to exercise list</Link>
        </section>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{entry.name}</h1>
              <p className="mt-1 text-sm text-[#aa9bc9]">Exercise / skill details</p>
            </div>
            <Link to="/content/exercises" className="rounded-lg border border-[#59427e] px-4 py-2 text-sm text-[#d5cce8] hover:bg-white/5">Back to list</Link>
          </div>
          <section className="mt-6 rounded-2xl border border-[#38265e] bg-[#191231] p-5 sm:p-7">
            <dl className="grid gap-5 sm:grid-cols-2">
              <DetailField label="ID" value={entry.code} />
              <DetailField label="Type" value={entry.type} />
              <DetailField label="Category" value={entry.category || '—'} />
              <DetailField label="Muscle group" value={entry.muscleGroup} />
              <DetailField label="Level" value={entry.level} />
              <DetailField label="Status" value={entry.active ? 'Active' : 'Inactive'} />
              <DetailField label="Last updated" value={new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.updatedAt))} />
              <DetailField label="Description" value={entry.description || '—'} />
              <DetailField label="Guide" value={entry.guide || '—'} />
            </dl>
            <div className="mt-5 border-t border-[#38265e] pt-5">
              <h2 className="text-sm font-semibold text-white">Demo video</h2>
              {demoVideoUrl ? (
                <video src={demoVideoUrl} controls className="mt-3 max-h-[420px] w-full rounded-xl bg-black" aria-label={`${entry.name} demo video`}>
                  Your browser does not support the video element.
                </video>
              ) : (
                <p className="mt-2 text-sm text-[#b4a8d1]">No demo video uploaded.</p>
              )}
            </div>
            <div className="mt-5 border-t border-[#38265e] pt-5">
              <h2 className="text-sm font-semibold text-white">Muscle anatomy</h2>
              {anatomyImageUrl ? (
                <img src={anatomyImageUrl} alt={`${entry.name} muscle anatomy`} className="mt-3 max-h-[480px] w-full rounded-xl bg-[#100b20] object-contain" />
              ) : (
                <p className="mt-2 text-sm text-[#b4a8d1]">No anatomy image uploaded.</p>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#38265e] bg-[#17112e] p-4">
      <dt className="text-xs text-[#a99bc9]">{label}</dt>
      <dd className="mt-1.5 text-sm font-medium text-white">{value}</dd>
    </div>
  );
}
