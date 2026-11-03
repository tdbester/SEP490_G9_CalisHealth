package com.calishealth.dtos;

import java.util.List;

public record ExerciseTreeNodeDTO(
        Long id,
        String code,
        String name,
        String type,
        String category,
        Integer level,
        String difficulty,
        String movementGroup,
        String state,
        List<Long> prerequisiteIds,
        List<Long> nextExerciseIds,
        String targetMuscle
) {}
