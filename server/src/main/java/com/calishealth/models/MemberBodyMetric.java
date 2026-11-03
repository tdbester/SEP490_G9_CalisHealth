package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "member_body_metrics")
@Getter
@Setter
@NoArgsConstructor
public class MemberBodyMetric {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_profile_id", nullable = false)
    private MemberProfile memberProfile;

    @Column(name = "weight_kg", precision = 5, scale = 2, nullable = false)
    private BigDecimal weightKg;

    @Column(name = "height_cm", precision = 5, scale = 2, nullable = false)
    private BigDecimal heightCm;

    @Column(precision = 4, scale = 1, nullable = false)
    private BigDecimal bmi;

    @Column(name = "recorded_at", nullable = false)
    private LocalDateTime recordedAt;

    @Column(length = 255)
    private String note;

    @PrePersist
    void prePersist() {
        if (recordedAt == null) {
            recordedAt = LocalDateTime.now();
        }
    }
}
