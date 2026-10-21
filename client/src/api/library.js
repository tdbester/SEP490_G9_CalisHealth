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
  const response = await api.post("/library/member-exercises", data);
  return response.data;
};

export default {
  getLibrarySummary,
  getExerciseCounts,
  getExercises,
  getMemberExercises,
  createMemberExercise,
};
