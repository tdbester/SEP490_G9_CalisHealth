package com.calishealth.repository;

import com.calishealth.models.BenchmarkCriterion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BenchmarkCriterionRepository extends JpaRepository<BenchmarkCriterion, Long> {
    List<BenchmarkCriterion> findAllByBenchmarkSlotIn(List<String> slots);
    List<BenchmarkCriterion> findAllByFitnessLevel_NameIgnoreCase(String level);
    List<BenchmarkCriterion> findAllByBenchmarkSlotInAndFitnessLevel_NameIgnoreCase(List<String> slots, String level);
    Optional<BenchmarkCriterion> findByFitnessLevel_NameIgnoreCaseAndBenchmarkSlot(String level, String slot);
    void deleteAllByBenchmarkSlotIn(List<String> slots);
}
