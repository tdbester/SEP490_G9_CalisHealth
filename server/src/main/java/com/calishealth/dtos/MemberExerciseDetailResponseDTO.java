package com.calishealth.dtos;

import java.util.List;

public record MemberExerciseDetailResponseDTO(
        Long id,
        /** Mã bài tập — dùng để mở màn tracking AI (submit kết quả theo code). */
        String code,
        String title,
        String description,
        String level,
        String targetMuscle,
        Integer defaultSets,
        Integer defaultReps,
        Integer defaultDuration,
        /** HOLD | REPS — quyết định đo theo giây hay theo số lần. */
        String category,
        String equipment,
        String videoUrl,
        List<String> guideSteps,
        String authorName,
        String postedTimeAgo,
        Integer saveCount,
        Boolean isSavedByCurrentMember,
        String status
) {}
