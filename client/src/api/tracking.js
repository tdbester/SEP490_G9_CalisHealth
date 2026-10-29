import api from "./client";

export const trackingApi = {
  /**
   * Màn 5.1: Lấy tổng quan Health Score, Body Metrics & Lịch sử BMI 6 tháng
   */
  getOverview: () => api.get("/member/tracking/overview").then((res) => res.data),

  /**
   * Màn 5.2: Cập nhật cân nặng và chiều cao mới
   * @param {{ weightKg: number, heightCm: number, note?: string }} data
   */
  updateMeasurements: (data) =>
    api.post("/member/tracking/measurements", data).then((res) => res.data),

  /**
   * Màn 5.3: Lấy lịch sử các buổi tập hoàn thành
   * @param {{ category?: string, date?: string }} params
   */
  getWorkoutHistory: (params = {}) =>
    api.get("/member/tracking/workout-history", { params }).then((res) => res.data),

  /**
   * Màn 5.4: Lấy chi tiết bài tập của một buổi tập
   * @param {number|string} sessionId
   */
  getWorkoutSessionDetail: (sessionId) =>
    api.get(`/member/tracking/workout-sessions/${sessionId}`).then((res) => res.data),

  /**
   * Màn 5.5: Lấy số liệu phân tích hiệu suất chuyên sâu
   * @param {"1M" | "3M" | "1Y"} range
   */
  getAnalytics: (range = "1M") =>
    api.get("/member/tracking/analytics", { params: { range } }).then((res) => res.data),
};

export default trackingApi;
