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
     * Profiles whose owning account has the given role. Every account owns one profile row (V81),
     * but the weekly leaderboard only ranks accounts with role = MEMBER: content managers and admins
     * keep a row for their personal details and must never be ranked against real members.
     */
    List<MemberProfile> findAllByUser_Role(UserRole role);
}
