import { Link } from 'react-router-dom';

export function ContentListToolbar({ active }: { active: 'exercises' | 'workouts' }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Exercise and workout lists" className="inline-flex rounded-lg border border-[#49386c] bg-[#17112e] p-1">
        <Link
          to="/content/exercises"
          aria-current={active === 'exercises' ? 'page' : undefined}
          className={`rounded-md px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${
            active === 'exercises' ? 'bg-violet-600 text-white' : 'text-[#b4a8d1] hover:text-white'
          }`}
        >
          Exercise List
        </Link>
        <Link
          to="/content/workouts"
          aria-current={active === 'workouts' ? 'page' : undefined}
          className={`rounded-md px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${
            active === 'workouts' ? 'bg-violet-600 text-white' : 'text-[#b4a8d1] hover:text-white'
          }`}
        >
          Workout List
        </Link>
      </nav>
    </div>
  );
}
