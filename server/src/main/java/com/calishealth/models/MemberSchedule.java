package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Lịch tập của member theo THÁNG (màn "Workout schedule" - Figma member-schedule).
 * Member kéo workout do Content Manager tạo vào từng ngày cụ thể trên lịch tháng.
 * Mỗi member có đúng một lịch cho mỗi tháng.
 */
@Entity
@Table(
        name = "member_schedules",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_member_schedules_user_month",
                columnNames = {"user_id", "plan_month"}
        )
)
@Getter
@Setter
@NoArgsConstructor
public class MemberSchedule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Ngày 1 của tháng mà lịch này thuộc về. */
    @Column(name = "plan_month", nullable = false)
    private LocalDate planMonth;

    /** Template gợi ý đã dùng (null nếu member tự xếp tay). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id")
    private DailyPlanTemplate template;

    @OneToMany(mappedBy = "schedule", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("scheduleDate ASC, orderInDay ASC")
    private List<MemberScheduleEntry> entries = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
