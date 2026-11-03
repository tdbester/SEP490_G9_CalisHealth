package com.calishealth.models;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "notification_reads",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_notification_reads_user_notification",
                columnNames = {"user_id", "notification_id"}
        )
)
@Getter
@Setter
@NoArgsConstructor
public class NotificationRead {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "notification_id", nullable = false)
    private Long notificationId;

    @Column(name = "read_at", nullable = false)
    private LocalDateTime readAt;

    public NotificationRead(Long userId, Long notificationId) {
        this.userId = userId;
        this.notificationId = notificationId;
        this.readAt = LocalDateTime.now();
    }
}
