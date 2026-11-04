package com.calishealth.dtos;

import java.util.List;

public record SystemExerciseDetailResponseDTO(
        Long id,
        String code,
        String title,
        String description,
        String videoUrl,
        String anatomyImageUrl,
        List<String> guideSteps,
        String targetMuscle,
        String level,
        Integer defaultSets,
        Integer defaultReps,
        Integer defaultDuration,
        String equipment,
        String type,
        String goal,
        String targetSkill,
        Long exerciseTreeId,
        Boolean hasExerciseTree,
        String movementGroup,
        List<String> previousExercises,
        List<String> nextExercises
) {}
