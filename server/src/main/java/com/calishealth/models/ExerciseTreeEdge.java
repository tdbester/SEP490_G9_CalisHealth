package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "exercise_tree_edges")
@Getter
@Setter
@NoArgsConstructor
public class ExerciseTreeEdge {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "parent_exercise_id", nullable = false)
    private Long parentExerciseId;

    @Column(name = "child_exercise_id", nullable = false)
    private Long childExerciseId;
}
