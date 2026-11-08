package com.calishealth.models;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Manual maintenance lock for a single service area.
 *
 * <p>The maintenance schedule only notifies users. An admin turns the lock on by hand
 * when the maintenance window actually starts and turns it off once the work is done.
 */
@Entity
@Table(name = "maintenance_area_locks")
@Getter
@Setter
@NoArgsConstructor
public class MaintenanceAreaLock {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 40)
    private String area;

    @Column(nullable = false)
    private boolean locked;

    @Column(length = 255)
    private String reason;

    @Column(name = "schedule_id")
    private Long scheduleId;

    @Column(name = "locked_at", nullable = false)
    private LocalDateTime lockedAt;

    @Column(name = "unlocked_at")
    private LocalDateTime unlockedAt;

    @Column(name = "locked_by")
    private Long lockedBy;
}
