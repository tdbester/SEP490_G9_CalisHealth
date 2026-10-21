package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "workout_plan_items")
@Getter
@Setter
@NoArgsConstructor
public class WorkoutPlanItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workout_id", nullable = false)
    private WorkoutEntry workout;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exercise_id", nullable = false)
    private ExerciseEntry exercise;

    @Column(name = "day_of_week", nullable = false)
    private int dayOfWeek;

    @Column(name = "beginner_sets", nullable = false)
    private int beginnerSets;

    @Column(name = "beginner_reps", nullable = false)
    private int beginnerReps;

    @Column(name = "intermediate_sets", nullable = false)
    private int intermediateSets;

    @Column(name = "intermediate_reps", nullable = false)
    private int intermediateReps;

    @Column(name = "advanced_sets", nullable = false)
    private int advancedSets;

    @Column(name = "advanced_reps", nullable = false)
    private int advancedReps;
}
