import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/features/auth/api/authApi';
import type { ExerciseEntry } from '@/features/auth/types';
import { ContentListToolbar } from '../components/ContentListToolbar';

const PAGE_SIZE = 10;

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function pageNumbers(current: number, total: number) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = current <= 2
    ? new Set([1, 2, 3, total])
    : current >= total - 1
      ? new Set([1, total - 2, total - 1, total])
      : new Set([1, current - 1, current, current + 1, total]);
  return [...pages].filter((page) => page > 0 && page <= total).sort((a, b) => a - b);
}

function ExerciseIcon({ skill }: { skill: boolean }) {
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${skill ? 'bg-[#38256b] text-violet-200' : 'bg-[#302354] text-[#d9cef5]'}`}>
      {skill ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="m12 2 2.7 6.1 6.6.6-5 4.4 1.5 6.4L12 16.1l-5.8 3.4 1.5-6.4-5-4.4 6.6-.6L12 2Z" />
        </svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M3 9v6m3-9v12m12-12v12m3-9v6M6 12h12" />
        </svg>
      )}
    </span>
  );
}

export function ExerciseListPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['content', 'exercises'],
    queryFn: authApi.exercises,
  });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const statusMutation = useMutation({
    mutationFn: ({ code, active }: { code: string; active: boolean }) => authApi.updateExerciseStatus(code, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content', 'exercises'] }),
  });

  const activeCount = data.filter((entry) => entry.active).length;
  const inactiveCount = data.length - activeCount;
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.filter((entry) => {
      const matchesSearch = !term || entry.name.toLowerCase().includes(term) || entry.code.toLowerCase().includes(term);
      const matchesStatus = status === 'all' || (status === 'active' ? entry.active : !entry.active);
      const matchesType = type === 'all' || entry.type.toLowerCase() === type;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [data, search, status, type]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageEntries = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pages = pageNumbers(currentPage, totalPages);
  const start = filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const end = Math.min(currentPage * PAGE_SIZE, filtered.length);

  const changeFilter = (change: () => void) => {
    change();
    setPage(1);
  };

  return (
    <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[#a99bc9]">
            <Link to="/content/dashboard" className="hover:text-white">Content manager</Link>
            <span className="mx-1.5">/</span>
            <span>Exercise &amp; Workout Management</span>
            <span className="mx-1.5">/</span>
            <span className="text-violet-200">Exercise list</span>
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Exercise list</h1>
          <p className="mt-1 text-sm text-[#aa9bc9]">Manage the exercises and skills members can train.</p>
        </div>
        <Link to="/content/create?type=exercise" className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500">
          <span aria-hidden="true" className="text-lg leading-none">+</span>
          Create content
        </Link>
      </div>

      <section aria-label="Exercise summary" className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="All exercises" count={data.length} detail="entries" icon="all" />
        <SummaryCard label="Active" count={activeCount} detail={`${data.length ? ((activeCount / data.length) * 100).toFixed(1) : '0.0'}% of total`} icon="active" />
        <SummaryCard label="Inactive" count={inactiveCount} detail={`${data.length ? ((inactiveCount / data.length) * 100).toFixed(1) : '0.0'}% of total`} icon="inactive" />
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#38265e] bg-[#191231]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#38265e] p-3">
          <ContentListToolbar active="exercises" />
          <label className="flex min-w-52 flex-1 items-center gap-2 rounded-lg border border-[#49386c] bg-[#17112e] px-3">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[#a99bc9]" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" />
            </svg>
            <input
              value={search}
              onChange={(event) => changeFilter(() => setSearch(event.target.value))}
              placeholder="Search exercise or skill"
              className="w-full bg-transparent py-2 text-sm text-white outline-none placeholder:text-[#85769f]"
            />
          </label>
          <select aria-label="Filter by status" value={status} onChange={(event) => changeFilter(() => setStatus(event.target.value))} className="rounded-lg border border-[#49386c] bg-[#17112e] px-3 py-2 text-sm text-[#e5def2]">
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select aria-label="Filter by type" value={type} onChange={(event) => changeFilter(() => setType(event.target.value))} className="rounded-lg border border-[#49386c] bg-[#17112e] px-3 py-2 text-sm text-[#e5def2]">
            <option value="all">All types</option>
            <option value="health">Health</option>
            <option value="skill">Skill</option>
          </select>
          <button type="button" onClick={() => void refetch()} aria-label="Refresh exercise list" title="Refresh" className="rounded-lg border border-[#49386c] bg-[#17112e] px-3 text-lg text-[#cfc4e4] transition-colors hover:bg-[#302354]" disabled={isFetching}>
            <span className={isFetching ? 'inline-block animate-spin' : ''}>↻</span>
          </button>
        </div>

        {isLoading ? (
          <p role="status" className="p-8 text-center text-sm text-[#b4a8d1]">Loading exercises…</p>
        ) : isError ? (
          <div className="p-8 text-center">
            <p role="alert" className="text-sm text-rose-200">Could not load exercises. Check the Content Manager API and try again.</p>
            <button type="button" onClick={() => void refetch()} className="mt-3 rounded-lg border border-[#59427e] px-3 py-2 text-sm text-violet-200 hover:bg-white/5">Try again</button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-xs">
                <thead className="border-b border-[#38265e] text-[10px] uppercase tracking-wider text-[#a99bc9]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Exercise / Skill</th>
                    <th className="px-3 py-3 font-medium">Type</th>
                    <th className="px-3 py-3 font-medium">Muscle group</th>
                    <th className="px-3 py-3 font-medium">Level</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Updated</th>
                    <th className="px-3 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30234f]">
                  {pageEntries.map((entry) => (
                    <ExerciseRow
                      key={entry.code}
                      entry={entry}
                      menuOpen={openMenu === entry.code}
                      onToggleMenu={() => setOpenMenu((current) => current === entry.code ? null : entry.code)}
                      onToggleStatus={() => {
                        statusMutation.mutate({ code: entry.code, active: !entry.active });
                        setOpenMenu(null);
                      }}
                      isUpdating={statusMutation.isPending && statusMutation.variables?.code === entry.code}
                    />
                  ))}
                  {pageEntries.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-[#a99bc9]">{data.length ? 'No exercises match these filters.' : 'No exercises or skills yet. Create your first entry to get started.'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {statusMutation.isError && <p role="alert" className="px-4 pb-2 text-xs text-rose-200">Could not update entry status. Please try again.</p>}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#38265e] px-4 py-3 text-xs text-[#b4a8d1]">
              <span>Showing {start}-{end} of {filtered.length} exercises</span>
              <nav aria-label="Exercise list pages" className="flex items-center gap-1">
                <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1} className="rounded-md px-2 py-1.5 hover:bg-[#302354] disabled:opacity-35">Previous</button>
                {pages.map((pageNumber, index) => (
                  <span key={pageNumber} className="flex items-center gap-1">
                    {index > 0 && pageNumber - pages[index - 1] > 1 && <span className="px-1 text-[#85769f]">…</span>}
                    <button type="button" aria-current={currentPage === pageNumber ? 'page' : undefined} onClick={() => setPage(pageNumber)} className={`min-w-7 rounded-md px-2 py-1.5 ${currentPage === pageNumber ? 'bg-violet-600 font-semibold text-white' : 'hover:bg-[#302354]'}`}>{pageNumber}</button>
                  </span>
                ))}
                <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages} className="rounded-md px-2 py-1.5 hover:bg-[#302354] disabled:opacity-35">Next</button>
              </nav>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function SummaryCard({ label, count, detail, icon }: { label: string; count: number; detail: string; icon: 'all' | 'active' | 'inactive' }) {
  return (
    <article className="rounded-xl border border-[#38265e] bg-[#191231] px-4 py-3">
      <div className="flex items-center gap-3">
        {icon === 'all' ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#38256b] text-lg text-violet-200">+</span>
        ) : (
          <span className={`h-2.5 w-2.5 rounded-full ${icon === 'active' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
        )}
        <div>
          <p className="text-xs text-[#b4a8d1]">{label}</p>
          <p className="mt-0.5 text-sm font-semibold text-white">{count} <span className="text-xs font-normal text-[#a99bc9]">{detail}</span></p>
        </div>
      </div>
    </article>
  );
}

