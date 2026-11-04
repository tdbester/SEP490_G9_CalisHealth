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

    /** Moderation status of every exercise that uses this video or anatomy image. */
    @Query("select coalesce(e.moderationStatus, 'ACTIVE') from Exercise e where e.videoUrl = :url or e.anatomyImageUrl = :url")
    List<String> findModerationStatusesUsingMedia(@Param("url") String url);

    /** [videoUrl, anatomyImageUrl, moderationStatus, creator id] of every exercise that has media. */
    @Query("select e.videoUrl, e.anatomyImageUrl, coalesce(e.moderationStatus, 'ACTIVE'), u.id from Exercise e "
            + "left join e.createdBy u where e.videoUrl is not null or e.anatomyImageUrl is not null")
    List<Object[]> findMediaReferences();
}
