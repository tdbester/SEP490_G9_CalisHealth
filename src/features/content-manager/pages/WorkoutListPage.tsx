import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/features/auth/api/authApi';
import { ContentListToolbar } from '../components/ContentListToolbar';

const PAGE_SIZE = 10;

export function WorkoutListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const routedSuccessMessage = (location.state as { successMessage?: string } | null)?.successMessage;
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['content', 'workouts'],
    queryFn: authApi.workouts,
  });
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.filter((workout) => !term
      || workout.name.toLowerCase().includes(term)
      || workout.code.toLowerCase().includes(term));
  }, [data, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const activeCount = data.filter((workout) => workout.active).length;

  useEffect(() => {
    if (routedSuccessMessage) {
      setSuccessMessage(routedSuccessMessage);
      navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true, state: null });
    }
  }, [location.hash, location.pathname, location.search, navigate, routedSuccessMessage]);

  return (
    <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      {successMessage && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-emerald-400/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">
          <span>{successMessage}</span>
          <button type="button" aria-label="Dismiss success message" onClick={() => setSuccessMessage(null)} className="rounded px-2 text-lg leading-none text-emerald-100 hover:bg-emerald-400/10">×</button>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[#a99bc9]">
            <Link to="/content/dashboard" className="hover:text-white">Content manager</Link>
            <span className="mx-1.5">/</span>Exercise &amp; Workout Management
            <span className="mx-1.5">/</span><span className="text-violet-200">Workout list</span>
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Workout list</h1>
          <p className="mt-1 text-sm text-[#aa9bc9]">Manage workouts members can follow and complete.</p>
        </div>
        <Link to="/content/create?type=workout" className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500">
          <span aria-hidden="true" className="text-lg leading-none">+</span>Create content
        </Link>
      </div>

      <section aria-label="Workout summary" className="grid gap-3 sm:grid-cols-3">
        <Summary label="All workouts" count={data.length} detail="entries" />
        <Summary label="Active" count={activeCount} detail={`${data.length ? ((activeCount / data.length) * 100).toFixed(1) : '0.0'}% of total`} active />
        <Summary label="Inactive" count={data.length - activeCount} detail={`${data.length ? (((data.length - activeCount) / data.length) * 100).toFixed(1) : '0.0'}% of total`} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#38265e] bg-[#191231]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#38265e] p-3">
          <ContentListToolbar active="workouts" />
          <label className="flex min-w-52 flex-1 items-center gap-2 rounded-lg border border-[#49386c] bg-[#17112e] px-3">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[#a99bc9]" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" />
            </svg>
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search workout" className="w-full bg-transparent py-2 text-sm text-white outline-none placeholder:text-[#85769f]" />
          </label>
          <button type="button" onClick={() => void refetch()} aria-label="Refresh workout list" title="Refresh" disabled={isFetching} className="rounded-lg border border-[#49386c] bg-[#17112e] px-3 py-2 text-lg text-[#cfc4e4] hover:bg-[#302354] disabled:opacity-50">↻</button>
        </div>

        {isLoading ? (
          <p role="status" className="p-8 text-center text-sm text-[#b4a8d1]">Loading workouts…</p>
        ) : isError ? (
          <div className="p-8 text-center">
            <p role="alert" className="text-sm text-rose-200">Could not load workouts. Check the Content Manager API and try again.</p>
            <button type="button" onClick={() => void refetch()} className="mt-3 rounded-lg border border-[#59427e] px-3 py-2 text-sm text-violet-200 hover:bg-white/5">Try again</button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="border-b border-[#38265e] text-[10px] uppercase tracking-wider text-[#a99bc9]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Workout</th>
                    <th className="px-3 py-3 font-medium">Type</th>
                    <th className="px-3 py-3 font-medium">Level</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Updated</th>
                    <th className="px-3 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30234f]">
                  {rows.map((workout) => (
                    <tr key={workout.code} className="text-[#e5def2] hover:bg-white/[0.025]">
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-white">{workout.name}</p>
                        <p className="mt-0.5 text-[10px] text-[#a99bc9]">ID: {workout.code}</p>
                      </td>
                      <td className="px-3 py-2.5">{workout.type === 'DAILY_TRAINING_PLAN' ? 'Daily training plan' : 'Workout'}</td>
                      <td className="px-3 py-2.5">{workout.level}</td>
                      <td className="px-3 py-2.5"><Status active={workout.active} /></td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[#b4a8d1]">{new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(workout.updatedAt))}</td>
                      <td className="px-3 py-2.5 text-right"><Link to={`/content/workouts/${encodeURIComponent(workout.code)}`} className="rounded-md border border-[#59427e] px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-[#38256b]">View</Link></td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[#a99bc9]">{data.length ? 'No workouts match this search.' : 'No workouts yet. Create your first workout to get started.'}</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#38265e] px-4 py-3 text-xs text-[#b4a8d1]">
              <span>Showing {filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}-{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} workouts</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1} className="rounded-md px-2 py-1.5 hover:bg-[#302354] disabled:opacity-35">Previous</button>
                <span className="rounded-md bg-violet-600 px-2.5 py-1.5 font-semibold text-white">{currentPage} / {totalPages}</span>
                <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages} className="rounded-md px-2 py-1.5 hover:bg-[#302354] disabled:opacity-35">Next</button>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function Summary({ label, count, detail, active = false }: { label: string; count: number; detail: string; active?: boolean }) {
  return (
    <article className="rounded-xl border border-[#38265e] bg-[#191231] px-4 py-3">
      <div className="flex items-center gap-3">
        {label === 'All workouts' ? <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#38256b] text-lg text-violet-200">+</span> : <span className={`h-2.5 w-2.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-rose-400'}`} />}
        <div><p className="text-xs text-[#b4a8d1]">{label}</p><p className="mt-0.5 text-sm font-semibold text-white">{count} <span className="text-xs font-normal text-[#a99bc9]">{detail}</span></p></div>
      </div>
    </article>
  );
}

function Status({ active }: { active: boolean }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-rose-400'}`} /><span className={active ? 'text-emerald-200' : 'text-rose-200'}>{active ? 'Active' : 'Inactive'}</span></span>;
}
