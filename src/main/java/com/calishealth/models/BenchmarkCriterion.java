package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "benchmark_criteria")
@Getter
@Setter
@NoArgsConstructor
public class BenchmarkCriterion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "min_value", nullable = false, precision = 10, scale = 2)
    private BigDecimal minValue;

    @Column(name = "criterion_weight", nullable = false, precision = 8, scale = 3)
    private BigDecimal criterionWeight;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exercise_id", nullable = false)
    private Exercise exercise;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fitness_level_id", nullable = false)
    private FitnessLevel fitnessLevel;
}
