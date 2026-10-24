import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SurveyProgressBar } from '../components/SurveyProgressBar';
import { TrainingPlanPreviewModal } from '../components/TrainingPlanPreviewModal';
import { useSurvey } from '../context/SurveyContext';
import {
  LEVEL_LABELS,
  LEVEL_ORDER,
  buildRecommendation,
} from '../data/recommendation';

/* ═══════════════════════════════════════════════════════════════════════
Colors extracted from the Figma frame
  259:393 "Survey - Result and recommended plan" (800 x 900)
Phần header mô phỏng trình duyệt đã bỏ (xem BodyInfoPage).
═══════════════════════════════════════════════════════════════════════ */
const SURFACE = {
  pageFrom: '#0a0716',
  pageTo: '#070511',
  card: '#14102a',
  cardBorder: '#2a2545',
  iconTile: '#251e4d',
  iconTileBorder: '#3a3070',
  icon: '#a78bfa',
  label: '#a39ec4',
  title: '#ffffff',
  muted: '#8a85a8',
  body: '#b3afd0',
  cta: '#7459f0',
  ghost: '#15102a',
  ghostBorder: '#2a2545',
  ghostText: '#e4e0f5',
} as const;

/* ─── Icons (inline SVG, matching the Figma vectors) ─────────────────── */

function MedalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-[22px] h-[22px]" aria-hidden="true">
      <circle cx="12" cy="9" r="5.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M8.2 13.4L6.5 21l5.5-2.8L17.5 21l-1.7-7.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden="true">
      <path
        d="M8 1.5L9.6 6.4L14.5 8L9.6 9.6L8 14.5L6.4 9.6L1.5 8L6.4 6.4L8 1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden="true">
      <path
        d="M15 8H2M7 2.5L1.5 8L7 13.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 16 12" fill="none" className="w-4 h-3" aria-hidden="true">
      <path
        d="M1 6H14M9.5 1.2L14.5 6L9.5 10.8"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-[18px] h-[18px]" aria-hidden="true">
      <path
        d="M17 10a7 7 0 11-2.4-5.3M17 2v4h-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Main Page ─── */
