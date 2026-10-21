package com.calishealth.models;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "activity_logs")
@Getter @Setter @NoArgsConstructor
public class ActivityLog {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String action;

    /** Tên cột trong DB là `create_at` (typo có sẵn trong schema). */
    @Column(name = "create_at")
    private LocalDateTime createAt;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private User user;
}