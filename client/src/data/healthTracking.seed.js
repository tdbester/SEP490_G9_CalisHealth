// Seed data cho màn Health Tracking (Member) — chỉ dùng ở frontend để dựng UI.
// Có thể xóa file này bất cứ lúc nào: HealthTracking.jsx tự nạp nếu file còn tồn tại,
// nếu không sẽ hiển thị trạng thái trống. Khi có API thì thay bằng dữ liệu từ backend.

const today = new Date();
today.setHours(7, 45, 0, 0);

export default {
  healthScore: {
    score: 84,
    changePercent: 8,
    peerPercentile: 72,
  },
  bodyMetrics: {
    updatedAt: today.toISOString(),
    weightKg: 68.4,
    weightChangeKg: -0.8,
    heightCm: 172,
    heightNote: "Healthy range",
  },
  bmiByMonth: [
    { month: "2026-05", bmi: 22.1 },
    { month: "2026-06", bmi: 22.4 },
    { month: "2026-07", bmi: 22.7 },
    { month: "2026-08", bmi: 22.9 },
    { month: "2026-09", bmi: 23.1 },
    { month: "2026-10", bmi: 23.0 },
  ],
};
