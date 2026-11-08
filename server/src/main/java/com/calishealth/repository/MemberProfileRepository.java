package com.calishealth.repository;

import com.calishealth.models.MemberProfile;
import com.calishealth.models.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MemberProfileRepository extends JpaRepository<MemberProfile, Long> {
    Optional<MemberProfile> findByUserId(Long userId);
    Optional<MemberProfile> findByUser_Id(Long userId);
    Optional<MemberProfile> findByUser_Email(String email);
    long countByFitnessLevel_Id(Long fitnessLevelId);

    /**
     * Profiles whose owning account has the given role. The weekly leaderboard
     * only ranks accounts with role = MEMBER; content managers and admins may
     * still own a member_profiles row from legacy data but must never be
     * ranked against real members.
     */
    List<MemberProfile> findAllByUser_Role(UserRole role);
}
