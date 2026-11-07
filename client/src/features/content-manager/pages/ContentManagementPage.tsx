import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Mapping từ `section` trong URL sang namespace i18n tương ứng.
 * Mỗi section dùng key `contentManager.sections.<key>.title` / `.description`.
 */
const SECTION_KEY_MAP: Record<string, string> = {
  survey: 'surveys',
  workouts: 'workouts',
  'progression-rules': 'progressionRules',
  'level-criteria': 'levelCriteria',
};

export function ContentManagementPage() {
  const { t } = useTranslation();
  const { section = '' } = useParams();
  const sectionKey = SECTION_KEY_MAP[section];

  if (!sectionKey) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-8">
        <h1 className="text-2xl font-bold">{t('contentManager.sections.notFound.title')}</h1>
        <Link to="/content/dashboard" className="mt-4 inline-block text-violet-300 underline">
          {t('contentManager.sections.notFound.backToDashboard')}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <Link to="/content/dashboard" className="text-sm text-violet-300 hover:text-white">
        ← {t('contentManager.sections.dashboard')}
      </Link>
      <section className="mt-5 rounded-2xl border border-[#38265e] bg-[#21183e] p-6 sm:p-8">
        <h1 className="text-2xl font-bold">{t(`contentManager.sections.${sectionKey}.title`)}</h1>
        <p className="mt-2 text-[#b4a8d1]">{t(`contentManager.sections.${sectionKey}.description`)}</p>
        <div className="mt-6 rounded-xl border border-dashed border-[#59427e] bg-[#17112e] p-5 text-sm leading-relaxed text-[#c8bddf]">
          {t('contentManager.sections.placeholder')}
        </div>
      </section>
    </main>
  );
}
