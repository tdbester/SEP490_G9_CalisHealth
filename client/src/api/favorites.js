import api from "./client";

/**
 * Loại nội dung được yêu thích. Server dùng đúng tên này (`member_favorites.item_type`).
 *
 * - SYSTEM_EXERCISE: bài tập của hệ thống (do Content Manager tạo, có cây progression)
 * - MEMBER_EXERCISE: bài tập do Member cung cấp (community / personal)
 * - SYSTEM_WORKOUT:  workout của hệ thống (health / skill)
 * - MEMBER_WORKOUT:  workout do Member cung cấp
 */
export const FAVORITE_ITEM_TYPES = {
  SYSTEM_EXERCISE: "SYSTEM_EXERCISE",
  MEMBER_EXERCISE: "MEMBER_EXERCISE",
  SYSTEM_WORKOUT: "SYSTEM_WORKOUT",
  MEMBER_WORKOUT: "MEMBER_WORKOUT",
};

/** Loại favorite cho bài tập. */
export const EXERCISE_FAVORITE_TYPE = FAVORITE_ITEM_TYPES.SYSTEM_EXERCISE;
/** Loại favorite cho workout của hệ thống. */
export const SYSTEM_WORKOUT_FAVORITE_TYPE = FAVORITE_ITEM_TYPES.SYSTEM_WORKOUT;
/** Loại favorite cho workout của Member. */
export const MEMBER_WORKOUT_FAVORITE_TYPE = FAVORITE_ITEM_TYPES.MEMBER_WORKOUT;

/**
 * Chuẩn hoá id về số nguyên dương.
 * Server dùng `item_id BIGINT`, nên các id kiểu slug (vd "diamond-push-up")
 * hoặc chuỗi không phải số sẽ bị server từ chối — ta chặn ngay ở client.
 *
 * @returns {number|null} id hợp lệ, hoặc null nếu không dùng được.
 */
export const normalizeItemId = (itemId) => {
  const value = Number(itemId);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
};

/** Danh sách mọi mục Member đã đánh dấu sao. */
export const getFavorites = async () => {
  const response = await api.get("/v1/library/favorites");
  return response.data || [];
};

/** Bật/tắt yêu thích một mục. Trả về { itemType, itemId, favorite, count }. */
export const toggleFavorite = async (itemType, itemId) => {
  const response = await api.post(
    `/v1/library/favorites/${encodeURIComponent(itemType)}/${itemId}/toggle`
  );
  return response.data;
};

/**
 * Suy ra loại favorite của một bài tập.
 * Bài do Member cung cấp -> MEMBER_EXERCISE, ngược lại -> SYSTEM_EXERCISE.
 */
export const exerciseFavoriteType = (exercise) => {
  const isSystem =
    exercise?.isSystem === true ||
    String(exercise?.source || "").toUpperCase() === "SYSTEM" ||
    (exercise?.source == null && exercise?.isSystem !== false && exercise?.authorId == null);
  return isSystem
    ? FAVORITE_ITEM_TYPES.SYSTEM_EXERCISE
    : FAVORITE_ITEM_TYPES.MEMBER_EXERCISE;
};

/**
 * Suy ra loại favorite của một workout.
 * Workout do Member cung cấp -> MEMBER_WORKOUT, ngược lại -> SYSTEM_WORKOUT.
 */
export const workoutFavoriteType = (workout) => {
  const isSystem =
    workout?.isSystem === true ||
    String(workout?.source || "").toUpperCase() === "SYSTEM";
  return isSystem
    ? FAVORITE_ITEM_TYPES.SYSTEM_WORKOUT
    : FAVORITE_ITEM_TYPES.MEMBER_WORKOUT;
};

export default {
  FAVORITE_ITEM_TYPES,
  EXERCISE_FAVORITE_TYPE,
  SYSTEM_WORKOUT_FAVORITE_TYPE,
  MEMBER_WORKOUT_FAVORITE_TYPE,
  normalizeItemId,
  getFavorites,
  toggleFavorite,
  exerciseFavoriteType,
  workoutFavoriteType,
};
