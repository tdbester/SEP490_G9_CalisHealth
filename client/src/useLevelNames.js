import { useCallback, useMemo } from "react";
import { contentManagerApi } from "./api/contentManager";
import { useApiQuery } from "./hooks";

// Easiest level -> hardest level. With 3 levels this gives green / amber / red.
const GRADIENT_TONES = ["success", "sky", "warning", "orange", "danger"];
// Only used once there are more levels than the gradient has colours.
const EXTRA_TONES = ["primary", "pink", "teal"];

/**
 * Gives every level its own colour from its position (ordered by score range). Up to 8 levels never share a
 * colour; after that the palette repeats. Inactive levels keep their slot, so toggling a status does not
 * recolour the others.
 */
export function buildLevelToneMap(orderedNames) {
  const count = orderedNames.length;
  const map = new Map();
  orderedNames.forEach((name, index) => {
    const tone = count <= GRADIENT_TONES.length
      ? GRADIENT_TONES[count === 1 ? 0 : Math.round((index * (GRADIENT_TONES.length - 1)) / (count - 1))]
      : [...GRADIENT_TONES, ...EXTRA_TONES][index % (GRADIENT_TONES.length + EXTRA_TONES.length)];
    map.set(String(name).trim().toLowerCase(), tone);
  });
  return map;
}

/**
 * Names of every level configured in Level & Benchmark Criteria (including levels created later),
 * ordered by score range. Levels are the single source of truth, so exercise and workout forms
 * must not hard-code Beginner / Intermediate / Advanced.
 *
 * `levels` has every level; `activeLevels` only the ones whose status is Active. Inactive levels cannot
 * receive new exercises, so create forms offer `activeLevels`. `levelTone(name)` returns the pill tone
 * for a level name.
 */
export function useLevelNames() {
  const { data, isLoading } = useApiQuery(() => contentManagerApi.levelBenchmarkConfiguration());
  const { levels, activeLevels, toneMap } = useMemo(() => {
    const ordered = [...(data?.levels || [])].sort((a, b) => a.scoreMin - b.scoreMin);
    const nameOf = (level) => level.name || level.level;
    const names = ordered.map(nameOf).filter(Boolean);
    return {
      levels: names,
      activeLevels: ordered.filter((level) => level.status === "ACTIVE").map(nameOf).filter(Boolean),
      toneMap: buildLevelToneMap(names),
    };
  }, [data]);
  const levelTone = useCallback(
    (name) => toneMap.get(String(name || "").trim().toLowerCase()) ?? "neutral",
    [toneMap],
  );
  return { levels, activeLevels, levelTone, isLoadingLevels: isLoading };
}
