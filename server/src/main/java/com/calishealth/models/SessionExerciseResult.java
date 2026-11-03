package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "session_exercise_results")
@Getter
@Setter
@NoArgsConstructor
public class SessionExerciseResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sets_completed", nullable = false)
    private Integer setsCompleted;

    @Column(name = "valid_reps", nullable = false)
    private Integer validReps;

    @Column(name = "invalid_reps", nullable = false)
    private Integer invalidReps;

    @Column(precision = 6, scale = 3)
    private BigDecimal accuracy;

    @Column(name = "active_seconds", nullable = false)
    private Integer activeSeconds;

    @Column(name = "clean_seconds", nullable = false)
    private Integer cleanSeconds = 0;

    @Column(name = "workout_session_id", nullable = false)
    private Long workoutSessionId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exercise_id", nullable = false)
    private Exercise exercise;
}
