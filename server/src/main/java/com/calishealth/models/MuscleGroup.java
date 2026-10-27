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

    @Column(name = "dashboard_code", nullable = false, unique = true, length = 40)
    private String dashboardCode;

    @Column(name = "icon_key", nullable = false, length = 40)
    private String iconKey;

    @Column(nullable = false, length = 20)
    private String tone;

    @OneToMany(mappedBy = "muscleGroup")
    private List<ExerciseMuscleGroup> exercises = new ArrayList<>();
}
