package com.calishealth.repository;

import com.calishealth.models.ExerciseEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;

public interface ExerciseRepository extends JpaRepository<ExerciseEntry, Long>, JpaSpecificationExecutor<ExerciseEntry> {
    Optional<ExerciseEntry> findByCode(String code);
    Optional<ExerciseEntry> findByIdAndIsSystemTrueAndStatus(Long id, ExerciseEntry.EntryStatus status);
    List<ExerciseEntry> findAllByMovementGroupAndIsSystemTrueAndStatus(
            ExerciseEntry.MovementGroup movementGroup,
            ExerciseEntry.EntryStatus status);
    boolean existsByNameIgnoreCaseAndIsSystemFalse(String name);
    boolean existsByCode(String code);
    Optional<ExerciseEntry> findByIdAndAuthor_IdAndIsSystemFalse(Long id, Long authorId);
    long countByAuthor_IdAndIsSystemFalseAndStatus(Long authorId, ExerciseEntry.EntryStatus status);
    List<ExerciseEntry> findAllByCodeIn(List<String> codes);
    long countByTypeAndIsSystemTrueAndStatus(ExerciseEntry.EntryType type, ExerciseEntry.EntryStatus status);
    long countByTypeAndActive(ExerciseEntry.EntryType type, boolean active);
    long countByType(ExerciseEntry.EntryType type);
}
