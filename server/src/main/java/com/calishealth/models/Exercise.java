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

    /** Mã nghiệp vụ hiển thị/định danh trên URL của khu Content Manager. */
    @Column(nullable = false, unique = true, length = 30)
    private String code;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

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

    @Column(name = "video_url", length = 1000)
    private String videoUrl;

    @Column(name = "anatomy_image_url", length = 1000)
    private String anatomyImageUrl;

    @Column(name = "default_sets")
    private Integer defaultSets;

    @Column(name = "default_reps")
    private Integer defaultReps;

    /** Thời lượng thực hiện tính bằng giây, dùng cho bài tập theo thời gian. */
    @Column(name = "duration")
    private Integer duration;

    @Column(length = 60)
    private String source;

    @Column(name = "moderation_status", length = 40)
    private String moderationStatus;

    @Column(name = "status", length = 20)
    private String status;

    /** Content Manager publish flag: false = đang chờ duyệt / đã ẩn khỏi thư viện. */
    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "is_system", nullable = false)
    private boolean system = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id")
    private User author;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "save_count")
    private Integer saveCount = 0;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(name = "guide_steps", columnDefinition = "TEXT")
    private String guideSteps;

    @Column(name = "share_with_community", nullable = false)
    private boolean shareWithCommunity;

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

    @Column(name = "muscle_group", length = 120)
    private String muscleGroup;

    @Column(name = "level", length = 30)
    private String level;

    @Column(columnDefinition = "TEXT")
    private String guide;

    @OneToMany(mappedBy = "exercise", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ExerciseMuscleGroup> muscleGroups = new ArrayList<>();

    @PrePersist
    @PreUpdate
    void updateTimestamp() {
        updatedAt = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = updatedAt;
        }
        if (status == null) {
            status = "ACCEPTED";
        }
        if (moderationStatus == null) {
            moderationStatus = toModerationStatus(status);
        }
        if (source == null) {
            source = system ? "SYSTEM" : "CUSTOM";
        } else if ("MEMBER".equalsIgnoreCase(source)) {
            source = "CUSTOM";
        }
        if (level == null) {
            level = difficultyLevel;
        }
        if (guide == null) {
            guide = executionSteps;
        }
        if (guideSteps == null) {
            guideSteps = executionSteps;
        }
        if (saveCount == null) {
            saveCount = 0;
        }
    }

    public boolean isSystem() {
        return system;
    }

    public void setSystem(boolean system) {
        this.system = system;
        if (source == null || "SYSTEM".equalsIgnoreCase(source) || "CUSTOM".equalsIgnoreCase(source)) {
            source = system ? "SYSTEM" : "CUSTOM";
        }
    }

    public Long getAuthorId() {
        return author != null ? author.getId() : null;
    }

    public void setDemoVideoUrl(String demoVideoUrl) {
        this.videoUrl = demoVideoUrl;
    }

    public String getDemoVideoUrl() {
        return videoUrl;
    }

    public void setType(EntryType type) {
        this.type = type == null ? null : type.name();
    }

    public void setType(String type) {
        this.type = type;
    }

    public void setStatus(EntryStatus status) {
        setStatus(status == null ? null : status.name());
    }

    public void setStatus(String status) {
        this.status = status;
        if (status != null) {
            this.moderationStatus = toModerationStatus(status);
        }
    }

    public void setLevel(EntryLevel level) {
        this.level = level == null ? null : level.name();
    }

    public void setLevel(String level) {
        this.level = level;
    }

    private String toModerationStatus(String status) {
        return switch (status) {
            case "ACCEPTED" -> "ACTIVE";
            case "PENDING" -> "PENDING";
            case "REJECTED" -> "REJECTED";
            default -> status;
        };
    }
}
