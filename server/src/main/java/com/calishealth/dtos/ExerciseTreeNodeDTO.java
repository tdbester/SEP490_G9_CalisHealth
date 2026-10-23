package com.calishealth.dtos;

import java.util.List;

public record ExerciseTreeNodeDTO(
        Long id,
        String name,
        Integer level,
        String difficulty,
        String movementGroup,
        String state,
        List<Long> prerequisiteIds,
        List<Long> nextExerciseIds,
        String targetMuscle
) {}
