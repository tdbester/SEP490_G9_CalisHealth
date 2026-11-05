package com.calishealth.repository;

import com.calishealth.models.MaintenanceSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

public interface MaintenanceScheduleRepository extends JpaRepository<MaintenanceSchedule, Long> {
    List<MaintenanceSchedule> findAllByOrderByStartsAtAsc();

    List<MaintenanceSchedule> findAllByCancelledFalseAndNotifyMembersTrueAndReminderSentFalseAndStartsAtBetween(
            LocalDateTime from,
            LocalDateTime to
    );

    @Query("""
            select count(schedule)
            from MaintenanceSchedule schedule
            join schedule.affectedAreas area
            where area = :area
              and schedule.cancelled = false
              and schedule.startsAt <= :now
              and schedule.endsAt >= :now
            """)
    long countActiveSchedulesByArea(@Param("area") String area, @Param("now") LocalDateTime now);

    @Query("""
            select distinct area
            from MaintenanceSchedule schedule
            join schedule.affectedAreas area
            where schedule.cancelled = false
              and schedule.startsAt <= :now
              and schedule.endsAt >= :now
            """)
    Set<String> findActiveAreas(@Param("now") LocalDateTime now);
}
