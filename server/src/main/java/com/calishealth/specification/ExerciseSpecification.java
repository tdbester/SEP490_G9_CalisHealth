package com.calishealth.specification;

import com.calishealth.dtos.ExerciseFilterRequestDTO;
import com.calishealth.models.Exercise;
import jakarta.persistence.criteria.JoinType;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class ExerciseSpecification {
    private ExerciseSpecification() {}

    public static Specification<Exercise> withFilters(ExerciseFilterRequestDTO filter) {
        return (root, query, builder) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            var muscleGroupLink = root.join("muscleGroups", JoinType.LEFT);
            var muscleGroup = muscleGroupLink.join("muscleGroup", JoinType.LEFT);
            query.distinct(true);
            predicates.add(builder.equal(root.get("source"), "SYSTEM"));
            predicates.add(builder.isTrue(root.get("active")));
            predicates.add(builder.upper(root.get("moderationStatus")).in("ACTIVE", "ACCEPTED"));
            predicates.add(builder.equal(root.get("type"), filter.getType().name()));

            if (filter.getSearch() != null && !filter.getSearch().isBlank()) {
                String pattern = "%" + filter.getSearch().trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(builder.or(
                        builder.like(builder.lower(root.get("name")), pattern),
                        builder.like(builder.lower(muscleGroup.get("name")), pattern)
                ));
            }

            if (filter.getLevel() != null) {
                predicates.add(builder.equal(
                        root.get("difficultyLevel"),
                        filter.getLevel().name()));
            }

            if (filter.getTargetMuscle() != null && !filter.getTargetMuscle().isBlank()) {
                String[] muscles = filter.getTargetMuscle().split(",");
                List<jakarta.persistence.criteria.Predicate> muscleMatches = new ArrayList<>();
                for (String muscle : muscles) {
                    if (!muscle.isBlank() && !muscle.equalsIgnoreCase("all")) {
                        muscleMatches.add(builder.like(
                                builder.lower(muscleGroup.get("name")),
                                "%" + muscle.trim().toLowerCase(Locale.ROOT) + "%"));
                    }
                }
                if (!muscleMatches.isEmpty()) {
                    predicates.add(builder.or(muscleMatches.toArray(jakarta.persistence.criteria.Predicate[]::new)));
                }
            }

            if (filter.getType() == ExerciseFilterRequestDTO.ExerciseType.HEALTH && filter.getGoal() != null) {
                predicates.add(builder.equal(
                        root.get("goal"),
                        Exercise.EntryGoal.valueOf(filter.getGoal().name())));
            }
            if (filter.getType() == ExerciseFilterRequestDTO.ExerciseType.SKILL && filter.getTargetSkill() != null) {
                predicates.add(builder.equal(
                        root.get("targetSkill"),
                        Exercise.EntryTargetSkill.valueOf(filter.getTargetSkill().name())));
            }

            return builder.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }
}
