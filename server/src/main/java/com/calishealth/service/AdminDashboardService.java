package com.calishealth.service;

import com.calishealth.dtos.AdminDashboardDtos.SystemOverviewResponse;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Thu thập số liệu tổng quan hệ thống cho Admin Dashboard.
 *
 * <p>Toàn bộ số liệu đến trực tiếp từ dữ liệu thật trong database, không dùng số giả:
 * - totalUsers: tổng tài khoản trong User Management ({@code users} bảng).
 * - totalSkillExercises: bài tập kỹ năng của thư viện hệ thống
 *   ({@code source = 'SYSTEM' AND type = 'SKILL'}).
 * - totalHealthExercises: bài tập sức khỏe của thư viện hệ thống
 *   ({@code source = 'SYSTEM' AND type = 'HEALTH'}).
 */
@Service
@RequiredArgsConstructor
public class AdminDashboardService {
    private final UserRepository users;
    private final ExerciseRepository exercises;
    private final WorkoutRepository workouts;

    @Transactional(readOnly = true)
    public SystemOverviewResponse getSystemOverview() {
        long totalUsers = users.count();
        long totalSkillExercises = exercises.countAcceptedSystemExercisesByType("SKILL");
        long totalHealthExercises = exercises.countAcceptedSystemExercisesByType("HEALTH");
        long totalSkillWorkouts = workouts.countSystemWorkoutsByType("SKILL");
        long totalHealthWorkouts = workouts.countSystemWorkoutsByType("HEALTH");
        return new SystemOverviewResponse(totalUsers, totalSkillExercises, totalHealthExercises,
                totalSkillWorkouts, totalHealthWorkouts);
    }
}
