package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "form_error_logs")
@Getter
@Setter
@NoArgsConstructor
public class FormErrorLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "rep_number", nullable = false)
    private Integer repNumber;

    @Column(name = "joint_angle", precision = 7, scale = 3)
    private BigDecimal jointAngle;

    @Column(name = "occurred_at", nullable = false)
    private LocalDateTime occurredAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_exercise_result_id", nullable = false)
    private SessionExerciseResult sessionExerciseResult;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "form_rule_id", nullable = false)
    private FormRule formRule;

    @PrePersist
    void setOccurredAtIfMissing() {
        if (occurredAt == null) {
            occurredAt = LocalDateTime.now();
        }
    }
}
