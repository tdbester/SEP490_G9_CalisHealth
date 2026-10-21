package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "exercise_variations")
@Getter
@Setter
@NoArgsConstructor
public class ExerciseVariation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 60)
    private String type;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exercise_id", nullable = false)
    private Exercise exercise;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "variant_exercise_id", nullable = false)
    private Exercise variantExercise;
}
