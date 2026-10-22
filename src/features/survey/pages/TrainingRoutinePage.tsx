import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  trainingSchema,
  EXPERIENCE_VALUES,
  EXPERIENCE_META,
  DAYS_PER_WEEK_VALUES,
  DAY_TILE_SIZE,
  SESSION_MINUTES_VALUES,
  SESSION_MINUTES_META,
  type TrainingFormValues,
  type TrainingExperience,
  type DaysPerWeek,
  type SessionMinutes,
} from '../schemas/training.schema';
import { SurveyProgressBar } from '../components/SurveyProgressBar';
import { useSurvey } from '../context/SurveyContext';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════
Colors extracted from the Figma frame
  246:317 "Survey - Current training routine" (800 x 900)
Header mô phỏng trình duyệt đã bỏ (xem BodyInfoPage).
════════════════════════════════════════════════════════════════════════ */
const SURFACE = {
  pageFrom: '#0d071b',
  pageTo: '#0a0618',

  // Option tiles (experience / days / minutes)
  tileIdle: '#15102a',
  tileIdleBorder: '#2f2850',
  tileActive: '#2d2358',
  tileActiveBorder: '#7c6cf0',
  tileText: '#ffffff',

  label: '#9b8fd8',
  title: '#ffffff',
  muted: '#a39ec4',

  cta: '#7c6cf0',
  ghost: '#15102a',
  ghostBorder: '#3a3266',
  ghostText: '#e4e0f5',
} as const;

/* ─── Icons (inline SVG, matching the Figma vectors) ─────────────────── */

function ArrowRight() {
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

function ArrowLeft() {
  return (
    <svg viewBox="0 0 16 12" fill="none" className="w-4 h-3" aria-hidden="true">
      <path
        d="M15 6H2M6.5 1.2L1.5 6L6.5 10.8"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Option tile shared by the three questions ──────────────────────── */

interface OptionTileProps {
  label: string;
  selected: boolean;
  onSelect: () => void;
  /** Explicit pixel size; Figma sizes every tile individually. */
  width: number;
  height: number;
}

function OptionTile({ label, selected, onSelect, width, height }: OptionTileProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        background: selected ? SURFACE.tileActive : SURFACE.tileIdle,
        borderColor: selected ? SURFACE.tileActiveBorder : SURFACE.tileIdleBorder,
        width,
        height,
      }}
      className={cn(
        'shrink-0 rounded-lg border-[1.5px] flex items-center justify-center',
        'text-[18px] font-semibold transition-all duration-200 cursor-pointer',
        'active:scale-[0.97] hover:border-[#3a3358] whitespace-nowrap'
      )}
    >
      <span style={{ color: SURFACE.tileText }}>{label}</span>
    </button>
  );
}

/* ─── Question block (label + tiles + error) ─────────────────────────── */

interface QuestionProps {
  title: string;
  error?: string;
  children: React.ReactNode;
}

function Question({ title, error, children }: QuestionProps) {
  return (
    <section className="mt-8">
      <h2 className="text-[20px] font-bold text-white mb-3.5">{title}</h2>
      {children}
      {error && <p className="text-xs text-rose-400 mt-2.5 ml-1">{error}</p>}
    </section>
  );
}

