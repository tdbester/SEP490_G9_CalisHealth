import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import type { Recommendation } from '../data/recommendation';
import {
  WEEKDAY_INITIALS,
  WEEKDAY_NAMES,
  buildMonthCalendar,
  defaultSelectedDay,
  findDay,
  scheduleNote,
  sessionForWeekday,
} from '../data/planCalendar';

/* ═══════════════════════════════════════════════════════════════════════
Popup "Preview training plan" — lịch tháng 30 ngày (Figma frame 261:698,
1033 x 820). Bấm "Preview training plan" ở màn Result mở popup này; bấm
Close (hoặc Esc, hoặc click nền) quay lại đúng màn Result.

Màu ở dưới lấy thẳng từ Figma. Lưu ý Figma dùng số tối cho ngày CÓ
buổi tập và số sáng hơn cho ngày nghỉ — ngược với trực giác.
═════════════════════════════════════════════════════════════════════════ */

const SURFACE = {
  /* Nền popup và vùng nội dung */
  dialog: '#0F0C1B',
  content: '#131023',
  contentBorder: '#251F3D',

  /* Nội dung lịch */
  title: '#FFFFFF',
  sub: '#7A7399',
  weekday: '#7A7399',

  /* Ô ngày */
  restBorder: '#2D2650',
  restNum: '#58507E',
  sessionNum: '#3F3861',
  activeFill: '#2D2350',
  activeBorder: '#5D4B9B',
  activeNum: '#A493E6',

  /* Panel ngày được chọn */
  detail: '#7A7399',
  durationBg: '#201A35',
  durationText: '#9C96C0',

  /* Card bài tập */
  card: '#181330',
  cardBorder: '#292244',
  iconTile: '#261F43',
  icon: '#9D93CD',
  exercise: '#FFFFFF',
  exerciseDetail: '#7A7399',

  /* Nút Close dạng chữ */
  closeText: '#4A4369',
} as const;

/* ─── Icons ─────────────────────────────────────────────────────────── */

