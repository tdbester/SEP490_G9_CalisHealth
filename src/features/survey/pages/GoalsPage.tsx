import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  goalSchema,
  HEALTH_GOAL_VALUES,
  MOTIVATION_VALUES,
  SKILL_VALUES,
  type GoalFormValues,
  type HealthGoal,
  type Motivation,
  type Skill,
  type TrainPath,
} from '../schemas/goal.schema';
import { SurveyProgressBar } from '../components/SurveyProgressBar';
import { useSurvey } from '../context/SurveyContext';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════
Colors extracted from the Figma frames
  246:2   "Survey - Goals and motivation - Health" (800 x 900)
  246:162 "Survey - Goals and motivation - Skills" (800 x 900)
Header giả lập trình duyệt đã bỏ (xem BodyInfoPage).
═══════════════════════════════════════════════════════════════════════ */
const SURFACE = {
  pageFrom: '#0d071b',
  pageTo: '#0a0618',

  // Branch cards ("For health" / "For skills")
  cardIdle: '#141126',
  cardIdleBorder: '#27223c',
  cardActive: '#1c1836',
  cardActiveBorder: '#8b5cf6',
  cardIdleText: '#8b85a1',
  cardActiveText: '#ffffff',

  // Option rows (health goals / skills / motivations)
  rowIdle: '#121224',
  rowIdleBorder: '#232038',
  rowActive: '#171330',
  rowActiveBorder: '#6d28d9',
  rowIdleIcon: '#7c7593',
  rowActiveIcon: '#a78bfa',
  rowIdleText: '#d1d5db',
  rowActiveText: '#ffffff',
  rowIdleBadge: '#373051',
  rowActiveBadge: '#a78bfa',

  // Chips (motivation tags in the health branch)
  chipIdle: '#151029',
  chipIdleBorder: '#2f2850',
  chipActive: '#2d2358',
  chipActiveBorder: '#7c6cf0',

  label: '#9b8fc4',
  title: '#ffffff',
  muted: '#a3a0c4',

  cta: '#7c6cf0',
  ghost: '#151029',
  ghostBorder: '#3a3266',
  ghostText: '#e4e0f5',
  backIcon: '#c9c4e8',
} as const;

/* ─── Icons (inline SVG, matching the Figma vectors) ─────────────────── */

