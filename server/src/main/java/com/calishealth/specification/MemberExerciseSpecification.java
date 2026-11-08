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
            predicates.add(builder.equal(root.get("source"), "CUSTOM"));

            if ("MY_SUBMISSIONS".equals(filter.getTab())) {
                predicates.add(builder.equal(root.get("createdBy").get("id"), memberId));
                if (filter.getStatus() != null) {
                    if (filter.getStatus() == Exercise.EntryStatus.ACCEPTED) {
                        predicates.add(builder.upper(root.get("moderationStatus")).in("ACTIVE", "ACCEPTED"));
                    } else {
                        predicates.add(builder.equal(
                                builder.upper(root.get("moderationStatus")),
                                filter.getStatus().name()));
                    }
                }
            } else {
                predicates.add(builder.upper(root.get("moderationStatus")).in("ACTIVE", "ACCEPTED"));
                predicates.add(builder.isTrue(root.get("active")));
                predicates.add(builder.isTrue(root.get("shareWithCommunity")));
            }

            if (filter.getLevel() != null && !filter.getLevel().isBlank()) {
                // Level do Content Manager đặt tên trong bảng fitness_levels; so khớp không phân biệt
                // hoa thường để client gửi "beginner" hay "Beginner" đều ra kết quả.
                predicates.add(builder.equal(
                        builder.lower(root.get("difficultyLevel")),
                        filter.getLevel().trim().toLowerCase(Locale.ROOT)));
            }

            if (filter.getSearch() != null && !filter.getSearch().isBlank()) {
                String pattern = "%" + filter.getSearch().trim().toLowerCase(Locale.ROOT) + "%";
                var author = root.join("createdBy", jakarta.persistence.criteria.JoinType.LEFT);
                predicates.add(builder.or(
                        builder.like(builder.lower(root.get("name")), pattern),
                        builder.like(builder.lower(author.get("fullName")), pattern)));
            }

            return builder.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }
}