/* ─── Main Page ─── */
export function TrainingRoutinePage() {
  const navigate = useNavigate();
  const { setTraining, data } = useSurvey();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TrainingFormValues>({
    resolver: zodResolver(trainingSchema),
    defaultValues: {
      experience: data.training?.experience ?? '',
      // NaN keeps zod's `invalid_type_error` until a tile is picked.
      daysPerWeek: data.training?.daysPerWeek ?? NaN,
      sessionMinutes: data.training?.sessionMinutes ?? NaN,
    },
    mode: 'onChange',
  });

  useEffect(() => {
    document.title = 'CalisHealth · Survey – Current training routine';
  }, []);

  const onSubmit = (values: TrainingFormValues) => {
    // The schema already guarantees every field is a known catalogue entry.
    setTraining({
      experience: values.experience as TrainingExperience,
      daysPerWeek: values.daysPerWeek as DaysPerWeek,
      sessionMinutes: values.sessionMinutes as SessionMinutes,
    });
    // Step 4 collects the raw level-test numbers, then the survey is complete.
    navigate('/survey/level-test');
  };

  return (
    <div
      className="min-h-screen flex flex-col antialiased selection:bg-fuchsia-500/30 selection:text-white"
      style={{
        background: `linear-gradient(180deg, ${SURFACE.pageFrom} 0%, ${SURFACE.pageTo} 100%)`,
        color: SURFACE.title,
      }}
    >
      {/* Header mô phỏng trình duyệt đã bỏ — xem BodyInfoPage. */}

      {/* ── Content ────────────────────────────────────────────────── */}
      <div className="flex-1 w-full flex justify-center px-4 sm:px-6 pt-10 pb-6">
        <div className="w-full max-w-[420px]">
          <SurveyProgressBar currentStep={3} totalSteps={4} />

          {/* Section header */}
          <div className="mt-6">
            <p className="text-xl font-medium leading-[1.18]" style={{ color: SURFACE.label }}>
              Current training routine
            </p>
            <h1 className="text-[34px] font-bold text-white leading-[1.24] tracking-tight mt-px">
              How do you train now?
            </h1>
            <p className="text-lg leading-[1.37] mt-1.5" style={{ color: SURFACE.muted }}>
              This helps us pick the right intensity.
            </p>
          </div>

          <Controller
            name="experience"
            control={control}
            render={({ field }) => (
              <Question title="Training experience" error={errors.experience?.message}>
                <div className="flex flex-wrap gap-x-[10px] gap-y-[12px]">
                  {EXPERIENCE_VALUES.map((value) => (
                    <OptionTile
                      key={value}
                      label={EXPERIENCE_META[value].label}
                      width={EXPERIENCE_META[value].width}
                      height={EXPERIENCE_META[value].height}
                      selected={field.value === value}
                      onSelect={() => field.onChange(value)}
                    />
                  ))}
                </div>
              </Question>
            )}
          />

          {/* ── Days per week ─────────────────────────────────────── */}
          <Controller
            name="daysPerWeek"
            control={control}
            render={({ field }) => (
              <Question title="Days per week" error={errors.daysPerWeek?.message}>
                <div className="flex gap-[14px]">
                  {DAYS_PER_WEEK_VALUES.map((value) => (
                    <OptionTile
                      key={value}
                      label={String(value)}
                      width={DAY_TILE_SIZE}
                      height={DAY_TILE_SIZE}
                      selected={field.value === value}
                      onSelect={() => field.onChange(value)}
                    />
                  ))}
                </div>
              </Question>
            )}
          />

          {/* ── Minutes per session ───────────────────────────────── */}
          <Controller
            name="sessionMinutes"
            control={control}
            render={({ field }) => (
              <Question title="Minutes per session" error={errors.sessionMinutes?.message}>
                <div className="flex flex-wrap gap-[10px]">
                  {SESSION_MINUTES_VALUES.map((value) => (
                    <OptionTile
                      key={value}
                      label={SESSION_MINUTES_META[value].label}
                      width={SESSION_MINUTES_META[value].width}
                      height={SESSION_MINUTES_META[value].height}
                      selected={field.value === value}
                      onSelect={() => field.onChange(value)}
                    />
                  ))}
                </div>
              </Question>
            )}
          />
        </div>
      </div>

      {/* ── Sticky action bar ─────────────────────────────────────── */}
      <div className="sticky bottom-0 w-full px-4 sm:px-6 pb-6 pt-2">
        <div className="mx-auto w-full max-w-[420px]">
          {/* Divider above the actions (Figma y=796) */}
          <div className="w-full h-px mb-[22px]" style={{ background: '#2a2545' }} />

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/survey/goals-and-motivation')}
              className="h-[50px] rounded-lg border-[1.5px] flex items-center justify-center gap-2.5 font-medium text-[17px] cursor-pointer transition-opacity active:scale-[0.99] hover:opacity-85 shrink-0"
              style={{
                background: SURFACE.ghost,
                borderColor: SURFACE.ghostBorder,
                color: SURFACE.ghostText,
                width: '130px',
              }}
            >
              <ArrowLeft />
              <span>Back</span>
            </button>

            <form onSubmit={handleSubmit(onSubmit)} className="flex-1">
              <button
                type="submit"
                className="w-full h-[50px] rounded-lg border-[1.5px] font-medium text-[17px] text-white flex items-center justify-center gap-2.5 cursor-pointer transition-opacity active:scale-[0.99] hover:opacity-90"
                style={{ background: SURFACE.cta, borderColor: SURFACE.cta }}
              >
                <span>Continue</span>
                <ArrowRight />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}