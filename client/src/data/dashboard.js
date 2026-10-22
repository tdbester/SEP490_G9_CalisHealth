// Mock data cho Main Dashboard (Member) — chỉ dùng ở frontend, backend giữ nguyên.

export const TODAY_PLAN = {
  day: "Wednesday",
  focus: "Full Body A",
  duration: "25–35 mins",
  status: "Status: Ready to train today",
  exercises: [
    { name: "Push-up", sets: 3, reps: 12 },
    { name: "Pull-up", sets: 3, reps: 8 },
    { name: "Bodyweight Squat", sets: 3, reps: 15 },
    { name: "Plank", sets: 3, reps: 45 },
  ],
};

export const STREAK_DAYS = 5;

export const MUSCLE_GROUPS = [
  { id: "chest", name: "Chest", count: 24, icon: "fitness", tone: "purple" },
  { id: "back", name: "Back", count: 31, icon: "accessibility", tone: "blue" },
  { id: "legs", name: "Legs", count: 28, icon: "walk", tone: "green" },
  { id: "core", name: "Core", count: 19, icon: "adjust", tone: "orange" },
  { id: "arms", name: "Arms", count: 22, icon: "martial", tone: "pink" },
  { id: "full-body", name: "Full body", count: 40, icon: "self", tone: "cyan" },
];

export const SKILLS = [
  {
    id: "handstand",
    name: "Handstand",
    steps: 6,
    level: "Intermediate",
    tone: "purple",
    progression: [
      "Wall Plank",
      "Chest-to-Wall Hold",
      "Kick-up Practice",
      "Hollow Body Hold",
      "Freestanding Balance",
      "Full Handstand Push-up",
    ],
  },
  {
    id: "muscle-up",
    name: "Muscle-up",
    steps: 5,
    level: "Advanced",
    tone: "blue",
    progression: [
      "Dead Hang",
      "Scapula Pull",
      "Negative Pull-up",
      "Bar Muscle-up",
      "Strict Muscle-up",
    ],
  },
  {
    id: "front-lever",
    name: "Front lever",
    steps: 7,
    level: "Advanced",
    tone: "green",
    progression: [
      "Dead Hang",
      "Tuck Lever",
      "Advanced Tuck",
      "One-leg Lever",
      "Straddle Lever",
      "Full Front Lever",
      "Front Lever Pull-up",
    ],
  },
  {
    id: "planche",
    name: "Planche",
    steps: 8,
    level: "Expert",
    tone: "orange",
    progression: [
      "Planche Lean",
      "Tuck Plank",
      "Planche Push-up",
      "Advanced Tuck",
      "Straddle Planche",
      "Hollow Body Plank",
      "One-leg Planche",
      "Full Planche",
    ],
  },
  {
    id: "muscle-up-strict",
    name: "Strict pull-up",
    steps: 4,
    level: "Beginner",
    tone: "pink",
    progression: ["Dead Hang", "Active Hang", "Negative Pull-up", "Chin-over Bar"],
  },
];

export const HEALTH_METRICS = {
  weight: 68.5,
  bmi: 21.4,
  bmiLabel: "Normal",
  weeklyGoal: 85,
};

export const COMMUNITY_STATS = {
  headline: "Discover thousands of workouts shared by Calisthenics community",
  workouts: 12480,
  athletes: 3120,
};
