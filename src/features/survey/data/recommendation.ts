import type { LevelTestInfo, TrainingInfo } from '../context/SurveyContext';

/* ═══════════════════════════════════════════════════════════════════════
Level + plan derivation for the "Survey - Result and recommended plan"
screen (Figma frame 259:393, 800 x 900).

Backend chưa sẵn sàng nên toàn bộ nội dung ở đây là dữ liệu mẫu chạy
client-side. Khi API có plan thật, chỉ cần thay `buildRecommendation`
bằng call server — phần render không đổi.
════════════════════════════════════════════════════════════════════════ */

export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';

export const LEVEL_ORDER: readonly FitnessLevel[] = ['beginner', 'intermediate', 'advanced'];

export const LEVEL_LABELS: Record<FitnessLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

/* ─── Sample results ───────────────────────────────────────────────────
Đúng con số trên Figma (259:443 / 259:448 / 259:455):
  Push-up 8 reps · Squat 20 reps · Plank 35 sec
Dùng làm fallback khi người dùng chưa điền bước level test.
───────────────────────────────────────────────────────────────────────── */
export const SAMPLE_RESULTS: LevelTestInfo = { pushUp: 8, squat: 20, plank: 35 };

/**
 * Một "điểm tổng hợp" từ 3 phép đo. Trọng số phản ánh tầm quan trọng:
 * squat đòi hỏi sức nhiều nhất, plank tính theo giây nên chia cho 5.
 * Ngưỡng chọn để mẫu (8 / 20 / 35) rơi vào "beginner" như Figma.
 */
function levelFromScore(score: number): FitnessLevel {
  if (score < 90) return 'beginner';
  if (score < 220) return 'intermediate';
  return 'advanced';
}

export function scoreLevel(results: LevelTestInfo): FitnessLevel {
  const { pushUp, squat, plank } = results;
  return levelFromScore(pushUp + squat * 2 + plank / 5);
}

/* ─── Plan catalogue ──────────────────────────────────────────────────── */

export interface PlanMeta {
  /** Ví dụ: "4 weeks" */
  weeks: string;
  /** Ví dụ: "3 sessions / week" */
  sessions: string;
  /** Ví dụ: "25-35 min / session" */
  duration: string;
}

export interface SessionSlot {
  /** "MON" | "WED" | … */
  day: string;
  /** "Full body A" */
  name: string;
}

export interface Plan {
  name: string;
  description: string;
  meta: PlanMeta;
  rhythm: readonly SessionSlot[];
  note: string;
}

/**
 * Mô tả cột mốc cho từng level, đọc lại từ Figma cho nhánh Beginner
 * (259:460, 259:461, 259:469–471, 259:475–482, 259:483).
 * Hai nhánh còn lại viết theo cùng giọng để demo nhất quán.
 */
export const PLAN_CATALOGUE: Record<FitnessLevel, Plan> = {
  beginner: {
    name: 'Foundation Builder',
    description:
      'Build the basics with approachable progressions for your push-ups, squats and core strength.',
    meta: { weeks: '4 weeks', sessions: '3 sessions / week', duration: '25-35 min / session' },
    rhythm: [
      { day: 'MON', name: 'Full body A' },
      { day: 'WED', name: 'Full body B' },
      { day: 'FRI', name: 'Full body A' },
    ],
    note: 'Rest between sessions. Start with easier variations and progress at your pace.',
  },
  intermediate: {
    name: 'Strength Progression',
    description:
      'Add load and volume across your main lifts while keeping your squat and push-up patterns sharp.',
    meta: { weeks: '6 weeks', sessions: '4 sessions / week', duration: '35-45 min / session' },
    rhythm: [
      { day: 'MON', name: 'Push focus' },
      { day: 'TUE', name: 'Leg focus' },
      { day: 'THU', name: 'Pull focus' },
      { day: 'SAT', name: 'Full body A' },
    ],
    note: 'Add a little weight each week. Keep two reps in reserve on every set.',
  },
  advanced: {
    name: 'Performance Peak',
    description:
      'Train for strength and power with heavier loads, denser work and deliberate accessory work.',
    meta: { weeks: '8 weeks', sessions: '5 sessions / week', duration: '45-60 min / session' },
    rhythm: [
      { day: 'MON', name: 'Push heavy' },
      { day: 'TUE', name: 'Pull heavy' },
      { day: 'WED', name: 'Legs heavy' },
      { day: 'FRI', name: 'Upper power' },
      { day: 'SAT', name: 'Full body A' },
    ],
    note: 'Prioritise quality reps. Deload in the final week of each block.',
  },
};

/** Blurb hiển thị cạnh level hiện tại (259:430–259:431). */
export const LEVEL_BLURBS: Record<FitnessLevel, string> = {
  beginner:
    "You're ready to build your foundation. Focus on controlled reps, full-body strength and a consistent routine.",
  intermediate:
    'You have a solid base. Time to add progressive overload and train your weaker patterns with intent.',
  advanced:
    'You train with confidence. Push intensity, structure your volume and keep advancing your numbers.',
};

/* ─── Weekly rhythm built from what the user actually answered ─────────── */

/**
 * Nếu người dùng đã chọn ở bước 3 (training), lịch tuần và thời lượng
 * bám theo câu trả lời đó; không có thì lấy rhythm mặc định của plan.
 * `rhythm` trong catalogue có sẵn 3–5 slot, nên ta cắt theo số ngày.
 */
const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

/** Sắp các slot của plan theo thứ tự ngày rồi cắt đúng số ngày đã chọn. */
function rhythmForDays(plan: Plan, daysPerWeek: number): SessionSlot[] {
  const byDay = new Map<string, number>(DAY_LABELS.map((d, i) => [d, i]));
  const sorted = [...plan.rhythm].sort(
    (a, b) => (byDay.get(a.day) ?? 0) - (byDay.get(b.day) ?? 0)
  );

  const count = Math.min(Math.max(daysPerWeek, 1), DAY_LABELS.length);
  const out: SessionSlot[] = [];
  for (let i = 0; i < count; i += 1) {
    const template = sorted[i % sorted.length];
    const day = DAY_LABELS[i];
    out.push({ day, name: template.name });
  }
  return out;
}

/** "30" → "25-35 min / session", "60" → "50-60 min / session". */
function durationLabel(minutes: number): string {
  return `${Math.max(15, minutes - 5)}-${minutes} min / session`;
}

/* ─── Public API ──────────────────────────────────────────────────────── */

export interface Recommendation {
  level: FitnessLevel;
  /** 1-based, dùng cho badge "Level 1 of 3" */
  levelNumber: number;
  totalLevels: number;
  blurb: string;
  plan: Plan;
  results: LevelTestInfo;
}

export function buildRecommendation(
  levelTest: LevelTestInfo | undefined,
  training: TrainingInfo | undefined
): Recommendation {
  const results = levelTest ?? SAMPLE_RESULTS;
  const level = scoreLevel(results);
  const base = PLAN_CATALOGUE[level];

  const plan: Plan = training
    ? {
        ...base,
        meta: {
          ...base.meta,
          sessions: `${training.daysPerWeek} sessions / week`,
          duration: durationLabel(training.sessionMinutes),
        },
        rhythm: rhythmForDays(base, training.daysPerWeek),
      }
    : base;

  return {
    level,
    levelNumber: LEVEL_ORDER.indexOf(level) + 1,
    totalLevels: LEVEL_ORDER.length,
    blurb: LEVEL_BLURBS[level],
    plan,
    results,
  };
}