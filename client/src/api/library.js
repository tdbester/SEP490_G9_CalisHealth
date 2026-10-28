import api, { getStoredAuthToken } from "./client";

export const getLibrarySummary = async () => {
  const response = await api.get("/library/summary");
  return response.data;
};

export const getLibraryOverview = async () => {
  const response = await api.get("/v1/library/overview");
  return response.data;
};

export const getExerciseCounts = async () => {
  const response = await api.get("/library/counts");
  return response.data;
};

export const getExercises = async (params = {}) => {
  const response = await api.get("/v1/library/exercises", { params });
  return response.data;
};

export const getMemberExercises = async (params = {}) => {
  const response = await api.get("/library/member-exercises", { params });
  return response.data;
};

export const getMemberExerciseList = async (params = {}) => {
  const response = await api.get("/v1/library/member-exercises", { params });
  return response.data;
};

const toPersonalExerciseFormData = (data, videoFile) => {
  const formData = new FormData();
  formData.append("data", new Blob([JSON.stringify(data)], { type: "application/json" }));
  if (videoFile) formData.append("videoFile", videoFile);
  return formData;
};

const personalExerciseFormConfig = () => {
  const { token, source } = getStoredAuthToken();
  console.log("[Personal exercise upload auth]", {
    tokenPresent: Boolean(token),
    tokenSource: source,
    authorizationScheme: token ? "Bearer" : null,
  });
  return {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
};

export const createPersonalExercise = async (data, videoFile) => {
  const response = await api.post(
    "/v1/library/personal-exercises",
    toPersonalExerciseFormData(data, videoFile),
    personalExerciseFormConfig()
  );
  return response.data;
};

export const getPersonalExercises = async (params = {}) => {
  const response = await api.get("/v1/library/personal-exercises", { params });
  return response.data;
};

export const getPersonalExercise = async (id) => {
  const response = await api.get(`/v1/library/personal-exercises/${id}`);
  return response.data;
};

export const getPersonalExerciseCounts = async () => {
  const response = await api.get("/v1/library/personal-exercises/counts");
  return response.data;
};

export const resubmitPersonalExercise = async (id, data, videoFile) => {
  const response = await api.put(
    `/v1/library/personal-exercises/${id}/resubmit`,
    toPersonalExerciseFormData(data, videoFile),
    personalExerciseFormConfig()
  );
  return response.data;
};

export const updateAcceptedPersonalExercise = async (id, data, videoFile) => {
  const config = personalExerciseFormConfig();
  const response = await api.put(
    `/v1/library/personal-exercises/${id}/edit`,
    toPersonalExerciseFormData(data, videoFile),
    config
  );
  return response.data;
};

export const deletePersonalExercise = async (id) => {
  await api.delete(`/v1/library/personal-exercises/${id}`);
};

const displayLevel = (level) =>
  String(level || "BEGINNER").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());

const timeAgo = (timestamp) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour${Math.floor(seconds / 3600) === 1 ? "" : "s"} ago`;
  const days = Math.floor(seconds / 86400);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const normalizeWorkout = (workout) => ({
  ...workout,
  title: workout.title,
  level: displayLevel(workout.level),
  author: { name: workout.authorName || "Member", avatarText: (workout.authorName || "M").slice(0, 2).toUpperCase() },
  postedTime: workout.createdAt ? timeAgo(workout.createdAt) : "",
  savesCount: Number(workout.saveCount || 0),
  exercisesCount: Number(workout.totalExercises || 0),
  setsCount: Number(workout.totalSets || 0),
  duration: `About ${(
    Number.isFinite(Number(workout.estimatedDuration))
      ? Number(workout.estimatedDuration)
      : 0
  )} min`,
  createdLabel: workout.createdAt ? `Created ${timeAgo(workout.createdAt)}` : "",
  isShared: Boolean(workout.isSharedWithCommunity),
  exercises: Array.isArray(workout.exercises)
    ? workout.exercises.map((exercise) => ({
        id: exercise.exerciseId,
        exerciseId: exercise.exerciseId,
        name: exercise.exerciseTitle,
        title: exercise.exerciseTitle,
        isSystem: Boolean(exercise.isSystem),
        level: displayLevel(exercise.level),
        sets: exercise.sets,
        reps: exercise.reps ?? exercise.duration ?? 8,
        countBy: exercise.countBy === "SECONDS" ? "sec" : "reps",
        restSec: exercise.restSeconds,
      }))
    : undefined,
});

export const getCommunityWorkouts = async (params = {}) => {
  const response = await api.get("/v1/library/custom-workouts", { params });
  return { ...response.data, content: response.data.content.map(normalizeWorkout) };
};

export const getCommunityWorkout = async (id) => {
  const response = await api.get(`/v1/library/custom-workouts/${id}`);
  return normalizeWorkout(response.data);
};

export const getSystemWorkouts = async (params = {}) => {
  const response = await api.get("/v1/library/system-workouts", { params });
  return { ...response.data, content: response.data.content.map(normalizeWorkout) };
};

export const getSystemWorkout = async (id) => {
  const response = await api.get(`/v1/library/system-workouts/${id}`);
  return response.data;
};

export const getMyWorkouts = async (params = {}) => {
  const response = await api.get("/v1/library/my-workouts", { params });
  return { ...response.data, content: response.data.content.map(normalizeWorkout) };
};

export const getMyWorkout = async (id) => {
  const response = await api.get(`/v1/library/my-workouts/${id}`);
  return normalizeWorkout(response.data);
};

export const createMyWorkout = async (data) => {
  const response = await api.post("/v1/library/my-workouts", data);
  return normalizeWorkout(response.data);
};

export const updateMyWorkout = async (id, data) => {
  const response = await api.put(`/v1/library/my-workouts/${id}`, data);
  return normalizeWorkout(response.data);
};

export const deleteMyWorkout = async (id) => {
  await api.delete(`/v1/library/my-workouts/${id}`);
};

export const getAvailableWorkoutExercises = async () => {
  const response = await api.get("/v1/library/workout-exercises/available");
  return response.data;
};

export const createMemberExercise = async (data) => {
  const response = await api.post("/library/member-exercises", data, {
    skipAuthRedirect: true,
  });
  return response.data;
};

export const getExerciseDetail = async (id) => {
  const response = await api.get(`/v1/library/member-exercises/${id}`);
  return response.data;
};

export const getSystemExerciseDetail = async (id) => {
  const response = await api.get(`/v1/library/exercises/${id}`);
  return response.data;
};

export const getExerciseTree = async (params = {}) => {
  const response = await api.get("/v1/library/exercise-tree", { params });
  return response.data;
};

export default {
  getLibrarySummary,
  getLibraryOverview,
  getExerciseCounts,
  getExercises,
  getMemberExercises,
  getMemberExerciseList,
  createPersonalExercise,
  getPersonalExercises,
  getPersonalExercise,
  getPersonalExerciseCounts,
  resubmitPersonalExercise,
  deletePersonalExercise,
  getCommunityWorkouts,
  getMyWorkouts,
  getMyWorkout,
  createMyWorkout,
  updateMyWorkout,
  deleteMyWorkout,
  getAvailableWorkoutExercises,
  createMemberExercise,
  getExerciseDetail,
  getSystemExerciseDetail,
  getExerciseTree,
};
