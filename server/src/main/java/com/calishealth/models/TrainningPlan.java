package com.calishealth.models;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "trainning_plans")
@Getter @Setter @NoArgsConstructor
public class TrainningPlan {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String goal;

    private String planType;

    private String status;

    @ManyToOne
    @JoinColumn(name = "fitness_level_id")
    private FitnessLevel fitnessLevel;
}