/** Dumbbell trong ô xanh của card bài tập. */
function ExerciseGlyph() {
  return (
    <svg viewBox="0 0 40 24" fill="none" aria-hidden="true" className="w-[30px] h-[12px]">
      <rect x="1" y="8" width="5" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="7" y="4" width="7" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M14 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="26" y="4" width="7" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="34" y="8" width="5" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/* ─── Bài tập của mỗi slot ──────────────────────────────────────────── */

interface Exercise {
  name: string;
  detail: string;
}

/**
 * Bài tập theo tên slot. Catalogue hiện chỉ đặt "Full body A" là mẫu thật
 * (đúng 261:781–801) nên các slot còn lại viết theo cùng giọng để demo
 * nhất quán; mọi slot đều có 3 bài để layout khớp Figma.
 */
const SLOT_EXERCISES: Record<string, readonly Exercise[]> = {
  'Full body A': [
    { name: 'Push-up', detail: '3 sets • 5–6 reps • controlled tempo' },
    { name: 'Squat', detail: '3 sets • 12 reps • full range of motion' },
    { name: 'Plank', detail: '3 sets • 20–25 sec • stable core hold' },
  ],
  'Full body B': [
    { name: 'Push-up', detail: '3 sets • 8–10 reps • controlled tempo' },
    { name: 'Squat', detail: '3 sets • 15 reps • full range of motion' },
    { name: 'Plank', detail: '3 sets • 30 sec • stable core hold' },
  ],
  'Push focus': [
    { name: 'Push-up', detail: '4 sets • 6–8 reps • controlled tempo' },
    { name: 'Incline push-up', detail: '3 sets • 10 reps • full range of motion' },
    { name: 'Plank', detail: '3 sets • 25 sec • stable core hold' },
  ],
  'Leg focus': [
    { name: 'Squat', detail: '4 sets • 10–12 reps • full range of motion' },
    { name: 'Lunge', detail: '3 sets • 10 reps / leg • controlled tempo' },
    { name: 'Calf raise', detail: '3 sets • 15 reps • controlled tempo' },
  ],
  'Pull focus': [
    { name: 'Row', detail: '4 sets • 8–10 reps • controlled tempo' },
    { name: 'Dead hang', detail: '3 sets • 20–25 sec • stable core hold' },
    { name: 'Plank', detail: '3 sets • 25 sec • stable core hold' },
  ],
  'Upper power': [
    { name: 'Push-up', detail: '5 sets • 5 reps • explosive tempo' },
    { name: 'Row', detail: '4 sets • 6 reps • controlled tempo' },
    { name: 'Plank', detail: '3 sets • 30 sec • stable core hold' },
  ],
};

const DEFAULT_EXERCISES: readonly Exercise[] = SLOT_EXERCISES['Full body A'];

function exercisesFor(slotName: string | undefined): readonly Exercise[] {
  if (!slotName) return [];
  return SLOT_EXERCISES[slotName] ?? DEFAULT_EXERCISES;
}

/** "25-35 min / session" → "25–35 min", dùng cho chip thời lượng. */
function shortDuration(duration: string): string {
  return duration.split('/')[0].trim().replace('-', '–');
}

/* ─── Ô lịch ────────────────────────────────────────────────────────── */

interface DayTileProps {
  day: number;
  isActive: boolean;
  hasSession: boolean;
  onSelect: () => void;
}

/**
 * Ô một ngày. Ngày có buổi tập không có viền và dùng số tối; ngày nghỉ
 * có viền và số sáng hơn; ngày đang chọn có nền tím.
 */
function DayTile({ day, isActive, hasSession, onSelect }: DayTileProps) {
  const color = isActive
    ? SURFACE.activeNum
    : hasSession
      ? SURFACE.sessionNum
      : SURFACE.restNum;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Day ${day}`}
      aria-pressed={isActive}
      className="h-[39px] w-full flex items-center justify-center rounded-md border text-[16px] font-semibold cursor-pointer transition-colors"
      style={{
        background: isActive ? SURFACE.activeFill : 'transparent',
        borderColor: isActive ? SURFACE.activeBorder : hasSession ? 'transparent' : SURFACE.restBorder,
        color,
      }}
    >
      {day}
    </button>
  );
}

/* ─── Popup ─────────────────────────────────────────────────────────── */

interface TrainingPlanPreviewModalProps {
  open: boolean;
  onClose: () => void;
  recommendation: Recommendation;
}

/**
 * Nội dung popup: lịch tháng + chi tiết ngày đang chọn. Đóng popup chỉ
 * trả về màn hình Result (không điều hướng đi nơi khác).
 */
export function TrainingPlanPreviewModal({
  open,
  onClose,
  recommendation,
}: TrainingPlanPreviewModalProps) {
  const { plan } = recommendation;
  const calendar = useMemo(() => buildMonthCalendar(plan), [plan]);
  const [selectedDay, setSelectedDay] = useState(() => defaultSelectedDay(calendar));

  // Mỗi lần mở lại popup thì quay về ngày mặc định (ngày có buổi tập
  // đầu tiên từ giữa tháng trở đi) đúng như Figma.
  useEffect(() => {
    if (open) setSelectedDay(defaultSelectedDay(calendar));
  }, [open, calendar]);

  const selected = findDay(calendar, selectedDay);
  const slot = selected?.hasSession ? sessionForWeekday(plan, selected.weekday) : undefined;
  const exercises = exercisesFor(slot?.name);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex flex-col gap-1">
          <span className="text-[28px] font-bold leading-tight">Preview training plan</span>
          <span className="text-[15px] font-normal" style={{ color: SURFACE.sub }}>
            30-day month view for the {plan.name} program
          </span>
        </span>
      }
      headerRight={
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 cursor-pointer text-[15px] font-medium bg-transparent border-0 p-0 transition-opacity hover:opacity-75"
          style={{ color: SURFACE.closeText }}
        >
          Close
        </button>
      }
      panelClassName="max-w-[980px] rounded-xl"
      panelStyle={{ background: SURFACE.dialog, color: SURFACE.title }}
      lang="en"
    >
      <div
        className="mx-auto w-full max-w-[880px] rounded-2xl px-6 py-6 sm:px-[76px] sm:py-7"
        style={{ background: SURFACE.content, border: `1px solid ${SURFACE.contentBorder}` }}
      >
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* ── Cột trái: lịch tháng ─────────────────────────────── */}
          <section className="min-w-0 flex-1">
            <h3 className="text-[19px] font-bold leading-tight">Month calendar</h3>
            <p className="mt-1.5 text-[15px]" style={{ color: SURFACE.sub }}>
              {calendar.label}
            </p>

            <div className="mt-5 mb-2 grid grid-cols-7 gap-2">
              {WEEKDAY_INITIALS.map((initial, i) => (
                <span
                  key={`${initial}-${i}`}
                  className="text-center text-[14px] font-semibold"
                  style={{ color: SURFACE.weekday }}
                >
                  {initial}
                </span>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              {calendar.weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-cols-7 gap-2">
                  {week.map((cell, dayIndex) =>
                    cell === null ? (
                      <span key={dayIndex} className="h-[39px]" />
                    ) : (
                      <DayTile
                        key={cell.day}
                        day={cell.day}
                        isActive={cell.day === selectedDay}
                        hasSession={cell.hasSession}
                        onSelect={() => setSelectedDay(cell.day)}
                      />
                    ),
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── Cột phải: chi tiết ngày được chọn ─────────────────── */}
          <section className="w-full shrink-0 lg:w-[380px]">
            <h3 className="text-[19px] font-bold leading-tight">Selected day</h3>
            <p className="mt-1.5 text-[15px]" style={{ color: SURFACE.sub }}>
              {selected
                ? `${WEEKDAY_NAMES[selected.weekday]}, ${calendar.monthName} ${selected.day} • ${
                    slot?.name ?? 'Recovery day'
                  }`
                : '\u00a0'}
            </p>

            {slot && (
              <p
                className="mt-5 inline-flex items-center rounded-full px-4 py-1.5 text-[14px]"
                style={{ background: SURFACE.durationBg, color: SURFACE.durationText }}
              >
                {shortDuration(plan.meta.duration)}
              </p>
            )}

            <ul className="mt-4 flex flex-col gap-3">
              {exercises.map((exercise) => (
                <li
                  key={exercise.name}
                  className="flex items-center gap-4 rounded-lg border px-4 py-3"
                  style={{ background: SURFACE.card, borderColor: SURFACE.cardBorder, height: 70 }}
                >
                  <span
                    className="flex h-[46px] w-[64px] shrink-0 items-center justify-center rounded-lg"
                    style={{ background: SURFACE.iconTile, color: SURFACE.icon }}
                  >
                    <ExerciseGlyph />
                  </span>
                  <div className="min-w-0">
                    <p
                      className="text-[17px] font-semibold leading-tight"
                      style={{ color: SURFACE.exercise }}
                    >
                      {exercise.name}
                    </p>
                    <p
                      className="mt-1 text-[14px] leading-snug"
                      style={{ color: SURFACE.exerciseDetail }}
                    >
                      {exercise.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-6 text-[14px] leading-relaxed" style={{ color: SURFACE.sub }}>
              {scheduleNote(calendar)}
            </p>
          </section>
        </div>
      </div>
    </Modal>
  );
}