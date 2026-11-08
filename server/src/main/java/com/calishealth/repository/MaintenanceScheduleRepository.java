package com.calishealth.repository;

import com.calishealth.models.MaintenanceSchedule;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    /**
     * Lists schedules with the optional admin filters applied.
     *
     * <p>The date filter matches the day the maintenance <b>starts</b>: a schedule that
     * starts at 11pm on the 20th and ends at 2am on the 21st is returned for the 20th.
     *
     * <p>The order keeps the schedules that need attention on top:
     * <ol>
     *   <li>đang thực hiện — admin đã bấm bắt đầu bảo trì,</li>
     *   <li>đã đến giờ — trong khoảng 30 phút trước giờ bắt đầu hoặc đang trong khung bảo trì,</li>
     *   <li>chưa đến giờ,</li>
     *   <li>đã hoàn tất / đã huỷ.</li>
     * </ol>
     */
    @Query(value = """
            select schedule from MaintenanceSchedule schedule
            where (:title is null or lower(schedule.title) like lower(concat('%', :title, '%')))
              and (:startsFrom is null or schedule.startsAt >= :startsFrom)
              and (:startsBefore is null or schedule.startsAt < :startsBefore)
            order by
              case when schedule.cancelled = false
                    and schedule.startedAt is not null
                    and schedule.completedAt is null then 0
                   when schedule.cancelled = false
                    and schedule.completedAt is null
                    and schedule.startsAt <= :readyBefore then 1
                   when schedule.cancelled = false
                    and schedule.completedAt is null then 2
                   else 3 end,
              schedule.startsAt asc
            """,
            countQuery = """
            select count(schedule) from MaintenanceSchedule schedule
            where (:title is null or lower(schedule.title) like lower(concat('%', :title, '%')))
              and (:startsFrom is null or schedule.startsAt >= :startsFrom)
              and (:startsBefore is null or schedule.startsAt < :startsBefore)
            """)
    Page<MaintenanceSchedule> searchSchedules(
            @Param("title") String title,
            @Param("startsFrom") LocalDateTime startsFrom,
            @Param("startsBefore") LocalDateTime startsBefore,
            @Param("readyBefore") LocalDateTime readyBefore,
            Pageable pageable
    );
}
