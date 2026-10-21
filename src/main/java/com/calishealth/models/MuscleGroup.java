package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "muscle_groups")
@Getter
@Setter
@NoArgsConstructor
public class MuscleGroup {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 80)
    private String name;

    @OneToMany(mappedBy = "muscleGroup")
    private List<ExerciseMuscleGroup> exercises = new ArrayList<>();
}
