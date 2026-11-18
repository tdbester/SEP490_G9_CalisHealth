package com.calishealth.dtos;

import com.calishealth.dtos.ExerciseFilterRequestDTO.ExerciseGoal;
import com.calishealth.dtos.ExerciseFilterRequestDTO.ExerciseType;
import com.calishealth.dtos.ExerciseFilterRequestDTO.TargetSkill;

public record ExerciseItemResponseDTO(
        Long id,
        String title,
        ExerciseType type,
        String level,
        String targetMuscle,
        Integer sets,
        Integer reps,
        Integer duration,
        String equipment,
        ExerciseGoal goal,
        TargetSkill targetSkill,
        String icon,
        /**
         * Bài đang khoá trong Exercise Tree với member đang xem hay không.
         * Null khi khách (guest) xem — guest không tập được nên không cần biết.
         */
        Boolean locked
) {}
