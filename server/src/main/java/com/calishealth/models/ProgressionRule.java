package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "progression_rules")
@Getter
@Setter
@NoArgsConstructor
public class ProgressionRule {
    public enum Relationship { PROGRESSION, REGRESSION }
    public enum Status { ACTIVE, INACTIVE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "rule_name", length = 100)
    private String ruleName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Relationship relationship = Relationship.PROGRESSION;

    @Column(name = "required_reps")
    private Integer requiredReps;

    // percent, 0-100
    @Column(name = "min_accuracy", columnDefinition = "tinyint unsigned")
    private Integer minAccuracy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.ACTIVE;

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