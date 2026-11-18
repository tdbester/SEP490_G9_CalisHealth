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
        /** HOLD | REPS — quyết định đo theo giây hay theo số lần. */
        String category,
        String equipment,
        String type,
        String goal,
        String targetSkill,
        /** Bài này có nằm trong cây tiến trình (progression rules) hay không. */
        Boolean hasExerciseTree,
        String movementGroup,
        List<String> previousExercises,
        List<String> nextExercises,
        ExercisePhysiologyDTO physiology,
        /**
         * Bài này đang khoá trong Exercise Tree với member đang xem hay không.
         *
         * <p>Null khi khách (guest) xem — guest không tập được nên không cần biết.
         * Member chỉ tập được bài không LOCKED.</p>
         */
        Boolean locked
) {}
