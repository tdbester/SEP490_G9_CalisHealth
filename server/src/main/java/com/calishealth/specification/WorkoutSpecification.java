package com.calishealth.specification;

import com.calishealth.dtos.WorkoutFilterRequestDTO;
import com.calishealth.models.WorkoutEntry;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class WorkoutSpecification {
    private WorkoutSpecification() {}

    public static Specification<WorkoutEntry> withFilters(
            WorkoutFilterRequestDTO filter,
            Long memberId,
            boolean community
    ) {
        return (root, query, builder) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            predicates.add(builder.isFalse(root.get("isSystem")));
            if (community) {
                predicates.add(builder.isTrue(root.get("sharedWithCommunity")));
                predicates.add(builder.equal(root.get("status"), "ACCEPTED"));
            } else {
                predicates.add(builder.equal(root.get("authorId"), memberId));
            }

            if (filter.getLevel() != null && !filter.getLevel().isBlank()
                    && !"ALL".equalsIgnoreCase(filter.getLevel())) {
                predicates.add(builder.equal(
                        builder.upper(root.get("level")),
                        filter.getLevel().trim().toUpperCase(Locale.ROOT)));
            }
            if (filter.getSearch() != null && !filter.getSearch().isBlank()) {
                String pattern = "%" + filter.getSearch().trim().toLowerCase(Locale.ROOT) + "%";
                var author = root.join("author", jakarta.persistence.criteria.JoinType.LEFT);
                predicates.add(builder.or(
                        builder.like(builder.lower(root.get("name")), pattern),
                        builder.like(builder.lower(author.get("fullName")), pattern)));
            }

            String length = filter.getLength() == null ? "ANY" : filter.getLength().toUpperCase(Locale.ROOT);
            switch (length) {
                case "SHORT" -> predicates.add(builder.lessThan(root.get("estimatedDuration"), 10));
                case "MEDIUM" -> predicates.add(builder.between(root.get("estimatedDuration"), 10, 20));
                case "LONG" -> predicates.add(builder.greaterThan(root.get("estimatedDuration"), 20));
                default -> {
                }
            }
            return builder.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }
}
