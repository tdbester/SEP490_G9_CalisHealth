package com.calishealth.dtos;

public record MemberExerciseItemResponseDTO(
        Long id,
        String title,
        String level,
        String targetMuscle,
        Integer defaultSets,
        Integer defaultReps,
        Integer defaultDuration,
        String authorName,
        String authorAvatar,
        String postedTimeAgo,
        Integer saveCount,
        Boolean isSavedByCurrentMember,
        String status
) {}
