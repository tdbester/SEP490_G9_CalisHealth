package com.calishealth.repository;

import com.calishealth.models.DailyPlanTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DailyPlanTemplateRepository extends JpaRepository<DailyPlanTemplate, Long> {
    Optional<DailyPlanTemplate> findByCode(String code);
}
