package com.calishealth.repository;

import com.calishealth.models.Exercise;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ExerciseRepository extends JpaRepository<Exercise, Long> {
    Optional<Exercise> findByCode(String code);
    boolean existsByCode(String code);
    List<Exercise> findAllByCodeIn(List<String> codes);
    Optional<Exercise> findByNameIgnoreCase(String name);

    /** True when a (not soft-deleted) exercise is still tagged with this level name. */
    @Query("select count(e) > 0 from Exercise e where lower(e.difficultyLevel) = lower(:level) "
            + "and (e.moderationStatus is null or upper(e.moderationStatus) <> 'DELETED')")
    boolean existsInUseByDifficultyLevel(@Param("level") String level);
}
