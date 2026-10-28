package com.calishealth.specification;

import com.calishealth.models.Exercise;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class PersonalExerciseSpecification {
    private PersonalExerciseSpecification() {}

    public static Specification<Exercise> withFilters(
            Long memberId,
            Exercise.EntryStatus status,
            String search,
            Exercise.EntryLevel level
    ) {
        return (root, query, builder) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            predicates.add(builder.isFalse(root.get("system")));
            predicates.add(builder.equal(root.get("author").get("id"), memberId));
            predicates.add(builder.equal(root.get("status"), status.name()));
            if (level != null) {
                predicates.add(builder.equal(root.get("level"), level.name()));
            }
            if (search != null && !search.isBlank()) {
                predicates.add(builder.like(
                        builder.lower(root.get("name")),
                        "%" + search.trim().toLowerCase(Locale.ROOT) + "%"));
            }
            return builder.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }
}
