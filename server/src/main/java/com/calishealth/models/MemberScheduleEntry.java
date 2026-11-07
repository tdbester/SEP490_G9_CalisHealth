package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/**
 * Một workout (hoặc nhiều, khác orderInDay) được member thả vào một NGÀY cụ thể
 * trên lịch tháng.
 */
@Entity
@Table(name = "member_schedule_entries")
@Getter
@Setter
@NoArgsConstructor
public class MemberScheduleEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "schedule_id", nullable = false)
    private MemberSchedule schedule;

    @Column(name = "schedule_date", nullable = false)
    private LocalDate scheduleDate;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workout_id", nullable = false)
    private WorkoutEntry workout;

    /** Thứ tự trong ngày khi member xếp nhiều workout cho cùng một ngày. */
    @Column(name = "order_in_day", nullable = false)
    private int orderInDay = 0;

    /** PENDING | COMPLETED | SKIPPED */
    @Column(name = "status", nullable = false, length = 20)
    private String status = "PENDING";
}