function ExerciseRow({ entry, menuOpen, onToggleMenu, onToggleStatus, isUpdating }: {
  entry: ExerciseEntry;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onToggleStatus: () => void;
  isUpdating: boolean;
}) {
  const isSkill = entry.type === 'Skill';
  return (
    <tr className="text-[#e5def2] hover:bg-white/[0.025]">
      <td className="px-4 py-2">
        <div className="flex items-center gap-2.5">
          <ExerciseIcon skill={isSkill} />
          <div>
            <p className="font-semibold text-white">{entry.name}</p>
            <p className="mt-0.5 text-[10px] text-[#a99bc9]">ID: {entry.code}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] ${isSkill ? 'bg-violet-500/20 text-violet-200' : 'bg-slate-400/15 text-slate-200'}`}>
          {isSkill && <span aria-hidden="true">★</span>}{entry.type}
        </span>
      </td>
      <td className="px-3 py-2">{entry.muscleGroup}</td>
      <td className="px-3 py-2"><span className={`rounded-md border px-2 py-1 text-[10px] ${entry.level.toLowerCase() === 'beginner' ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : entry.level.toLowerCase() === 'advanced' ? 'border-rose-400/40 bg-rose-400/10 text-rose-200' : 'border-violet-400/40 bg-violet-400/10 text-violet-200'}`}>{entry.level}</span></td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${entry.active ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          <span className={entry.active ? 'text-emerald-200' : 'text-rose-200'}>{entry.active ? 'Active' : 'Inactive'}</span>
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-[#b4a8d1]">{formatDate(entry.updatedAt)}</td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          <Link to={`/content/exercises/${encodeURIComponent(entry.code)}`} className="rounded-md border border-[#59427e] px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-[#38256b]">View</Link>
          <div className="relative">
            <button type="button" aria-label={`More actions for ${entry.name}`} aria-expanded={menuOpen} onClick={onToggleMenu} className="rounded-md px-1.5 py-1 text-base text-[#a99bc9] hover:bg-[#302354]">⋮</button>
            {menuOpen && (
              <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-[#49386c] bg-[#21183e] p-1 shadow-xl">
                <Link to={`/content/exercises/${encodeURIComponent(entry.code)}`} onClick={onToggleMenu} className="block rounded-md px-3 py-2 text-left text-xs hover:bg-white/5">View details</Link>
                <button type="button" disabled={isUpdating} onClick={onToggleStatus} className="w-full rounded-md px-3 py-2 text-left text-xs hover:bg-white/5 disabled:opacity-50">{entry.active ? 'Set inactive' : 'Set active'}</button>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
