import { NavLink, Outlet } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';

const links = [
  { to: '/content/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/content/survey', label: 'Survey', icon: 'survey' },
  { to: '/content/exercises', label: 'Exercise & Workout Management', icon: 'exercise' },
  { to: '/content/progression-rules', label: 'Progression rules', icon: 'rules' },
  { to: '/content/level-criteria', label: 'Level criteria', icon: 'levels' },
] as const;

function MenuIcon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    dashboard: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z',
    survey: 'M6 3h12v18H6zM9 7h6M9 11h6M9 15h4',
    exercise: 'M3 9v6m3-9v12m12-12v12m3-9v6M6 12h12',
    rules: 'M3 17l6-6 4 3 8-9M15 5h6v6',
    levels: 'M4 20v-6M10 20V9M16 20V4M22 20v-9',
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d={icons[name] ?? icons.dashboard} />
    </svg>
  );
}

export function ContentManagerLayout() {
  const { user, logout } = useAuthContext();

  return (
    <div className="min-h-screen bg-[#0b0718] text-white md:flex">
      <aside className="border-b border-[#30234f] bg-[#100a22] md:min-h-screen md:w-56 md:border-b-0 md:border-r">
        <div className="flex h-16 items-center gap-3 border-b border-[#30234f] px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-fuchsia-500/70 bg-[#21123b] text-fuchsia-300">✦</span>
          <span className="font-bold tracking-tight">
            Calis<span className="text-fuchsia-400">Health</span>
          </span>
        </div>

        <nav aria-label="Content manager menu" className="flex gap-1 overflow-x-auto p-3 md:flex-col">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-[#352066] font-semibold text-white'
                    : 'text-[#b6a9d4] hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <MenuIcon name={link.icon} />
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex min-h-16 items-center justify-end gap-3 border-b border-[#30234f] px-4 sm:px-8">
          <div className="mr-1 hidden text-right sm:block">
            <p className="text-sm font-medium">{user?.fullName ?? 'Content Manager'}</p>
            <p className="text-xs text-[#a99bc9]">Content Manager</p>
          </div>
          <div aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full border border-violet-400 text-violet-200">
            {user?.fullName?.slice(0, 1).toUpperCase() ?? 'C'}
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-rose-400/30 px-3 py-2 text-sm text-rose-200 transition-colors hover:bg-rose-400/10"
          >
            Đăng xuất
          </button>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
