package com.calishealth.repository;

import com.calishealth.models.MemberProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MemberProfileRepository extends JpaRepository<MemberProfile, Long> {
    Optional<MemberProfile> findByUserId(Long userId);
    Optional<MemberProfile> findByUser_Id(Long userId);
    long countByFitnessLevel_Id(Long fitnessLevelId);
}
