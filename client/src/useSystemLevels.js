import { useCallback, useMemo } from "react";
import { getFitnessLevels } from "./api/library";
import { useApiQuery } from "./hooks";

/**
 * Level của hệ thống, lấy động từ bảng `fitness_levels`.
 *
 * Level do Content Manager tạo / đổi tên trong Level & Benchmark Criteria nên client không
 * được hard-code Beginner / Intermediate / Advanced: level mới phải hiện ngay trong dropdown
 * mà không cần sửa code.
 *
 * - `levels`: mọi level, sắp theo score_min (dễ -> khó).
 * - `activeLevels`: level đang ACTIVE. Level INACTIVE không nhận bài tập/workout mới nên form
 *   tạo mới chỉ chọn trong nhóm này.
 * - `levelOptions`: object đầy đủ `{ id, name, scoreMin, scoreMax, status }` — dùng khi API
 *   cần **id** của level (ví dụ leaderboard lọc theo `fitness_levels.id`).
 * - `levelLabel(name)`: nhãn hiển thị của một level (giữ nguyên tên do Content Manager đặt).
 * - `levelIdOf(name)`: id của level theo tên, `null` nếu không tìm thấy.
 * - `levelPriority(name)`: thứ tự độ khó (1 = dễ nhất) theo `score_min`.
 */
export function useSystemLevels() {
  const { data, isLoading } = useApiQuery(() => getFitnessLevels());
  const { levels, activeLevels, levelOptions } = useMemo(() => {
    const ordered = [...(data || [])]
      .filter((level) => level && level.name)
      .sort(
        (a, b) => (a.scoreMin ?? 0) - (b.scoreMin ?? 0) || String(a.name).localeCompare(String(b.name))
      );
    const options = ordered.map((level) => ({
      id: level.id ?? null,
      name: level.name,
      scoreMin: level.scoreMin ?? 0,
      scoreMax: level.scoreMax ?? 0,
      status: String(level.status || "").toUpperCase(),
    }));
    const names = options.map((level) => level.name);
    return {
      levels: names,
      activeLevels: options.filter((level) => level.status === "ACTIVE").map((level) => level.name),
      levelOptions: options,
    };
  }, [data]);

  const levelLabel = useCallback((name) => {
    const trimmed = String(name || "").trim();
    return trimmed || "";
  }, []);

  /** Id của level theo tên (không phân biệt hoa thường). */
  const levelIdOf = useCallback(
    (name) => {
      const target = String(name || "").trim().toLowerCase();
      if (!target) return null;
      const match = levelOptions.find((level) => level.name.trim().toLowerCase() === target);
      return match?.id ?? null;
    },
    [levelOptions]
  );

  /**
   * Thứ tự độ khó của level (1 = dễ nhất) theo `score_min`.
   * Level lạ (không còn trong hệ thống) trả về 0 để không bao giờ được coi là khó nhất.
   */
  const levelPriority = useCallback(
    (name) => {
      const target = String(name || "").trim().toLowerCase();
      if (!target) return 0;
      const index = levelOptions.findIndex((level) => level.name.trim().toLowerCase() === target);
      return index < 0 ? 0 : index + 1;
    },
    [levelOptions]
  );

  return {
    levels,
    activeLevels,
    levelOptions,
    levelLabel,
    levelIdOf,
    levelPriority,
    isLoadingLevels: isLoading,
  };
}

export default useSystemLevels;
