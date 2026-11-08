import { useCallback, useMemo } from "react";
import { getFitnessLevels } from "./api/library";
import { useApiQuery } from "./hooks";

/**
 * Tên level của hệ thống, lấy động từ bảng `fitness_levels`.
 *
 * Level do Content Manager tạo / đổi tên trong Level & Benchmark Criteria nên client không
 * được hard-code Beginner / Intermediate / Advanced: level mới phải hiện ngay trong dropdown
 * mà không cần sửa code.
 *
 * - `levels`: mọi level, sắp theo score_min (dễ -> khó).
 * - `activeLevels`: level đang ACTIVE. Level INACTIVE không nhận bài tập/workout mới nên form
 *   tạo mới chỉ chọn trong nhóm này.
 * - `levelLabel(name)`: nhãn hiển thị của một level (giữ nguyên tên do Content Manager đặt).
 */
export function useSystemLevels() {
  const { data, isLoading } = useApiQuery(() => getFitnessLevels());
  const { levels, activeLevels } = useMemo(() => {
    const ordered = [...(data || [])].sort(
      (a, b) => (a.scoreMin ?? 0) - (b.scoreMin ?? 0) || String(a.name).localeCompare(String(b.name))
    );
    const names = ordered.map((level) => level.name).filter(Boolean);
    return {
      levels: names,
      activeLevels: ordered
        .filter((level) => String(level.status || "").toUpperCase() === "ACTIVE")
        .map((level) => level.name)
        .filter(Boolean),
    };
  }, [data]);

  const levelLabel = useCallback((name) => {
    const trimmed = String(name || "").trim();
    return trimmed || "";
  }, []);

  return { levels, activeLevels, levelLabel, isLoadingLevels: isLoading };
}

export default useSystemLevels;
