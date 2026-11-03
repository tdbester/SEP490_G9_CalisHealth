import personIcon from "../../assets/survey/icon-person.svg";
import calendarIcon from "../../assets/survey/icon-calendar.svg";
import rulerIcon from "../../assets/survey/icon-ruler.svg";
import weightIcon from "../../assets/survey/icon-weight.svg";
import arrowUpIcon from "../../assets/survey/icon-arrow-up.svg";
import arrowDownIcon from "../../assets/survey/icon-arrow-down.svg";
import clockIcon from "../../assets/survey/icon-clock.svg";
import heartIcon from "../../assets/survey/icon-heart.svg";
import trophyIcon from "../../assets/survey/icon-trophy.svg";
import chevronDownIcon from "../../assets/survey/icon-chevron-down.svg";
import arrowLeftIcon from "../../assets/survey/icon-arrow-left.svg";
import arrowRightIcon from "../../assets/survey/icon-arrow-right.svg";
import arrowRightLargeIcon from "../../assets/survey/icon-arrow-right-lg.svg";

/*
 * Icon của các màn survey. Icon có trong Figma (CalisHealth > PC screen) được tải về assets/survey
 * và dùng nguyên bản; icon của các frame không có vector riêng (hàng mục tiêu sức khỏe, màn Result)
 * vẽ inline theo đúng nét của code giao diện trước đó.
 */

/** Icon theo display_config.icon / optionIcons (tên do content manager cấu hình). */
const FIGMA_ICONS = {
  person: personIcon,
  calendar: calendarIcon,
  ruler: rulerIcon,
  weight: weightIcon,
  arrowUp: arrowUpIcon,
  arrowDown: arrowDownIcon,
  clock: clockIcon,
  heart: heartIcon,
  trophy: trophyIcon,
};

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}

function MuscleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <path
        d="M7 9V6.5A1.5 1.5 0 0 1 8.5 5h7A1.5 1.5 0 0 1 17 6.5V9M7 15v2.5A1.5 1.5 0 0 0 8.5 19h7a1.5 1.5 0 0 0 1.5-1.5V15"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg viewBox="0 0 24 25" width="22" height="23" fill="none" aria-hidden="true">
      <path d="M3 18.5H21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8.5 18.5V15M15 18.5V15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8 15C11 7 13 4 15 3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

const INLINE_ICONS = { target: TargetIcon, muscle: MuscleIcon, pulse: PulseIcon };

/** Icon theo tên cấu hình; tên lạ -> không vẽ gì. */
export function SurveyIcon({ name }) {
  if (FIGMA_ICONS[name]) return <img src={FIGMA_ICONS[name]} alt="" aria-hidden="true" />;
  const Inline = INLINE_ICONS[name];
  return Inline ? <Inline /> : null;
}

export const ChevronDown = () => <img src={chevronDownIcon} alt="" aria-hidden="true" />;
export const ArrowLeft = () => <img src={arrowLeftIcon} alt="" aria-hidden="true" />;
export const ArrowRight = () => <img src={arrowRightIcon} alt="" aria-hidden="true" />;
export const ArrowRightLarge = () => <img src={arrowRightLargeIcon} alt="" aria-hidden="true" />;

/* ─── Màn Result ─── */

export function MedalIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
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

export function SparkleIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M8 1.5L9.6 6.4L14.5 8L9.6 9.6L8 14.5L6.4 9.6L1.5 8L6.4 6.4L8 1.5Z" fill="currentColor" />
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
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

export function DumbbellGlyph() {
  return (
    <svg viewBox="0 0 40 24" width="30" height="12" fill="none" aria-hidden="true">
      <rect x="1" y="8" width="5" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="7" y="4" width="7" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M14 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="26" y="4" width="7" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="34" y="8" width="5" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
