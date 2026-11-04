package com.calishealth.dtos;

import java.util.List;

public record MemberExerciseDetailResponseDTO(
        Long id,
        String title,
        String description,
        String level,
        String targetMuscle,
        Integer defaultSets,
        Integer defaultReps,
        Integer defaultDuration,
        String equipment,
        String videoUrl,
        List<String> guideSteps,
        String authorName,
        String postedTimeAgo,
        Integer saveCount,
        Boolean isSavedByCurrentMember,
        String status
) {}
