import api from "./client";

/** API tổng quan hệ thống cho Admin Dashboard. */
export const adminDashboardApi = {
  /**
   * Số liệu thật từ User Management + System Exercise + System Workout.
   * @returns {Promise<{totalUsers:number, totalSkillExercises:number, totalHealthExercises:number, totalSkillWorkouts:number, totalHealthWorkouts:number}>}
   */
  overview: () => api.get("/admin/dashboard/overview").then((res) => res.data),
};
