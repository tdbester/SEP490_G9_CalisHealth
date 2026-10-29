package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "fitness_levels")
@Getter
@Setter
@NoArgsConstructor
public class FitnessLevel {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String name;

    @Column(name = "score_min", nullable = false)
    private int scoreMin;

    @Column(name = "score_max", nullable = false)
    private int scoreMax;

    @Column(nullable = false, length = 16)
    private String status = "ACTIVE";

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by")
    private User updatedBy;

    @PrePersist
    @PreUpdate
    void updateTimestamp() {
        updatedAt = LocalDateTime.now();
    }
}
