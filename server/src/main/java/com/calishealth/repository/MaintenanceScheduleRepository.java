package com.calishealth.repository;

import com.calishealth.models.MaintenanceSchedule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface MaintenanceScheduleRepository extends JpaRepository<MaintenanceSchedule, Long> {
    List<MaintenanceSchedule> findAllByOrderByStartsAtAsc();

    List<MaintenanceSchedule> findAllByCancelledFalseAndNotifyMembersTrueAndReminderSentFalseAndStartsAtBetween(
            LocalDateTime from,
            LocalDateTime to
    );
}
