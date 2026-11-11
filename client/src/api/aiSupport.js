import api from "./client";

/**
 * AI Support — member hỏi AI về lỗi form sau buổi tập (popup ở màn kết quả).
 *
 * Hạn mức: 15 câu/ngày mỗi member, 5 câu trong một phiên chat.
 */
export const aiSupportApi = {
  /**
   * Lượt còn lại hôm nay — dùng để hiển thị badge "N left" ngay khi mở popup.
   *
   * @param {string} [sessionId] id phiên chat hiện tại (server đếm lượt theo phiên)
   */
  getQuota: (sessionId) =>
    api
      .get("/member/ai-support/quota", { params: sessionId ? { sessionId } : {} })
      .then((res) => res.data),

  /**
   * Lịch sử hỏi/đáp hôm nay (mới nhất trước) — khôi phục hội thoại khi mở lại popup.
   *
   * @param {string} [sessionId] chỉ lấy lịch sử của một phiên chat
   */
  getHistory: (sessionId) =>
    api
      .get("/member/ai-support/history", { params: sessionId ? { sessionId } : {} })
      .then((res) => res.data),

  /**
   * Cảnh báo sinh lý (V76) của một bài tập — luật cảnh báo khớp với hồ sơ sinh lý.
   *
   * @param {string} exerciseCode mã bài tập
   */
  getAlerts: (exerciseCode) =>
    api
      .get(`/member/ai-support/alerts/${encodeURIComponent(exerciseCode)}`)
      .then((res) => res.data),

  /**
   * Đặt câu hỏi cho AI.
   *
   * @param {{ exerciseCode: string, question: string, sessionId?: string,
   *           formIssues?: string[], accuracy?: number }} payload
   */
  ask: (payload) => api.post("/member/ai-support/ask", payload).then((res) => res.data),
};

export default aiSupportApi;
