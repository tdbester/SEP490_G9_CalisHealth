import api from "./client";

/**
 * API góp ý & khiếu nại của Member.
 *
 * Luồng: Member gửi đơn -> Content Manager tiếp nhận -> (tự giải quyết | chuyển
 * tiếp lên Admin) -> trả trạng thái lại cho Member.
 */

/** Trạng thái của một đơn góp ý. */
export const FEEDBACK_STATUS = {
  /** Member vừa gửi, chờ Content Manager tiếp nhận. */
  PENDING: "PENDING",
  /** Content Manager đã nhận việc và đang xử lý. */
  IN_REVIEW: "IN_REVIEW",
  /** Đã chuyển tiếp lên Admin. */
  ESCALATED: "ESCALATED",
  /** Đã xử lý xong. */
  RESOLVED: "RESOLVED",
  /** Không chấp nhận. */
  REJECTED: "REJECTED",
};

/** Nhóm nội dung của đơn. */
export const FEEDBACK_CATEGORY = {
  GENERAL: "GENERAL",
  EXERCISE_CONTENT: "EXERCISE_CONTENT",
  WORKOUT_CONTENT: "WORKOUT_CONTENT",
  TECHNICAL: "TECHNICAL",
  OTHER: "OTHER",
};

/** Danh sách đơn của chính Member. */
export const getMyFeedback = async () => {
  const response = await api.get("/v1/library/feedback");
  return response.data || [];
};

/** Member gửi đơn góp ý mới (tiêu đề + nội dung). */
export const createFeedback = async ({ title, content, category }) => {
  const response = await api.post("/v1/library/feedback", {
    title,
    content,
    category: category || FEEDBACK_CATEGORY.GENERAL,
  });
  return response.data;
};

export default {
  FEEDBACK_STATUS,
  FEEDBACK_CATEGORY,
  getMyFeedback,
  createFeedback,
};
