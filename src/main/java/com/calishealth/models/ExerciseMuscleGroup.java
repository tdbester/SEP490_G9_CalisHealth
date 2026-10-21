package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "exercise_muscle_groups")
@Getter
@Setter
@NoArgsConstructor
public class ExerciseMuscleGroup {
    @EmbeddedId
    private ExerciseMuscleGroupId id = new ExerciseMuscleGroupId();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("exerciseId")
    @JoinColumn(name = "exercise_id", nullable = false)
    private Exercise exercise;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("muscleGroupId")
    @JoinColumn(name = "muscle_group_id", nullable = false)
    private MuscleGroup muscleGroup;
}
