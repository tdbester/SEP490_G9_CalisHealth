package com.calishealth.repository;

import com.calishealth.models.MemberSchedule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface MemberScheduleRepository extends JpaRepository<MemberSchedule, Long> {
    Optional<MemberSchedule> findByUserIdAndPlanMonth(Long userId, LocalDate planMonth);

    List<MemberSchedule> findByUserIdOrderByPlanMonthDesc(Long userId);
}
