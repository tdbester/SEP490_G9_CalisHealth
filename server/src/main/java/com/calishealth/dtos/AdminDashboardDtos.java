package com.calishealth.dtos;

/** DTO cho các thẻ số liệu tổng quan hệ thống trên Admin Dashboard. */
public class AdminDashboardDtos {
    /**
     * Số liệu thật lấy từ dữ liệu hệ thống:
     * - totalUsers: tổng tài khoản trong User Management.
     * - totalSkillExercises: số bài tập kỹ năng của thư viện hệ thống (source = SYSTEM, type = SKILL).
     * - totalHealthExercises: số bài tập sức khỏe của thư viện hệ thống (source = SYSTEM, type = HEALTH).
     * - totalSkillWorkouts / totalHealthWorkouts: số workout hệ thống theo nhóm.
     */
    public record SystemOverviewResponse(
            long totalUsers,
            long totalSkillExercises,
            long totalHealthExercises,
            long totalSkillWorkouts,
            long totalHealthWorkouts) {}
}