export function SurveyResultPage() {
  const navigate = useNavigate();
  const { data, resetSurvey } = useSurvey();
  const [previewOpen, setPreviewOpen] = useState(false);

  const recommendation = buildRecommendation(data.levelTest, data.training);
  const { plan, results } = recommendation;

  useEffect(() => {
    document.title = 'CalisHealth · Survey – Result';
  }, []);

  const handleRetake = () => {
    resetSurvey();
    navigate('/survey/body-information');
  };

  const resultsList = [
    { label: 'Push-up', value: results.pushUp, unit: 'reps' },
    { label: 'Squat', value: results.squat, unit: 'reps' },
    { label: 'Plank', value: results.plank, unit: 'sec' },
  ];

  return (
    <div
      className="min-h-screen flex flex-col antialiased selection:bg-fuchsia-500/30 selection:text-white"
      style={{
        background: `linear-gradient(180deg, ${SURFACE.pageFrom} 0%, ${SURFACE.pageTo} 100%)`,
        color: SURFACE.title,
      }}
    >
      <div className="flex-1 w-full flex justify-center px-4 sm:px-6 pt-10 pb-6">
        <div className="w-full max-w-[560px]">
          {/* ── Progress (all 4 steps complete) ─────────────────────── */}
          <SurveyProgressBar currentStep={4} totalSteps={4} />

          {/* "Back to level test" link */}
          <button
            type="button"
            onClick={() => navigate('/survey/level-test')}
            className="mt-6 inline-flex items-center gap-1.5 text-[15px] cursor-pointer transition-opacity hover:opacity-75 bg-transparent border-0 p-0"
            style={{ color: SURFACE.body }}
          >
            <ArrowLeftIcon />
            Back to level test
          </button>

          {/* ── Header ─────────────────────────────────────────────── */}
          <p className="mt-6 text-[15px] font-medium" style={{ color: SURFACE.label }}>
            Result &amp; recommended plan
          </p>
          <h1 className="mt-1 text-[34px] font-bold leading-[1.2] tracking-tight">
            Your results are in
          </h1>
          <p className="mt-1.5 text-[15px] leading-relaxed max-w-[440px]" style={{ color: SURFACE.label }}>
            A starting point that fits you. Let&apos;s build strength, one session at a time.
          </p>

          {/* ── Current level card ─────────────────────────────────── */}
          <section
            className="mt-7 rounded-2xl border-[1.5px] p-5"
            style={{ background: SURFACE.card, borderColor: SURFACE.cardBorder }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-[46px] h-[46px] rounded-xl flex items-center justify-center shrink-0 border"
                style={{ background: SURFACE.iconTile, borderColor: SURFACE.iconTileBorder, color: SURFACE.icon }}
              >
                <MedalIcon />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[13px]" style={{ color: SURFACE.label }}>
                  Your current level
                </p>
                <p className="text-[22px] font-bold leading-tight mt-0.5">
                  {LEVEL_LABELS[recommendation.level]}
                </p>
              </div>

              <span
                className="shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium"
                style={{
                  background: 'rgba(124,108,240,0.18)',
                  borderColor: 'rgba(124,108,240,0.45)',
                  color: '#c9b8ff',
                }}
              >
                Level {recommendation.levelNumber} of {recommendation.totalLevels}
              </span>
            </div>

            <p className="text-[15px] leading-relaxed mt-4" style={{ color: SURFACE.body }}>
              {recommendation.blurb}
            </p>

            {/* Level ladder */}
            <div className="mt-5">
              <div className="flex gap-2">
                {LEVEL_ORDER.map((level) => (
                  <div
                    key={level}
                    className="h-[5px] flex-1 rounded-full"
                    style={{
                      background:
                        LEVEL_ORDER.indexOf(level) <= recommendation.levelNumber - 1
                          ? '#a78bfa'
                          : SURFACE.ghostBorder,
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                {LEVEL_ORDER.map((level) => (
                  <span
                    key={level}
                    className="flex-1 text-[12px]"
                    style={{
                      color:
                        LEVEL_ORDER.indexOf(level) <= recommendation.levelNumber - 1
                          ? '#a78bfa'
                          : SURFACE.muted,
                    }}
                  >
                    {LEVEL_LABELS[level]}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* ── Test results ──────────────────────────────────────── */}
          <section className="mt-8">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-[19px] font-bold leading-tight">Your test results</h2>
              <p className="text-[13px] shrink-0" style={{ color: SURFACE.muted }}>
                Your starting benchmark
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-3.5">
              {resultsList.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border-[1.5px] px-4 py-3.5"
                  style={{ background: SURFACE.card, borderColor: SURFACE.cardBorder }}
                >
                  <p className="text-[13px] truncate" style={{ color: SURFACE.body }}>
                    {item.label}
                  </p>
                  <p className="mt-1.5 flex items-baseline gap-1">
                    <span className="text-[26px] font-bold leading-none">{item.value}</span>
                    <span className="text-[13px]" style={{ color: SURFACE.muted }}>
                      {item.unit}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Recommended plan ───────────────────────────────────── */}
          <section
            className="mt-6 rounded-2xl border-[1.5px] p-5"
            style={{ background: SURFACE.card, borderColor: SURFACE.cardBorder }}
          >
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: SURFACE.icon }}>
              <SparkleIcon />
              Recommended for you
            </span>

            <h3 className="mt-2 text-[22px] font-bold leading-tight">{plan.name}</h3>
            <p className="mt-2 text-[15px] leading-relaxed" style={{ color: SURFACE.body }}>
              {plan.description}
            </p>

            {/* Meta chips */}
            <div className="flex flex-wrap gap-2 mt-4">
              {[plan.meta.weeks, plan.meta.sessions, plan.meta.duration].map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center rounded-full border px-3 py-1.5 text-[13px]"
                  style={{
                    background: SURFACE.iconTile,
                    borderColor: SURFACE.iconTileBorder,
                    color: SURFACE.body,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="h-px w-full mt-5" style={{ background: SURFACE.cardBorder }} />

            {/* Weekly rhythm */}
            <p className="text-[14px] font-semibold mt-5" style={{ color: SURFACE.body }}>
              Your weekly rhythm
            </p>
            <ul className="grid grid-cols-3 gap-2.5 mt-3">
              {plan.rhythm.map((slot) => (
                <li
                  key={`${slot.day}-${slot.name}`}
                  className="rounded-xl px-3.5 py-3"
                  style={{ background: '#1d1740' }}
                >
                  <span className="text-[12px] font-semibold tracking-wide" style={{ color: SURFACE.icon }}>
                    {slot.day}
                  </span>
                  <p className="text-[14px] font-medium leading-tight mt-0.5">{slot.name}</p>
                </li>
              ))}
            </ul>

            <p className="text-[13px] leading-relaxed mt-4" style={{ color: SURFACE.muted }}>
              {plan.note}
            </p>
          </section>

          {/* ── Actions ────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3 mt-6">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full h-[50px] rounded-lg font-semibold text-[16px] text-white flex items-center justify-center gap-2.5 cursor-pointer transition-opacity active:scale-[0.99] hover:opacity-90"
              style={{ background: SURFACE.cta }}
            >
              Start my training plan
              <ArrowRightIcon />
            </button>

            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="w-full h-[50px] rounded-lg border-[1.5px] font-medium text-[16px] flex items-center justify-center gap-2.5 cursor-pointer transition-opacity active:scale-[0.99] hover:opacity-85"
              style={{
                background: SURFACE.ghost,
                borderColor: SURFACE.ghostBorder,
                color: '#ffffff',
              }}
            >
              Preview training plan
              <ArrowRightIcon />
            </button>
          </div>

          <div className="mt-5 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleRetake}
              className="inline-flex items-center gap-1.5 text-[15px] cursor-pointer transition-opacity hover:opacity-75 bg-transparent border-0 p-0"
              style={{ color: SURFACE.body }}
            >
              <RefreshIcon />
              Retake survey
            </button>
            <p className="text-[13px] text-center" style={{ color: SURFACE.muted }}>
              Your plan can evolve as you get stronger.
            </p>
          </div>
        </div>
      </div>

      {/* ── Preview popup ────────────────────────────────────────────
          Bấm "Preview training plan" mở popup; đóng popup quay lại
          đúng màn hình này (không điều hướng đi nơi khác). */}
      <TrainingPlanPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        recommendation={recommendation}
      />
    </div>
  );
}