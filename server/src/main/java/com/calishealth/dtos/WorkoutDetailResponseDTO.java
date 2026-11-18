package com.calishealth.dtos;

import java.time.LocalDateTime;
import java.util.List;

public record WorkoutDetailResponseDTO(
        Long id,
        String title,
        String description,
        String level,
        /** HEALTH / SKILL / FLEX — FLEX hiển thị ở cả tab Health và tab Skill. */
        String type,
        boolean isSharedWithCommunity,
        int saveCount,
        String authorName,
        LocalDateTime createdAt,
        int totalExercises,
        int totalSets,
        int estimatedDuration,
        List<WorkoutExerciseItemDTO> exercises,
        /**
         * Workout có tập được không.
         *
         * <p>Workout hệ thống chỉ tập được khi TẤT CẢ bài trong nó đã mở khoá trong
         * Exercise Tree. Còn workout do member tự tạo / cộng đồng thì luôn tập được
         * vì member chủ động chọn bài.</p>
         */
        boolean locked,
        /**
         * Tên các bài đang khoá trong workout — member biết cần mở khoá bài nào.
         * Rỗng khi {@code locked} = false.
         */
        List<String> lockedExerciseNames
) {}
