const LEVEL_BADGE_STYLES = {
  BEGINNER: "!uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  INTERMEDIATE: "!uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20",
  ADVANCED: "!uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20",
  EXPERT: "!uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20",
};

export function getLevelBadgeStyle(level) {
  const normalizedLevel = String(level || "").trim().toUpperCase();
  return LEVEL_BADGE_STYLES[normalizedLevel] || LEVEL_BADGE_STYLES.INTERMEDIATE;
}
