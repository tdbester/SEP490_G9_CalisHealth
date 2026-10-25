// Seed data cho màn Performance Analytics (Member) — chỉ dùng ở frontend để dựng UI.
// Có thể xóa file này bất cứ lúc nào: PerformanceAnalytics.jsx tự nạp nếu file còn tồn tại,
// nếu không sẽ hiển thị trạng thái trống. Khi có API thì thay bằng dữ liệu từ backend.
// Mỗi khóa ứng với một khoảng thời gian trên tab: 1M, 3M, 1Y.

export default {
  "1M": {
    formErrors: {
      totalTags: 42,
      items: [
        { label: "Lower back arch", percent: 35 },
        { label: "Limited ROM", percent: 25 },
        { label: "Knee alignment", percent: 15 },
        { label: "Other", percent: 25 },
      ],
    },
    reps: { valid: 428, total: 470 },
    volume: [
      { label: "Week 1", reps: 210 },
      { label: "Week 2", reps: 405 },
      { label: "Week 3", reps: 482 },
      { label: "Week 4", reps: 645 },
    ],
    duration: { activeMin: 558, restMin: 186 },
    insight: {
      title: "Your cleanest reps happen between 6–8 PM",
      text: "Sessions in this window show 14% higher accuracy with shorter rest periods.",
    },
  },
  "3M": {
    formErrors: {
      totalTags: 118,
      items: [
        { label: "Lower back arch", percent: 31 },
        { label: "Limited ROM", percent: 29 },
        { label: "Knee alignment", percent: 18 },
        { label: "Other", percent: 22 },
      ],
    },
    reps: { valid: 1204, total: 1356 },
    volume: [
      { label: "Aug", reps: 1180 },
      { label: "Sep", reps: 1465 },
      { label: "Oct", reps: 1742 },
    ],
    duration: { activeMin: 1590, restMin: 570 },
    insight: {
      title: "Your accuracy improved 6% over 3 months",
      text: "Limited ROM tags dropped the most after you added mobility sessions.",
    },
  },
  "1Y": {
    formErrors: {
      totalTags: 396,
      items: [
        { label: "Limited ROM", percent: 33 },
        { label: "Lower back arch", percent: 28 },
        { label: "Knee alignment", percent: 17 },
        { label: "Other", percent: 22 },
      ],
    },
    reps: { valid: 4210, total: 4892 },
    volume: [
      { label: "Nov", reps: 620 },
      { label: "Dec", reps: 540 },
      { label: "Jan", reps: 760 },
      { label: "Feb", reps: 820 },
      { label: "Mar", reps: 905 },
      { label: "Apr", reps: 980 },
      { label: "May", reps: 1040 },
      { label: "Jun", reps: 1120 },
      { label: "Jul", reps: 1210 },
      { label: "Aug", reps: 1180 },
      { label: "Sep", reps: 1465 },
      { label: "Oct", reps: 1742 },
    ],
    duration: { activeMin: 6120, restMin: 2280 },
    insight: {
      title: "You trained 3x more volume than last year",
      text: "Consistency on weekdays drove most of the growth in completed reps.",
    },
  },
};
