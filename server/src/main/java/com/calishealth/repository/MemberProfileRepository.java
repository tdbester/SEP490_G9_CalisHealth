package com.calishealth.repository;

import com.calishealth.models.MemberProfile;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemberProfileRepository extends JpaRepository<MemberProfile, Long> {
}
