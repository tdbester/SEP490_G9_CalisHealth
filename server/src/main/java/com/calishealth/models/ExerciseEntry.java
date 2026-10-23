package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "exercise_entries")
@Getter
@Setter
@NoArgsConstructor
public class ExerciseEntry {
    public enum EntryType { HEALTH, SKILL }
    public enum EntryLevel { BEGINNER, INTERMEDIATE, ADVANCED }
    public enum EntryStatus { ACCEPTED, PENDING, REJECTED }
    public enum EntryGoal { LOSE_WEIGHT, BUILD_MUSCLE, STAY_FIT }
    public enum EntryTargetSkill { HANDSTAND, MUSCLE_UP, FRONT_LEVER, PLANCHE }
    public enum MovementGroup { PUSH, PULL, LEGS, CORE }
    public enum TreeDifficulty { BEGINNER, INTERMEDIATE, ADVANCED, EXPERT }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 30)
    private String code;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EntryType type;

    @Column(name = "is_system", nullable = false)
    private boolean isSystem = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id")
    private User author;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "save_count", nullable = false)
    private Integer saveCount = 0;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(name = "guide_steps", columnDefinition = "TEXT")
    private String guideSteps;

    @Column(name = "video_url", length = 255)
    private String videoUrl;

    @Column(name = "share_with_community", nullable = false)
    private boolean shareWithCommunity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EntryStatus status = EntryStatus.ACCEPTED;

    @Column(name = "default_sets")
    private Integer defaultSets;

    @Column(name = "default_reps")
    private Integer defaultReps;

    @Column(name = "default_duration")
    private Integer defaultDuration;

    @Column(length = 60)
    private String equipment;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private EntryGoal goal;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_skill", length = 30)
    private EntryTargetSkill targetSkill;

    @Column(name = "exercise_tree_id")
    private Long exerciseTreeId;

    @Enumerated(EnumType.STRING)
    @Column(name = "movement_group", length = 20)
    private MovementGroup movementGroup;

    @Column(name = "tree_level")
    private Integer treeLevel;

    @Enumerated(EnumType.STRING)
    @Column(name = "difficulty", length = 20)
    private TreeDifficulty difficulty;

    @Column(length = 255)
    private String icon;

    @Column(length = 80)
    private String category;

    @Column(name = "muscle_group", nullable = false, length = 120)
    private String muscleGroup;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private EntryLevel level;

    @Column(nullable = false)
    private boolean active = true;

    @Column(columnDefinition = "TEXT")
    private String guide;

    @Column(name = "demo_video_url", length = 1000)
    private String demoVideoUrl;

    @Column(name = "anatomy_image_url", length = 1000)
    private String anatomyImageUrl;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void updateTimestamp() {
        updatedAt = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = updatedAt;
        }
        if (saveCount == null) {
            saveCount = 0;
        }
    }
}
