package com.calishealth.repository;

import com.calishealth.models.MemberSkillProgress;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MemberSkillProgressRepository extends JpaRepository<MemberSkillProgress, Long> {
    Optional<MemberSkillProgress> findByMemberProfile_IdAndExercise_Id(Long memberProfileId, Long exerciseId);

    long countByExercise_IdAndStatus(Long exerciseId, String status);
}
