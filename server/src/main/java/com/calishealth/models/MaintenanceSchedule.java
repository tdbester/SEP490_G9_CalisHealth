package com.calishealth.models;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "maintenance_schedules")
@Getter
@Setter
@NoArgsConstructor
public class MaintenanceSchedule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String message;

    @Column(name = "starts_at", nullable = false)
    private LocalDateTime startsAt;

    @Column(name = "ends_at", nullable = false)
    private LocalDateTime endsAt;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "maintenance_schedule_areas",
            joinColumns = @JoinColumn(name = "schedule_id")
    )
    @Column(name = "area", nullable = false, length = 40)
    private Set<String> affectedAreas = new LinkedHashSet<>();

    @Column(name = "notify_members", nullable = false)
    private boolean notifyMembers = true;

    @Column(name = "reminder_hours", nullable = false)
    private int reminderHours = 24;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "notification_id")
    private Long notificationId;

    @Column(nullable = false)
    private boolean cancelled;

    @Column(name = "reminder_sent", nullable = false)
    private boolean reminderSent;

    @Column(name = "reminder_notification_id")
    private Long reminderNotificationId;

    /** Set when an admin actually starts the maintenance work by hand. */
    @Column(name = "started_at")
    private LocalDateTime startedAt;

    /** Set when an admin marks the maintenance work as finished. */
    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "started_by")
    private Long startedBy;

    @Column(name = "completed_by")
    private Long completedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @jakarta.persistence.PrePersist
    void setCreatedAt() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
