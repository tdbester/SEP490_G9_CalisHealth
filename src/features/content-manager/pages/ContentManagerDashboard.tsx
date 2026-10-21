import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/features/auth/api/authApi';
import type { MemberLevelStat } from '@/features/auth/types';

const areas = [
  {
    path: '/content/survey',
    icon: 'survey',
    title: 'Survey management',
    description: 'Questions and options members answer when they sign up.',
    preview: 'Body info · Goals · Routine · Level test',
    figures: '4 steps · 12 questions',
    action: 'Manage survey',
  },
  {
    path: '/content/exercises',
    icon: 'exercise',
    title: 'Exercise & Workout Management',
    description: 'Manage exercises, skills and workouts members can browse and train.',
    preview: 'Exercise list · Workout list',
    figures: 'Manage exercises, skills and workouts',
    action: 'Manage exercises',
  },
  {
    path: '/content/progression-rules',
    icon: 'rules',
    title: 'Progression rules',
    description: 'What a member must do to unlock a harder exercise.',
    preview: 'Push-up → Diamond push-up: 20 clean reps in a row',
    figures: '14 rules',
    action: 'Manage rules',
  },
  {
    path: '/content/level-criteria',
    icon: 'levels',
    title: 'Level criteria',
    description: 'Survey results that place a member at Beginner, Intermediate or Advanced.',
    preview: 'Push-up 30 reps + Plank 50 s = Intermediate',
    figures: '3 levels',
    action: 'Manage criteria',
  },
] as const;

const levelColors = ['#58d68d', '#f2c94c', '#eb7777'];

function formatLevelName(level: string) {
  return level
    .toLowerCase()
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const recentChanges = [
  { label: 'Intermediate push-up set to 30 reps', time: 'Today' },
  { label: 'Added Diamond push-up to library', time: 'Yesterday' },
  { label: 'Survey: renamed a step 3 question', time: '3 days ago' },
] as const;

function AreaIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    survey: 'M6 3h12v18H6zM9 7h6M9 11h6M9 15h4',
    exercise: 'M3 9v6m3-9v12m12-12v12m3-9v6M6 12h12',
    rules: 'M3 17l6-6 4 3 8-9M15 5h6v6',
    levels: 'M4 20v-6M10 20V9M16 20V4M22 20v-9',
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d={paths[name]} />
    </svg>
  );
}

export function ContentManagerDashboard() {
  const {
    data: memberLevels,
    isLoading: isLoadingMemberLevels,
    isError: hasMemberLevelError,
  } = useQuery({
    queryKey: ['content-dashboard', 'member-levels'],
    queryFn: authApi.memberLevels,
    retry: false,
  });
  const totalMembers = memberLevels?.reduce((sum, level) => sum + level.memberCount, 0) ?? 0;
  const levels: (MemberLevelStat & { percent: number; color: string })[] =
    memberLevels?.map((level, index) => ({
      ...level,
      percent: totalMembers > 0 ? (level.memberCount / totalMembers) * 100 : 0,
      color: levelColors[index % levelColors.length],
    })) ?? [];

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-7 sm:px-8 sm:py-9">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Content manager dashboard</h1>
        <p className="mt-1 text-sm text-[#aa9bc9] sm:text-base">
          Manage what members answer, what they can train, and how the app sets their level.
        </p>
      </div>

      <section aria-label="Content management areas" className="grid gap-4 lg:grid-cols-2">
        {areas.map((area) => (
          <article key={area.title} className="flex min-w-0 flex-col rounded-2xl border border-[#38265e] bg-[#21183e] p-4 shadow-lg shadow-black/10 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#49308b] text-violet-100">
                <AreaIcon name={area.icon} />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold sm:text-lg">{area.title}</h2>
                <p className="mt-0.5 text-sm leading-snug text-[#b4a8d1]">{area.description}</p>
              </div>
            </div>

            <p className="mt-4 truncate rounded-lg border border-[#3b2b63] bg-[#17112e] px-3 py-2 text-xs text-[#e2d9f2] sm:text-sm">
              {area.preview}
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-[#b4a8d1]">{area.figures}</span>
              <Link
                to={area.path}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-300"
              >
                {area.action}
              </Link>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-[#38265e] bg-[#21183e] p-5">
          <h2 className="font-semibold">Members by level</h2>
          {isLoadingMemberLevels ? (
            <p className="mt-4 text-sm text-[#b4a8d1]" role="status">Loading member levels…</p>
          ) : hasMemberLevelError ? (
            <p className="mt-4 rounded-lg border border-rose-400/30 bg-rose-950/30 p-3 text-sm text-rose-200" role="alert">
              Could not load member levels. Check that the `fitness_levels` and `member_profiles` tables exist and that the Content Manager API is running.
            </p>
          ) : levels.length === 0 ? (
            <p className="mt-4 text-sm text-[#b4a8d1]">
              No fitness levels found in the database.
            </p>
          ) : (
            <>
              <div
                role="img"
                aria-label={`Members by level, ${totalMembers} total members: ${levels.map((level) => `${formatLevelName(level.level)} ${Math.round(level.percent)} percent`).join(', ')}`}
                className="mt-4 flex h-3 overflow-hidden rounded-full bg-[#392c5a]"
              >
                {levels.map((level) => (
                  <span
                    key={level.level}
                    style={{ width: `${level.percent}%`, backgroundColor: level.color }}
                  />
                ))}
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#d5cce8] sm:text-sm">
                {levels.map((level) => (
                  <li key={level.level} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: level.color }} />
                    {formatLevelName(level.level)} {Math.round(level.percent)}%
                    <span className="text-[#a99bc9]">({level.memberCount})</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-4 max-w-md text-sm text-[#a99bc9]">
            Check here whether the level criteria are too easy or too hard.
          </p>
        </article>

        <article className="rounded-2xl border border-[#38265e] bg-[#21183e] p-5">
          <h2 className="font-semibold">Recent changes</h2>
          <ul className="mt-3 divide-y divide-[#392b5c]">
            {recentChanges.map((change) => (
              <li key={change.label} className="flex items-start justify-between gap-4 py-3 text-sm first:pt-2">
                <span className="text-[#e2d9f2]">{change.label}</span>
                <time className="shrink-0 text-xs text-[#a99bc9]">{change.time}</time>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[#80729f]">Example activity · change history will appear here when available</p>
        </article>
      </section>
    </main>
  );
}
