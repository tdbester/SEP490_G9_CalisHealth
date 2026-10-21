package com.calishealth.models;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@EqualsAndHashCode
public class ExerciseMuscleGroupId implements Serializable {
    @Column(name = "exercise_id")
    private Long exerciseId;

    @Column(name = "muscle_group_id")
    private Long muscleGroupId;
}
