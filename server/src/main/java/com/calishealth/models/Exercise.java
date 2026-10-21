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
    public enum ExerciseType { EXERCISE, SKILL }
    public enum Category { STRENGTH, CARDIO }
    public enum Source { SYSTEM, MEMBER }
    public enum Status { DRAFT, PENDING_REVIEW, ACTIVE, REJECTED, INACTIVE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ExerciseType type = ExerciseType.EXERCISE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Category category = Category.STRENGTH;

    // 1 = Beginner, 2 = Intermediate, 3 = Advanced
    @Column(name = "difficulty_level", columnDefinition = "tinyint unsigned")
    private Integer difficultyLevel;

    @Column(columnDefinition = "TEXT")
    private String instructions;

    @Column(name = "execution_steps", columnDefinition = "TEXT")
    private String executionSteps;

    @Column(name = "safety_tips", columnDefinition = "TEXT")
    private String safetyTips;

    @Column(name = "anatomy_theory", columnDefinition = "TEXT")
    private String anatomyTheory;

    @Column(name = "video_url")
    private String videoUrl;

    @Column(name = "default_sets", columnDefinition = "tinyint unsigned")
    private Integer defaultSets;

    @Column(name = "default_reps", columnDefinition = "smallint unsigned")
    private Integer defaultReps;

    // seconds
    @Column(name = "default_rest", columnDefinition = "smallint unsigned")
    private Integer defaultRest;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Source source = Source.SYSTEM;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.DRAFT;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "demo_media_id")
    private MediaFile demoMedia;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @OneToMany(mappedBy = "exercise", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ExerciseMuscleGroup> muscleGroups = new ArrayList<>();

    @PrePersist
    @PreUpdate
    void updateTimestamp() {
        updatedAt = LocalDateTime.now();
    }
}