function HeartIcon() {
  return (
    <svg viewBox="0 0 43 39" fill="none" className="w-[38px] h-[34px]" aria-hidden="true">
      <path
        d="M21.5 34.5C21.5 34.5 3 23.5 3 11.5C3 6.7 6.8 3 11.5 3C14.6 3 17.4 4.5 18.9 6.7L21.5 10.5L24.1 6.7C25.6 4.5 28.4 3 31.5 3C36.2 3 40 6.7 40 11.5C40 23.5 21.5 34.5 21.5 34.5Z"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DumbbellIcon() {
  return (
    <svg viewBox="0 0 38 30" fill="none" className="w-[34px] h-[27px]" aria-hidden="true">
      <rect x="7" y="6" width="24" height="18" rx="9" stroke="currentColor" strokeWidth="2.6" />
      <rect x="1" y="3" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="2.6" />
      <rect x="1" y="17" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="2.6" />
      <rect x="31" y="3" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="2.6" />
      <rect x="31" y="17" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="2.6" />
    </svg>
  );
}

function FlatIcon() {
  return (
    <svg viewBox="0 0 24 25" fill="none" className="w-[22px] h-[23px]" aria-hidden="true">
      <path d="M3 18.5H21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8.5 18.5V15M15 18.5V15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8 15C11 7 13 4 15 3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function MuscleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-[22px] h-[22px]" aria-hidden="true">
      <path
        d="M7 9V6.5A1.5 1.5 0 0 1 8.5 5h7A1.5 1.5 0 0 1 17 6.5V9M7 15v2.5A1.5 1.5 0 0 0 8.5 19h7a1.5 1.5 0 0 0 1.5-1.5V15"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-[22px] h-[22px]" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}

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

/* ─── Branch card ("For health" / "For skills") ───────────────────────── */

interface PathCardProps {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
}

function PathCard({ label, icon, selected, onSelect }: PathCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'w-full h-[104px] rounded-xl border-[1.6px] flex flex-col items-center justify-center gap-2.5',
        'transition-all duration-200 cursor-pointer active:scale-[0.99]',
        selected ? 'scale-[1.015]' : 'hover:border-[#3a3358]'
      )}
      style={{
        background: selected ? SURFACE.cardActive : SURFACE.cardIdle,
        borderColor: selected ? SURFACE.cardActiveBorder : SURFACE.cardIdleBorder,
      }}
    >
      <span style={{ color: selected ? SURFACE.cardActiveBorder : SURFACE.cardIdleText }}>{icon}</span>
      <span
        className="text-[19px] font-bold"
        style={{ color: selected ? SURFACE.cardActiveText : SURFACE.cardIdleText }}
      >
        {label}
      </span>
    </button>
  );
}

/* ─── Option row (health goal / skill) ───────────────────────────────── */

interface OptionRowProps {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  multiple?: boolean;
  onToggle: () => void;
  error?: string;
}

function OptionRow({ label, icon, selected, multiple, onToggle, error }: OptionRowProps) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        className={cn(
          'w-full h-[58px] rounded-[10px] border-[1.5px] flex items-center gap-3.5 px-5',
          'transition-all duration-200 cursor-pointer active:scale-[0.99]'
        )}
        style={{
          background: selected ? SURFACE.rowActive : SURFACE.rowIdle,
          borderColor: selected ? SURFACE.rowActiveBorder : SURFACE.rowIdleBorder,
        }}
      >
        <span
          className="w-6 flex items-center justify-center shrink-0"
          style={{ color: selected ? SURFACE.rowActiveIcon : SURFACE.rowIdleIcon }}
        >
          {icon}
        </span>
        <span
          className="flex-1 text-left text-[17px] font-medium"
          style={{ color: selected ? SURFACE.rowActiveText : SURFACE.rowIdleText }}
        >
          {label}
        </span>
        {multiple && (
          <span
            className="w-[19px] h-[20px] rounded-[5px] border-[2px] flex items-center justify-center shrink-0"
            style={{
              borderColor: selected ? SURFACE.rowActiveBadge : SURFACE.rowIdleBadge,
              background: selected ? SURFACE.rowActiveBadge : 'transparent',
            }}
          >
            {selected && (
              <svg viewBox="0 0 12 10" fill="none" className="w-[11px] h-[9px]" aria-hidden="true">
                <path
                  d="M1 5L4.5 8.5L11 1.5"
                  stroke="#0d071b"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
        )}
      </button>

      {error && <p className="text-xs text-rose-400 mt-1.5 ml-1">{error}</p>}
    </div>
  );
}

/* ─── Motivation chips (health branch) ───────────────────────────────── */

interface ChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
}

function Chip({ label, selected, onToggle }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        'h-[38px] px-5 rounded-lg border-[1.5px] text-[16px] font-medium transition-all duration-200',
        'cursor-pointer active:scale-[0.97]'
      )}
      style={{
        background: selected ? SURFACE.chipActive : SURFACE.chipIdle,
        borderColor: selected ? SURFACE.chipActiveBorder : SURFACE.chipIdleBorder,
        color: selected ? '#e5e1f5' : SURFACE.muted,
      }}
    >
      {label}
    </button>
  );
}

/* ─── Static option definitions ───────────────────────────────────────── */

const HEALTH_GOAL_META: Record<HealthGoal, { label: string; icon: React.ReactNode }> = {
  lose_weight: { label: 'Lose weight', icon: <TargetIcon /> },
  build_muscle: { label: 'Build muscle', icon: <MuscleIcon /> },
  stay_fit: { label: 'Stay fit', icon: <FlatIcon /> },
};

