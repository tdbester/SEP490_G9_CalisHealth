import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { bodySchema, GENDER_VALUES, type BodyFormValues, type Gender } from '../schemas/body.schema';
import { SurveyProgressBar } from '../components/SurveyProgressBar';
import { useSurvey } from '../context/SurveyContext';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════
Colors extracted from the Figma frame
"CalisHealth_Body_Information_Survey 1" (1198 x 1050)
Phần header mô phỏng trình duyệt (URL bar + back arrow) đã bỏ vì chạy trong
browser thật. Các token dưới đây chỉ còn phần nội dung form.
═══════════════════════════════════════════════════════════════════════ */
const SURFACE = {
  pageFrom: '#0d071b',
  pageTo: '#0a0618',
  progressActive: '#a78bfa',
  progressIdle: '#33254f',
  label: '#b4a0e5',
  card: '#171128',
  cardBorder: '#3c2a67',
  iconFrom: '#7850f4',
  iconTo: '#5c3ce0',
  inputBg: '#ffffff',
  placeholder: '#5b5864',
  unit: '#a69ac2',
  ctaFrom: '#c52edb',
  ctaMid: '#8855eb',
  ctaTo: '#3c7df3',
} as const;

/* ─── Icons (inline SVG, matching the Figma vectors) ─────────────────── */

