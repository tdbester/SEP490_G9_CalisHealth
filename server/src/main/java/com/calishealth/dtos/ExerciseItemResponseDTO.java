package com.calishealth.dtos;

import com.calishealth.dtos.ExerciseFilterRequestDTO.ExerciseGoal;
import com.calishealth.dtos.ExerciseFilterRequestDTO.ExerciseLevel;
import com.calishealth.dtos.ExerciseFilterRequestDTO.ExerciseType;
import com.calishealth.dtos.ExerciseFilterRequestDTO.TargetSkill;

public record ExerciseItemResponseDTO(
        Long id,
        String title,
        ExerciseType type,
        ExerciseLevel level,
        String targetMuscle,
        Integer sets,
        Integer reps,
        Integer duration,
        String equipment,
        ExerciseGoal goal,
        TargetSkill targetSkill,
        String icon
) {}