const SKILL_META: Record<Skill, string> = {
  muscle_up: 'Muscle-up',
  handstand: 'Handstand',
  front_lever: 'Front lever',
  planche: 'Planche',
  human_flag: 'Human flag',
  l_sit: 'L-sit',
};

const MOTIVATION_META: Record<Motivation, string> = {
  health: 'Health',
  appearance: 'Appearance',
  energy: 'Energy',
  stress_relief: 'Stress relief',
  confidence: 'Confidence',
};

/* ─── Main Page ─── */
export function GoalsPage() {
  const navigate = useNavigate();
  const { setGoals, data } = useSurvey();

  const {
    control,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      path: data.goals?.path ?? '',
      healthGoal: data.goals?.healthGoal ?? '',
      skills: data.goals?.skills ?? [],
      motivations: data.goals?.motivations ?? [],
    },
    mode: 'onChange',
  });

  // The selected branch decides which section renders.
  const path = watch('path');

  useEffect(() => {
    document.title = 'CalisHealth · Survey – Goals and motivation';
  }, []);

  const onSubmit = (values: GoalFormValues) => {
    setGoals({
      path: values.path as TrainPath,
      healthGoal: values.healthGoal as HealthGoal | '',
      skills: values.skills,
      motivations: values.motivations,
    });
    // Step 3 (current training routine) continues the flow.
    navigate('/survey/current-training-routine');
  };

  const toggleInArray = <T extends string>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

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
        <div className="w-full max-w-[584px]">
          <SurveyProgressBar currentStep={2} totalSteps={4} />

          {/* Section header */}
          <div className="mt-6">
            <p className="text-xl font-medium leading-[1.18]" style={{ color: SURFACE.label }}>
              Goals and motivation
            </p>
            <h1 className="text-[34px] font-bold text-white leading-[1.24] tracking-tight mt-px">
              Why do you train?
            </h1>
            <p className="text-lg leading-[1.37] mt-1.5" style={{ color: SURFACE.muted }}>
              Pick the path that fits you best.
            </p>
          </div>

          <Controller
            name="path"
            control={control}
            render={({ field }) => (
              <>
                {/* ── Branch: For health / For skills ────────────────── */}
                <div className="grid grid-cols-2 gap-4 mt-7">
                  <PathCard
                    label="For health"
                    icon={<HeartIcon />}
                    selected={field.value === 'health'}
                    onSelect={() => field.onChange('health')}
                  />
                  <PathCard
                    label="For skills"
                    icon={<DumbbellIcon />}
                    selected={field.value === 'skills'}
                    onSelect={() => field.onChange('skills')}
                  />
                </div>

                {typeof errors.path?.message === 'string' && (
                  <p className="text-xs text-rose-400 mt-2">{errors.path.message}</p>
                )}

                {/* ── Health branch ──────────────────────────────────── */}
                {path === 'health' && (
                  <>
                    <div className="mt-8">
                      <h2 className="text-[20px] font-bold text-white mb-3.5">What's your health goal?</h2>

                      <Controller
                        name="healthGoal"
                        control={control}
                        render={({ field }) => (
                          <div className="flex flex-col gap-3">
                            {HEALTH_GOAL_VALUES.map((goal) => (
                              <OptionRow
                                key={goal}
                                label={HEALTH_GOAL_META[goal].label}
                                icon={HEALTH_GOAL_META[goal].icon}
                                selected={field.value === goal}
                                onToggle={() => field.onChange(goal)}
                                error={
                                  field.value === HEALTH_GOAL_VALUES[0]
                                    ? errors.healthGoal?.message
                                    : undefined
                                }
                              />
                            ))}
                          </div>
                        )}
                      />
                    </div>

                    <div className="mt-8">
                      <h2 className="text-[20px] font-bold text-white mb-3.5">What motivates you?</h2>

                      <Controller
                        name="motivations"
                        control={control}
                        render={({ field }) => (
                          <>
                            <div className="flex flex-wrap gap-3">
                              {MOTIVATION_VALUES.map((m) => (
                                <Chip
                                  key={m}
                                  label={MOTIVATION_META[m]}
                                  selected={field.value.includes(m)}
                                  onToggle={() => field.onChange(toggleInArray(field.value, m))}
                                />
                              ))}
                            </div>

                            {errors.motivations?.message && (
                              <p className="text-xs text-rose-400 mt-2.5 ml-1">
                                {errors.motivations.message}
                              </p>
                            )}
                          </>
                        )}
                      />
                    </div>
                  </>
                )}

                {/* ── Skills branch ──────────────────────────────────── */}
                {path === 'skills' && (
                  <>
                    <div className="mt-8">
                      <h2 className="text-[20px] font-bold text-white mb-3.5">
                        Which skills do you want to learn?
                      </h2>

                      <Controller
                        name="skills"
                        control={control}
                        render={({ field }) => (
                          <>
                            <div className="flex flex-wrap gap-3">
                              {SKILL_VALUES.map((skill) => (
                                <button
                                  key={skill}
                                  type="button"
                                  onClick={() => field.onChange(toggleInArray(field.value, skill))}
                                  aria-pressed={field.value.includes(skill)}
                                  className={cn(
                                    'h-[38px] px-4 rounded-lg border-[1.5px] text-[16px] font-medium transition-all duration-200',
                                    'cursor-pointer active:scale-[0.97]'
                                  )}
                                  style={{
                                    background: field.value.includes(skill)
                                      ? SURFACE.chipActive
                                      : SURFACE.chipIdle,
                                    borderColor: field.value.includes(skill)
                                      ? SURFACE.chipActiveBorder
                                      : SURFACE.chipIdleBorder,
                                    color: field.value.includes(skill) ? '#ffffff' : SURFACE.muted,
                                  }}
                                >
                                  {SKILL_META[skill]}
                                </button>
                              ))}
                            </div>

                            {errors.skills?.message && (
                              <p className="text-xs text-rose-400 mt-2.5 ml-1">
                                {errors.skills.message}
                              </p>
                            )}
                          </>
                        )}
                      />
                    </div>

                    <div className="mt-8">
                      <h2 className="text-[20px] font-bold text-white mb-3.5">What motivates you?</h2>

                      <Controller
                        name="motivations"
                        control={control}
                        render={({ field }) => (
                          <>
                            <div className="flex flex-wrap gap-3">
                              {MOTIVATION_VALUES.map((m) => (
                                <Chip
                                  key={m}
                                  label={MOTIVATION_META[m]}
                                  selected={field.value.includes(m)}
                                  onToggle={() => field.onChange(toggleInArray(field.value, m))}
                                />
                              ))}
                            </div>

                            {errors.motivations?.message && (
                              <p className="text-xs text-rose-400 mt-2.5 ml-1">
                                {errors.motivations.message}
                              </p>
                            )}
                          </>
                        )}
                      />
                    </div>
                  </>
                )}
              </>
            )}
          />
        </div>
      </div>

      {/* ── Sticky action bar ─────────────────────────────────────── */}
      <div className="sticky bottom-0 w-full px-4 sm:px-6 pb-6 pt-2">
        <div className="mx-auto w-full max-w-[584px] flex gap-4">
          <button
            type="button"
            onClick={() => navigate('/survey/body-information')}
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
              className="w-full h-[50px] rounded-lg font-medium text-[17px] text-white flex items-center justify-center gap-2.5 cursor-pointer transition-opacity active:scale-[0.99] hover:opacity-90"
              style={{ background: SURFACE.cta }}
            >
              <span>Continue</span>
              <ArrowRight />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}