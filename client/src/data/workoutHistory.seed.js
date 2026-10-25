// Seed data cho màn Workout History (Member) — chỉ dùng ở frontend để dựng UI.
// Có thể xóa file này bất cứ lúc nào: WorkoutHistory.jsx tự nạp nếu file còn tồn tại,
// nếu không sẽ hiển thị trạng thái trống. Khi có API thì thay bằng dữ liệu từ backend.

export default {
  // Tổng hợp toàn bộ lịch sử (không chỉ các buổi trong danh sách bên dưới).
  summary: {
    totalWorkouts: 18,
    totalMinutes: 744,
    cleanRepRatio: 91,
  },
  workouts: [
    {
      id: "w-1008",
      name: "Upper Body Strength",
      category: "strength",
      completedAt: "2026-10-08T08:30:00",
      durationMin: 48,
      accuracy: 92,
      exercises: [
        { name: "Bench Press", sets: 4, reps: 10, durationSec: 760 },
        { name: "Lat Pulldown", sets: 3, reps: 12, durationSec: 625 },
        { name: "Shoulder Press", sets: 3, reps: 10, durationSec: 550 },
        { name: "Cable Row", sets: 3, reps: 12, durationSec: 515 },
      ],
    },
    {
      id: "w-1006",
      name: "HIIT Cardio Blast",
      category: "cardio",
      completedAt: "2026-10-06T18:15:00",
      durationMin: 32,
      accuracy: 88,
      exercises: [
        { name: "Burpees", sets: 4, reps: 15, durationSec: 480 },
        { name: "Mountain Climbers", sets: 4, reps: 30, durationSec: 420 },
        { name: "Jump Squats", sets: 3, reps: 20, durationSec: 360 },
        { name: "High Knees", sets: 3, reps: 40, durationSec: 300 },
      ],
    },
    {
      id: "w-1004",
      name: "Lower Body Power",
      category: "strength",
      completedAt: "2026-10-04T07:45:00",
      durationMin: 54,
      accuracy: 85,
      exercises: [
        { name: "Pistol Squat", sets: 4, reps: 8, durationSec: 840 },
        { name: "Bulgarian Split Squat", sets: 3, reps: 12, durationSec: 720 },
        { name: "Nordic Curl", sets: 3, reps: 6, durationSec: 600 },
        { name: "Calf Raise", sets: 4, reps: 20, durationSec: 480 },
      ],
    },
    {
      id: "w-1002",
      name: "Mobility & Core",
      category: "mobility",
      completedAt: "2026-10-02T19:00:00",
      durationMin: 28,
      accuracy: 96,
      exercises: [
        { name: "Hollow Body Hold", sets: 3, reps: 1, durationSec: 360 },
        { name: "Hanging Leg Raise", sets: 3, reps: 10, durationSec: 420 },
        { name: "Deep Squat Hold", sets: 2, reps: 1, durationSec: 300 },
      ],
    },
  ],
};
