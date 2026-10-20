import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { bodySchema, type BodyFormValues } from '../schemas/body.schema';
import { SurveyProgressBar } from '../components/SurveyProgressBar';
import { useSurvey } from '../context/SurveyContext';

/* ─── Ruler Icon ─── */
function RulerIcon() {
  return (
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="M3 10h18M3 14h18M7 6v12M11 8v2M11 14v2M15 8v2M15 14v2"
      />
    </svg>
  );
}

/* ─── Scale / Weight Icon ─── */
function ScaleIcon() {
  return (
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="M3 6l9-4 9 4M3 6v14l9 4 9-4V6M12 2v20M3 10h18M3 14h18"
      />
    </svg>
  );
}

/* ─── Metric Input Card ─── */
interface MetricCardProps {
  label: string;
  icon: React.ReactNode;
  unit: string;
  inputId: string;
  placeholder: string;
  min: number;
  max: number;
  hasError: boolean;
  errorMessage?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registration: any;
  onChange: (val: number) => void;
  defaultValue?: number;
}

function MetricCard({
  label, icon, unit, inputId, placeholder, min, max,
  hasError, errorMessage, registration, onChange, defaultValue,
}: MetricCardProps) {
  return (
    <div
      className={`bg-[#151329] rounded-2xl p-4 sm:p-5 border transition-all ${
        hasError ? 'border-rose-500/60' : 'border-[#2d294d]'
      }`}
    >
      {/* Card header: icon + label */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] flex items-center justify-center shrink-0 shadow-md shadow-purple-900/50">
          {icon}
        </div>
        <span className="text-base sm:text-lg font-semibold text-white">{label}</span>
      </div>

      {/* Input with unit */}
      <div
        className={`flex items-center bg-[#0e0b20] border rounded-xl px-4 py-3 transition-all ${
          hasError
            ? 'border-rose-500 ring-1 ring-rose-500/30'
            : 'border-[#2d294d] focus-within:border-[#7c3aed] focus-within:ring-2 focus-within:ring-[#7c3aed]/25'
        }`}
      >
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          placeholder={placeholder}
          defaultValue={defaultValue}
          className="flex-1 bg-transparent border-0 p-0 text-white text-base sm:text-lg font-medium outline-none focus:ring-0 placeholder-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          {...registration}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            registration.onChange(e);
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) onChange(val);
          }}
        />
        <span className="text-sm font-semibold text-[#7c6aad] ml-2 select-none shrink-0">
          {unit}
        </span>
      </div>

      {/* Error message */}
      {hasError && errorMessage && (
        <p className="text-xs text-rose-400 mt-2 ml-1">{errorMessage}</p>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export function BodyInfoPage() {
  const navigate = useNavigate();
  const { setBody, data } = useSurvey();
  const [heightVal, setHeightVal] = useState<number>(data.body?.height ?? 170);
  const [weightVal, setWeightVal] = useState<number>(data.body?.weight ?? 65);

  useEffect(() => {
    document.title = 'CalisHealth · Survey – Body Information';
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<BodyFormValues>({
    resolver: zodResolver(bodySchema),
    defaultValues: {
      height: data.body?.height ?? 170,
      weight: data.body?.weight ?? 65,
    },
    mode: 'onChange',
  });

  const onSubmit = (values: BodyFormValues) => {
    setBody(values);
    // Navigate to next survey step (step 2 — placeholder path)
    navigate('/survey/goal');
  };

  return (
    <div className="min-h-screen bg-[#0a0918] bg-[radial-gradient(ellipse_70%_55%_at_50%_10%,#1a1040_0%,#0e0b20_55%,#070611_100%)] text-white flex flex-col antialiased selection:bg-fuchsia-500/30 selection:text-white">

      {/* ── Top safe area padding for mobile ── */}
      <div className="w-full px-4 sm:px-6 pt-safe-top pt-8 sm:pt-10 pb-4 sm:pb-6 flex justify-center">
        <div className="w-full max-w-[480px]">
          <SurveyProgressBar currentStep={1} totalSteps={4} />
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 w-full px-4 sm:px-6 pb-6 flex justify-center">
        <div className="w-full max-w-[480px] flex flex-col">

          {/* Section header */}
          <div className="mb-6 sm:mb-8">
            <p className="text-xs sm:text-sm font-semibold text-[#7c6aad] uppercase tracking-widest mb-1.5">
              Body information
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
              Your body stats
            </h1>
            <p className="text-sm sm:text-base text-[#a78bfa] mt-1.5 leading-relaxed">
              We'll use this to tailor your workout plan.
            </p>
          </div>

          {/* ── Input cards ── */}
          <form
            id="body-info-form"
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-4 sm:gap-5"
            noValidate
          >
            {/* Height */}
            <MetricCard
              label="Height"
              icon={<RulerIcon />}
              unit="cm"
              inputId="height"
              placeholder="170"
              min={50}
              max={300}
              defaultValue={heightVal}
              hasError={!!errors.height}
              errorMessage={errors.height?.message}
              registration={register('height', { valueAsNumber: true })}
              onChange={(v) => {
                setHeightVal(v);
                setValue('height', v, { shouldValidate: true });
              }}
            />

            {/* Weight */}
            <MetricCard
              label="Weight"
              icon={<ScaleIcon />}
              unit="kg"
              inputId="weight"
              placeholder="65"
              min={10}
              max={500}
              defaultValue={weightVal}
              hasError={!!errors.weight}
              errorMessage={errors.weight?.message}
              registration={register('weight', { valueAsNumber: true })}
              onChange={(v) => {
                setWeightVal(v);
                setValue('weight', v, { shouldValidate: true });
              }}
            />
          </form>

          {/* ── BMI preview (bonus) ── */}
          {heightVal > 0 && weightVal > 0 && (
            <div className="mt-4 rounded-xl bg-[#151329] border border-[#2d294d] px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-400">BMI estimate</span>
              <span className="text-sm font-semibold text-white">
                {(weightVal / Math.pow(heightVal / 100, 2)).toFixed(1)}
                <span className="text-[#7c6aad] text-xs font-normal ml-1.5">
                  {(() => {
                    const bmi = weightVal / Math.pow(heightVal / 100, 2);
                    if (bmi < 18.5) return '· Underweight';
                    if (bmi < 25) return '· Normal';
                    if (bmi < 30) return '· Overweight';
                    return '· Obese';
                  })()}
                </span>
              </span>
            </div>
          )}

          {/* ── Spacer to push button down on tall screens ── */}
          <div className="flex-1 min-h-6" />
        </div>
      </div>

      {/* ── Sticky footer: Continue button ── */}
      <div className="w-full px-4 sm:px-6 pb-safe-bottom pb-6 sm:pb-8 flex justify-center">
        <div className="w-full max-w-[480px]">
          <button
            type="submit"
            form="body-info-form"
            className="w-full h-12 sm:h-13 rounded-2xl font-semibold text-white text-base bg-gradient-to-r from-[#7c3aed] via-[#6d28d9] to-[#5b21b6] hover:from-[#8b5cf6] hover:via-[#7c3aed] hover:to-[#6d28d9] shadow-lg shadow-purple-900/50 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            <span>Continue</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
