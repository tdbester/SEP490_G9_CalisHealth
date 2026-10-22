package com.calishealth.repository;

import com.calishealth.models.AssessmentOption;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface AssessmentOptionRepository extends JpaRepository<AssessmentOption, Long> {
    List<AssessmentOption> findByQuestionIdInOrderBySortOrderAsc(Collection<Long> questionIds);
}
