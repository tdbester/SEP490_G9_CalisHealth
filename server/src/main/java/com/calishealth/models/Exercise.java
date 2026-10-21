package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "exercises")
@Getter
@Setter
@NoArgsConstructor
public class Exercise {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, length = 40)
    private String type;

    @Column(length = 80)
    private String category;

    @Column(name = "difficulty_level", length = 40)
    private String difficultyLevel;

    @Column(columnDefinition = "TEXT")
    private String instructions;

    @Column(name = "execution_steps", columnDefinition = "TEXT")
    private String executionSteps;

    @Column(name = "safety_tips", columnDefinition = "TEXT")
    private String safetyTips;

    @Column(name = "anatomy_theory", columnDefinition = "TEXT")
    private String anatomyTheory;

    @Column(name = "video_url", length = 1000)
    private String videoUrl;

    @Column(name = "default_sets")
    private Integer defaultSets;

    @Column(name = "default_reps")
    private Integer defaultReps;

    @Column(name = "default_rest")
    private Integer defaultRest;

    @Column(length = 60)
    private String source;

    @Column(length = 40)
    private String status;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "demo_media_id")
    private MediaFile demoMedia;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @OneToMany(mappedBy = "exercise", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ExerciseMuscleGroup> muscleGroups = new ArrayList<>();

    @PrePersist
    @PreUpdate
    void updateTimestamp() {
        updatedAt = LocalDateTime.now();
    }
}
