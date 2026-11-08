/**
 * Màu badge của level.
 *
 * Level do Content Manager cấu hình động trong Level & Benchmark Criteria nên không thể hard-code
 * đủ tên level. Bảng màu dưới đây chỉ là mặc định cho các level mặc định của hệ thống; level mới
 * dùng màu trung tính thay vì bị gán nhầm màu của level khác.
 */
const LEVEL_BADGE_STYLES = {
  BEGINNER: "!uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  INTERMEDIATE: "!uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20",
  ADVANCED: "!uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20",
  EXPERT: "!uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20",
};

const NEUTRAL_BADGE_STYLE =
  "!uppercase bg-slate-500/10 text-slate-300 border border-slate-500/20";

export function getLevelBadgeStyle(level) {
  const normalizedLevel = String(level || "").trim().toUpperCase();
  return LEVEL_BADGE_STYLES[normalizedLevel] || NEUTRAL_BADGE_STYLE;
}