function PersonIcon() {
  return (
    <svg viewBox="0 0 26 32" fill="none" className="w-[30px] h-[30px]" aria-hidden="true">
      <circle cx="13" cy="7" r="6" stroke="currentColor" strokeWidth="2.6" />
      <path
        d="M2 29C2 22.9253 6.92533 18 13 18C19.0747 18 24 22.9253 24 29"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 28 29" fill="none" className="w-[30px] h-[30px]" aria-hidden="true">
      <rect x="2.6" y="5.6" width="22.8" height="21.8" rx="2" stroke="currentColor" strokeWidth="2.5" />
      <path
        d="M2.6 12H25.4M9 2.6V7.6M19 2.6V7.6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function RulerIcon() {
  return (
    <svg viewBox="0 0 31 31" fill="none" className="w-[30px] h-[30px]" aria-hidden="true">
      <rect
        x="3.4"
        y="11.4"
        width="24.2"
        height="8.2"
        rx="1.6"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path
        d="M9 11.4V16M14 11.4V14.6M19 11.4V16M24 11.4V14.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ScaleIcon() {
  return (
    <svg viewBox="0 0 30 30" fill="none" className="w-[30px] h-[30px]" aria-hidden="true">
      <rect x="3" y="4.5" width="24" height="21" rx="3" stroke="currentColor" strokeWidth="2.5" />
      <path
        d="M15 10.5V15.5M15 10.5L11.5 13.5M15 10.5L18.5 13.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 12 6" fill="none" className="w-3 h-1.5 shrink-0" aria-hidden="true">
      <path
        d="M1 1L6 5L11 1"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg viewBox="0 0 20 16" fill="none" className="w-5 h-4" aria-hidden="true">
      <path
        d="M1 8H18M12.5 2L18.5 8L12.5 14"
        stroke="currentColor"
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Card shell shared by the four metrics ───────────────────────────── */

interface CardShellProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function CardShell({ icon, title, children }: CardShellProps) {
  return (
    <div
      className="w-full max-w-[487px] ml-[29px] rounded-[10px] border-[1.6px] px-6 pt-4 pb-[8.4px]"
      style={{ background: SURFACE.card, borderColor: SURFACE.cardBorder }}
    >
      <div className="flex items-center gap-[18px] h-[58px]">
        <div
          className="w-[58px] h-[58px] rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `linear-gradient(135deg, ${SURFACE.iconFrom} 0%, ${SURFACE.iconTo} 100%)` }}
        >
          {icon}
        </div>
        <span className="text-xl font-bold text-white leading-tight">{title}</span>
      </div>
      {children}
    </div>
  );
}

/* ─── Numeric metric card (age / height / weight) ─────────────────────── */

interface MetricCardProps {
  label: string;
  icon: React.ReactNode;
  unit: string;
  placeholder: string;
  min: number;
  max: number;
  hasError: boolean;
  errorMessage?: string;
  registration: UseFormRegisterReturn;
  onValueChange?: (value: number) => void;
}

function MetricCard({
  label,
  icon,
  unit,
  placeholder,
  min,
  max,
  hasError,
  errorMessage,
  registration,
  onValueChange,
}: MetricCardProps) {
  return (
    <CardShell icon={icon} title={label}>
      <div
        className={cn(
          'flex items-center rounded-[4px] h-[31px] px-[19px] mt-1 transition-colors',
          hasError ? 'ring-1 ring-rose-500/50' : ''
        )}
        style={{ background: SURFACE.inputBg }}
      >
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent border-0 p-0 text-base outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          style={{ color: '#111827' }}
          {...registration}
          onChange={(e) => {
            registration.onChange(e);
            const val = parseFloat(e.target.value);
            if (!Number.isNaN(val)) onValueChange?.(val);
          }}
        />
        <span className="text-base ml-2 select-none shrink-0" style={{ color: SURFACE.unit }}>
          {unit}
        </span>
      </div>

      {hasError && errorMessage && (
        <p className="text-xs text-rose-400 mt-2 ml-1">{errorMessage}</p>
      )}
    </CardShell>
  );
}

/* ─── Gender select card ──────────────────────────────────────────────── */

interface GenderCardProps {
  hasError: boolean;
  errorMessage?: string;
  value: string;
  onChange: (value: string) => void;
}

const GENDER_LABELS: Record<(typeof GENDER_VALUES)[number], string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
};

function GenderCard({ hasError, errorMessage, value, onChange }: GenderCardProps) {
  return (
    <CardShell icon={<PersonIcon />} title="Gender">
      <div className="relative flex items-center rounded-[4px] h-[31px] mt-1" style={{ background: SURFACE.inputBg }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Gender"
          className="flex-1 min-w-0 h-full bg-transparent border-0 p-0 pl-[19px] pr-7 text-base outline-none cursor-pointer appearance-none"
          style={{ color: value ? '#111827' : SURFACE.placeholder }}
        >
          <option value="" disabled>
            Select gender
          </option>
          {GENDER_VALUES.map((g) => (
            <option key={g} value={g} className="text-gray-900 bg-white">
              {GENDER_LABELS[g]}
            </option>
          ))}
        </select>
        <span className="absolute right-4 pointer-events-none" style={{ color: SURFACE.unit }}>
          <ChevronDown />
        </span>
      </div>

      {hasError && errorMessage && (
        <p className="text-xs text-rose-400 mt-2 ml-1">{errorMessage}</p>
      )}
    </CardShell>
  );
}

/* ─── Main Page ─── */
export function BodyInfoPage() {
  const navigate = useNavigate();
  const { setBody, data, resetSurvey } = useSurvey();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<BodyFormValues>({
    resolver: zodResolver(bodySchema),
    defaultValues: {
      gender: data.body?.gender ?? '',
      age: data.body?.age ?? 22,
      height: data.body?.height ?? 170,
      weight: data.body?.weight ?? 65,
    },
    mode: 'onChange',
  });

  useEffect(() => {
    document.title = 'CalisHealth · Survey – Body Information';
  }, []);

  const onSubmit = (values: BodyFormValues) => {
    // The schema already guarantees `gender` is one of GENDER_VALUES.
    setBody({ ...values, gender: values.gender as Gender });
    navigate('/survey/goals-and-motivation');
  };

  const handleSkip = () => {
    resetSurvey();
    navigate('/');
  };

  return (
    <div
      className="min-h-screen flex flex-col antialiased selection:bg-fuchsia-500/30 selection:text-white"
      style={{
        background: `linear-gradient(180deg, ${SURFACE.pageFrom} 0%, ${SURFACE.pageTo} 100%)`,
        color: '#ffffff',
      }}
    >
      {/* Header mô phỏng trình duyệt (URL bar + back arrow) đã bỏ:
          chạy trong browser thật thì phần này là thừa. */}

      {/* ── Content ────────────────────────────────────────────────── */}
      <div className="flex-1 w-full flex justify-center px-4 sm:px-6 pt-10 pb-6">
        <div className="w-full max-w-[584px]">
          {/* Step indicator - label above the progress bar (Figma y=144) */}
          <SurveyProgressBar currentStep={1} totalSteps={4} />

          {/* Section header */}
          <div className="mt-6">
            <p className="text-xl font-medium leading-[1.18]" style={{ color: SURFACE.label }}>
              Body information
            </p>
            <h1 className="text-[34px] font-bold text-white leading-[1.24] tracking-tight mt-px">
              Your body stats
            </h1>
            <p className="text-lg leading-[1.37] mt-1.5 max-w-[387px]" style={{ color: SURFACE.label }}>
              We'll use this to tailor your workout plan.
            </p>
          </div>

          {/* ── Form ──────────────────────────────────────────────────── */}
          <form
            id="body-info-form"
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-3 mt-7"
            noValidate
          >
            {/* Gender */}
            <Controller
              name="gender"
              control={control}
              render={({ field }) => (
                <GenderCard
                  value={field.value}
                  onChange={field.onChange}
                  hasError={!!errors.gender}
                  errorMessage={errors.gender?.message}
                />
              )}
            />

            {/* Age */}
            <MetricCard
              label="Age"
              icon={<CalendarIcon />}
              unit="years"
              placeholder="22"
              min={10}
              max={100}
              hasError={!!errors.age}
              errorMessage={errors.age?.message}
              registration={register('age', { valueAsNumber: true })}
            />

            {/* Height */}
            <MetricCard
              label="Height"
              icon={<RulerIcon />}
              unit="cm"
              placeholder="170"
              min={50}
              max={300}
              hasError={!!errors.height}
              errorMessage={errors.height?.message}
              registration={register('height', { valueAsNumber: true })}
            />

            {/* Weight */}
            <MetricCard
              label="Weight"
              icon={<ScaleIcon />}
              unit="kg"
              placeholder="65"
              min={10}
              max={500}
              hasError={!!errors.weight}
              errorMessage={errors.weight?.message}
              registration={register('weight', { valueAsNumber: true })}
            />
          </form>

          {/* ── Actions ──────────────────────────────────────────────── */}
          <button
            type="submit"
            form="body-info-form"
            className="w-full max-w-[487px] ml-[29px] mt-[28px] h-[58px] rounded-lg font-bold text-xl text-white flex items-center justify-center gap-2.5 transition-opacity active:scale-[0.99] cursor-pointer hover:opacity-90"
            style={{
              background: `linear-gradient(90deg, ${SURFACE.ctaFrom} 0%, ${SURFACE.ctaMid} 52%, ${SURFACE.ctaTo} 100%)`,
            }}
          >
            <span>Continue</span>
            <ArrowRight />
          </button>

          <div className="w-full max-w-[487px] ml-[29px] mt-[21px] text-center">            <button
              type="button"
              onClick={handleSkip}
              className="bg-transparent border-0 p-0 text-base cursor-pointer transition-colors hover:text-white"
              style={{ color: SURFACE.label, textDecoration: 'underline', textUnderlineOffset: '4px' }}
            >
              Skip survey
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
