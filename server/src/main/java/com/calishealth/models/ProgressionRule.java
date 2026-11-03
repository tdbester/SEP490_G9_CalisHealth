package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "progression_rules")
@Getter
@Setter
@NoArgsConstructor
public class ProgressionRule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "rule_name", nullable = false, length = 150)
    private String ruleName;

    @Column(length = 100)
    private String relationship;

    @Column(name = "required_reps")
    private Integer requiredReps;

    @Column(name = "min_accuracy", precision = 6, scale = 3)
    private BigDecimal minAccuracy;

    /** REPS hoặc HOLD, theo cách đo của bài prerequisite. */
    @Column(name = "measure_type", nullable = false, length = 16)
    private String measureType = "REPS";

    @Column(name = "required_sets", nullable = false)
    private int requiredSets = 1;

    /** Giây tối thiểu mỗi set, chỉ dùng khi measureType = HOLD. */
    @Column(name = "required_seconds")
    private Integer requiredSeconds;

    @Column(length = 40)
    private String status;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exercise_id", nullable = false)
    private Exercise exercise;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "prerequisite_exercise_id", nullable = false)
    private Exercise prerequisiteExercise;

    @PrePersist
    @PreUpdate
    void updateTimestamp() {
        updatedAt = LocalDateTime.now();
    }
}
