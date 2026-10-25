// Mock data cho popup Day Report (Member) — chỉ dùng ở frontend, backend giữ nguyên.
// Khi nối API, thay DAY_REPORTS bằng dữ liệu từ server (key theo dayKey YYYY-MM-DD).

/** Bài tập trong một buổi tập: sets / reps / form accuracy do AI chấm. */
export const DAY_REPORTS = {
  "2026-10-08": {
    duration: "42 mins",
    totalVolume: 128,
    exercises: [
      {
        id: "squat",
        name: "Squat",
        icon: "squat",
        sets: 3,
        reps: 12,
        formAccuracy: 92,
      },
      {
        id: "push-up",
        name: "Push-up",
        icon: "pushup",
        sets: 3,
        reps: 15,
        formAccuracy: 88,
      },
      {
        id: "plank",
        name: "Plank",
        icon: "plank",
        sets: 3,
        reps: 45,
        formAccuracy: 95,
      },
      {
        id: "lunge",
        name: "Lunge",
        icon: "lunge",
        sets: 3,
        reps: 10,
        formAccuracy: 84,
      },
    ],
  },
  "2026-10-07": {
    duration: "35 mins",
    totalVolume: 104,
    exercises: [
      {
        id: "pull-up",
        name: "Pull-up",
        icon: "pullup",
        sets: 4,
        reps: 8,
        formAccuracy: 90,
      },
      {
        id: "dip",
        name: "Dip",
        icon: "dip",
        sets: 3,
        reps: 12,
        formAccuracy: 86,
      },
      {
        id: "plank",
        name: "Plank",
        icon: "plank",
        sets: 3,
        reps: 60,
        formAccuracy: 93,
      },
    ],
  },
  "2026-10-06": {
    duration: "28 mins",
    totalVolume: 86,
    exercises: [
      {
        id: "push-up",
        name: "Push-up",
        icon: "pushup",
        sets: 3,
        reps: 20,
        formAccuracy: 91,
      },
      {
        id: "squat",
        name: "Squat",
        icon: "squat",
        sets: 3,
        reps: 15,
        formAccuracy: 89,
      },
      {
        id: "side-plank",
        name: "Side Plank",
        icon: "plank",
        sets: 2,
        reps: 30,
        formAccuracy: 87,
      },
    ],
  },
  "2026-10-05": {
    duration: "31 mins",
    totalVolume: 92,
    exercises: [
      {
        id: "muscle-up",
        name: "Muscle-up",
        icon: "muscleup",
        sets: 3,
        reps: 5,
        formAccuracy: 79,
      },
      {
        id: "lunge",
        name: "Lunge",
        icon: "lunge",
        sets: 3,
        reps: 12,
        formAccuracy: 85,
      },
      {
        id: "hollow-body",
        name: "Hollow Body Hold",
        icon: "plank",
        sets: 3,
        reps: 40,
        formAccuracy: 90,
      },
    ],
  },
  "2026-10-04": {
    duration: "38 mins",
    totalVolume: 112,
    exercises: [
      {
        id: "squat",
        name: "Squat",
        icon: "squat",
        sets: 4,
        reps: 12,
        formAccuracy: 90,
      },
      {
        id: "pull-up",
        name: "Pull-up",
        icon: "pullup",
        sets: 4,
        reps: 7,
        formAccuracy: 88,
      },
      {
        id: "push-up",
        name: "Push-up",
        icon: "pushup",
        sets: 3,
        reps: 18,
        formAccuracy: 92,
      },
    ],
  },
  "2026-10-02": {
    duration: "26 mins",
    totalVolume: 78,
    exercises: [
      {
        id: "plank",
        name: "Plank",
        icon: "plank",
        sets: 3,
        reps: 50,
        formAccuracy: 94,
      },
      {
        id: "dip",
        name: "Dip",
        icon: "dip",
        sets: 3,
        reps: 10,
        formAccuracy: 83,
      },
    ],
  },
  "2026-10-01": {
    duration: "33 mins",
    totalVolume: 98,
    exercises: [
      {
        id: "lunge",
        name: "Lunge",
        icon: "lunge",
        sets: 3,
        reps: 12,
        formAccuracy: 87,
      },
      {
        id: "push-up",
        name: "Push-up",
        icon: "pushup",
        sets: 3,
        reps: 16,
        formAccuracy: 90,
      },
    ],
  },
};

/**
 * Lấy report của một ngày.
 * Ngày có sẵn trong DAY_REPORTS thì trả về dữ liệu gốc,
 * ngày còn lại dựng report tạm để mọi ô đã tập đều mở được popup.
 */
export function getDayReport(dayKey) {
  return DAY_REPORTS[dayKey] ?? buildFallbackReport(dayKey);
}

/** Bộ bài tập + icon dùng để dựng report tạm cho ngày chưa khai báo. */
const FALLBACK_EXERCISES = [
  { id: "squat", name: "Squat", icon: "squat", sets: 3, reps: 12 },
  { id: "push-up", name: "Push-up", icon: "pushup", sets: 3, reps: 15 },
  { id: "plank", name: "Plank", icon: "plank", sets: 3, reps: 45 },
  { id: "lunge", name: "Lunge", icon: "lunge", sets: 3, reps: 10 },
];

/** Report tạm, số liệu suy ra từ dayKey để ổn định theo từng ngày. */
function buildFallbackReport(dayKey) {
  const seed = Number(dayKey.replaceAll("-", ""));
  const count = 3 + (seed % 2);

  return {
    duration: `${28 + (seed % 10)} mins`,
    totalVolume: 80 + (seed % 50),
    exercises: FALLBACK_EXERCISES.slice(0, count).map((exercise, index) => ({
      ...exercise,
      formAccuracy: 82 + ((seed + index * 3) % 15),
    })),
  };
}