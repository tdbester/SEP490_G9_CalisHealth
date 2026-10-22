import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  levelTestSchema,
  LEVEL_FIELDS,
  type LevelTestFormValues,
} from '../schemas/level.schema';
import { SurveyProgressBar } from '../components/SurveyProgressBar';
import { useSurvey } from '../context/SurveyContext';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════
Colors extracted from the Figma frame
  371:3 "Survey - Level test" (800 x 900)
Header mô phỏng trình duyệt đã bỏ (xem BodyInfoPage).
═══════════════════════════════════════════════════════════════════════ */
const SURFACE = {
  pageFrom: '#0d071b',
  pageTo: '#0a0618',

  card: '#151028',
  cardBorder: '#2f2850',

  iconFrom: '#6d4cf5',
  iconTo: '#5739e6',

  inputBg: '#ffffff',
  placeholder: '#6b6785',
  unit: '#9b8fd8',

  label: '#9b8fd8',
  title: '#ffffff',
  muted: '#a39ec4',

  cta: '#7c6cf0',
  ghost: '#15102a',
  ghostBorder: '#3a3266',
  ghostText: '#e4e0f5',
} as const;

/* ─── Icons (inline SVG, matching the Figma vectors) ─────────────────── */

function PushUpIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" className="w-[14px] h-[14px]" aria-hidden="true">
      <path
        d="M7 1.5v3.5M7 5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM2 12.5c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SquatIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" className="w-[14px] h-[14px]" aria-hidden="true">
      <circle cx="7" cy="3" r="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M7 5.2v3.3M4 13l3-4.5 3 4.5M7 8.5L4.2 13M7 8.5L9.8 13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlankIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="w-[16px] h-[16px]" aria-hidden="true">
      <circle cx="4.6" cy="4.4" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8 4.4h5M4.6 7.6v5.6M8.5 9.2L4.6 13.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ICONS: Record<(typeof LEVEL_FIELDS)[number]['key'], React.ReactNode> = {
  pushUp: <PushUpIcon />,
  squat: <SquatIcon />,
  plank: <PlankIcon />,
};

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

/* ─── Movement card ──────────────────────────────────────────────────── */

interface MovementCardProps {
  label: string;
  description: string;
  unit: string;
  icon: React.ReactNode;
  placeholder: string;
  hasError: boolean;
  errorMessage?: string;
  registration: UseFormRegisterReturn;
  onValueChange: (value: number) => void;
}

function MovementCard({
  label,
  description,
  unit,
  icon,
  placeholder,
  hasError,
  errorMessage,
  registration,
  onValueChange,
}: MovementCardProps) {
  return (
    <div
      className="w-full min-h-[112px] rounded-[10px] border-[1.5px] pl-[17px] pr-[17px] pt-[16px]"
      style={{ background: SURFACE.card, borderColor: SURFACE.cardBorder }}
    >
      {/* Icon + label block (Figma 371:34 at x=208 y=376, title at x=256 y=375) */}
      <div className="flex items-center gap-[12px]">
        <div
          className="w-[36px] h-[36px] rounded-[10px] flex items-center justify-center shrink-0"
          style={{
            background: `linear-gradient(135deg, ${SURFACE.iconFrom} 0%, ${SURFACE.iconTo} 100%)`,
            color: '#ffffff',
          }}
        >
          {icon}
        </div>
        <div className="flex flex-col">
          <span className="text-[21px] font-bold text-white leading-tight">{label}</span>
          <span className="text-[16px] leading-tight" style={{ color: '#a39ec4' }}>
            {description}
          </span>
        </div>
      </div>

      {/* Value input (Figma 371:39 at x=208 y=426, 384 x 34) */}
      <div
        className={cn(
          'flex items-center rounded-[4px] h-[34px] px-[16px] mt-[4px]',
          hasError ? 'ring-1 ring-rose-500/50' : ''
        )}
        style={{ background: SURFACE.inputBg }}
      >
        <input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent border-0 p-0 text-base outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          style={{ color: '#111827' }}
          {...registration}
          onChange={(e) => {
            registration.onChange(e);
            const val = parseFloat(e.target.value);
            if (!Number.isNaN(val)) onValueChange(val);
          }}
        />
        <span className="text-base ml-2 select-none shrink-0" style={{ color: SURFACE.unit }}>
          {unit}
        </span>
      </div>

      {hasError && errorMessage && (
        <p className="text-xs text-rose-400 mt-2 ml-1">{errorMessage}</p>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export function LevelTestPage() {
  const navigate = useNavigate();
  const { setLevelTest, data } = useSurvey();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LevelTestFormValues>({
    resolver: zodResolver(levelTestSchema),
    defaultValues: {
      pushUp: data.levelTest?.pushUp ?? NaN,
      squat: data.levelTest?.squat ?? NaN,
      plank: data.levelTest?.plank ?? NaN,
    },
    mode: 'onChange',
  });

  useEffect(() => {
    document.title = 'CalisHealth · Survey – Level test';
  }, []);

  const onSubmit = (values: LevelTestFormValues) => {
    setLevelTest({
      pushUp: values.pushUp,
      squat: values.squat,
      plank: values.plank,
    });
    // Step 4 is the last step — show the result + recommended plan.
    navigate('/survey/result');
  };

  return (
    <div
      className="min-h-screen flex flex-col antialiased selection:bg-fuchsia-500/30 selection:text-white"
      style={{
        background: `linear-gradient(180deg, ${SURFACE.pageFrom} 0%, ${SURFACE.pageTo} 100%)`,
        color: SURFACE.title,
      }}
    >
      {/* ── Content ────────────────────────────────────────────────── */}
      <div className="flex-1 w-full flex justify-center px-4 sm:px-6 pt-10 pb-6">
        <div className="w-full max-w-[420px]">
          <SurveyProgressBar currentStep={4} totalSteps={4} />

          {/* Section header */}
          <div className="mt-6">
            <p className="text-xl font-medium leading-[1.18]" style={{ color: SURFACE.label }}>
              Level test
            </p>
            <h1 className="text-[34px] font-bold text-white leading-[1.24] tracking-tight mt-px">
              Test your level
            </h1>
            <p className="text-lg leading-[1.37] mt-1.5 max-w-[336px]" style={{ color: SURFACE.muted }}>
              Do each move with good form and stop when it breaks.
            </p>
          </div>

          {/* ── Form ──────────────────────────────────────────────────── */}
          <form
            id="level-test-form"
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-4 mt-7"
            noValidate
          >
            {LEVEL_FIELDS.map((field) => (
              <MovementCard
                key={field.key}
                label={field.label}
                description={field.description}
                unit={field.unit}
                icon={ICONS[field.key]}
                placeholder="0"
                hasError={!!errors[field.key]}
                errorMessage={errors[field.key]?.message}
                registration={register(field.key, { valueAsNumber: true })}
                onValueChange={() => {}}
              />
            ))}
          </form>
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
              onClick={() => navigate('/survey/current-training-routine')}
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

            {/* ── Actions ──────────────────────────────────────────────── */}
          <button
            type="submit"
            form="level-test-form"
            className="w-full h-[50px] rounded-lg border-[1.5px] font-medium text-[17px] text-white flex items-center justify-center gap-2.5 cursor-pointer transition-opacity active:scale-[0.99] hover:opacity-90"
            style={{ background: SURFACE.cta, borderColor: SURFACE.cta }}
          >
            <span>Continue</span>
            <ArrowRight />
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}