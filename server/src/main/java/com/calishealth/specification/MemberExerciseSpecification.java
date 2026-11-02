package com.calishealth.specification;

import com.calishealth.dtos.MemberExerciseFilterRequestDTO;
import com.calishealth.models.Exercise;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class MemberExerciseSpecification {
    private MemberExerciseSpecification() {}

    public static Specification<Exercise> withFilters(
            MemberExerciseFilterRequestDTO filter,
            Long memberId
    ) {
        return (root, query, builder) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            predicates.add(builder.isFalse(root.get("system")));

            if ("MY_SUBMISSIONS".equals(filter.getTab())) {
                predicates.add(builder.equal(root.get("author").get("id"), memberId));
                if (filter.getStatus() != null) {
                    predicates.add(builder.equal(root.get("status"), filter.getStatus().name()));
                }
            } else {
                predicates.add(builder.equal(root.get("status"), "ACCEPTED"));
                predicates.add(builder.isTrue(root.get("shareWithCommunity")));
            }

            if (filter.getLevel() != null) {
                predicates.add(builder.equal(root.get("level"), filter.getLevel().name()));
            }

            if (filter.getSearch() != null && !filter.getSearch().isBlank()) {
                String pattern = "%" + filter.getSearch().trim().toLowerCase(Locale.ROOT) + "%";
                var author = root.join("author", jakarta.persistence.criteria.JoinType.LEFT);
                predicates.add(builder.or(
                        builder.like(builder.lower(root.get("name")), pattern),
                        builder.like(builder.lower(author.get("fullName")), pattern)));
            }

            return builder.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }
}
