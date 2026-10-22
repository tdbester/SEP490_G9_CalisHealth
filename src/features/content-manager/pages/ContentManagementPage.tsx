import { Link, useParams } from 'react-router-dom';

const pageDetails: Record<string, { title: string; description: string }> = {
  survey: {
    title: 'Survey management',
    description: 'Manage questions and options members answer when they sign up.',
  },
  workouts: {
    title: 'Workout list',
    description: 'Manage workouts members can follow and complete.',
  },
  'progression-rules': {
    title: 'Progression rules',
    description: 'Manage the requirements members must meet to unlock harder exercises.',
  },
  'level-criteria': {
    title: 'Level criteria',
    description: 'Manage survey criteria for Beginner, Intermediate and Advanced levels.',
  },
};

export function ContentManagementPage() {
  const { section = '' } = useParams();
  const page = pageDetails[section];

  if (!page) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-8">
        <h1 className="text-2xl font-bold">Management area not found</h1>
        <Link to="/content/dashboard" className="mt-4 inline-block text-violet-300 underline">
          Back to dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <Link to="/content/dashboard" className="text-sm text-violet-300 hover:text-white">
        ← Dashboard
      </Link>
      <section className="mt-5 rounded-2xl border border-[#38265e] bg-[#21183e] p-6 sm:p-8">
        <h1 className="text-2xl font-bold">{page.title}</h1>
        <p className="mt-2 text-[#b4a8d1]">{page.description}</p>
        <div className="mt-6 rounded-xl border border-dashed border-[#59427e] bg-[#17112e] p-5 text-sm leading-relaxed text-[#c8bddf]">
          This management screen is ready for its content and editing workflow. The dashboard previews are example data and are not connected to live management records yet.
        </div>
      </section>
    </main>
  );
}
