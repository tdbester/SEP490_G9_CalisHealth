import api from "./client";

export const getLibrarySummary = async () => {
  const response = await api.get("/library/summary");
  return response.data;
};

export const getExerciseCounts = async () => {
  const response = await api.get("/library/counts");
  return response.data;
};

export const getExercises = async (params = {}) => {
  const response = await api.get("/library/exercises", { params });
  return response.data;
};

export const getMemberExercises = async (params = {}) => {
  const response = await api.get("/library/member-exercises", { params });
  return response.data;
};

export const createMemberExercise = async (data) => {
  const response = await api.post("/library/member-exercises", data, {
    skipAuthRedirect: true,
  });
  return response.data;
};

export const getExerciseDetail = async (id) => {
  try {
    const response = await api.get(`/library/exercises/${id}`);
    return response.data;
  } catch (err) {
    return null;
  }
};

export default {
  getLibrarySummary,
  getExerciseCounts,
  getExercises,
  getMemberExercises,
  createMemberExercise,
  getExerciseDetail,
};
