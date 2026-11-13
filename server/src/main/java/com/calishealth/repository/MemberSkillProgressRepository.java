package com.calishealth.repository;

import com.calishealth.models.MemberSkillProgress;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MemberSkillProgressRepository extends JpaRepository<MemberSkillProgress, Long> {
    Optional<MemberSkillProgress> findByMemberProfile_IdAndExercise_Id(Long memberProfileId, Long exerciseId);

    /** Tiến độ của member trên nhiều bài — dùng để dựng trạng thái cây bài tập. */
    List<MemberSkillProgress> findAllByMemberProfile_IdAndExercise_IdIn(Long memberProfileId, Collection<Long> exerciseIds);

    long countByExercise_IdAndStatus(Long exerciseId, String status);
}
