package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Daily Training Plan Template: schedules existing workouts onto the training days of one
 * (level, days per week) combination. A day without an entry is a rest day.
 */
@Entity
@Table(name = "daily_plan_templates")
@Getter
@Setter
@NoArgsConstructor
public class DailyPlanTemplate {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 30)
    private String code;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, length = 30)
    private String level;

    @Column(name = "days_per_week", nullable = false)
    private int daysPerWeek = 3;

    @Column(nullable = false)
    private boolean active = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @ElementCollection
    @CollectionTable(name = "daily_plan_template_days", joinColumns = @JoinColumn(name = "template_id"))
    private List<DailyPlanDay> days = new ArrayList<>();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void updateTimestamp() {
        updatedAt = LocalDateTime.now();
    }
}
