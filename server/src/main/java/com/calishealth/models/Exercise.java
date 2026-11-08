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
    public enum EntryStatus { ACCEPTED, PENDING, REJECTED }
    public enum EntryGoal { LOSE_WEIGHT, BUILD_MUSCLE, STAY_FIT }
    public enum EntryTargetSkill { HANDSTAND, MUSCLE_UP, FRONT_LEVER, PLANCHE }
    public enum MovementGroup { PUSH, PULL, LEGS, CORE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Mã nghiệp vụ hiển thị/định danh trên URL của khu Content Manager. */
    @Column(nullable = false, unique = true, length = 30)
    private String code;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, length = 40)
    private String type;

    @Column(nullable = false, length = 80)
    private String category = "REPS";

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

    @Column(nullable = false, length = 60)
    private String source = "SYSTEM";

    @Column(name = "moderation_status", length = 40)
    private String moderationStatus;

    /** Content Manager publish flag: false = đang chờ duyệt / đã ẩn khỏi thư viện. */
    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "save_count")
    private Integer saveCount = 0;

    @Column(name = "share_with_community", nullable = false)
    private boolean shareWithCommunity;

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

    @Column(length = 255)
    private String icon;

    @OneToMany(mappedBy = "exercise", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ExerciseMuscleGroup> muscleGroups = new ArrayList<>();

    @Transient
    private String muscleGroupInput;

    @PrePersist
    @PreUpdate
    void updateTimestamp() {
        updatedAt = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = updatedAt;
        }
        if (moderationStatus == null) {
            moderationStatus = "ACTIVE";
        }
        source = normalizeSource(source);
        if (saveCount == null) {
            saveCount = 0;
        }
    }

    public boolean isSystem() {
        return source == null || "SYSTEM".equalsIgnoreCase(source);
    }

    public void setSystem(boolean system) {
        source = system ? "SYSTEM" : "CUSTOM";
    }

    public Long getAuthorId() {
        return createdBy != null ? createdBy.getId() : null;
    }

    public User getAuthor() {
        return createdBy;
    }

    public void setAuthor(User author) {
        this.createdBy = author;
    }

    public void setSource(String source) {
        this.source = normalizeSource(source);
    }

    public String getDescription() {
        return instructions;
    }

    public void setDescription(String description) {
        this.instructions = description;
    }

    public String getMuscleGroup() {
        List<String> names = muscleGroups.stream()
                .map(ExerciseMuscleGroup::getMuscleGroup)
                .filter(java.util.Objects::nonNull)
                .map(MuscleGroup::getName)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        return names.isEmpty() ? muscleGroupInput : String.join(", ", names);
    }

    public void setMuscleGroup(String muscleGroup) {
        this.muscleGroupInput = muscleGroup;
    }

    public String getLevel() {
        return difficultyLevel;
    }

    public void setLevel(String level) {
        this.difficultyLevel = level;
    }

    public String getGuide() {
        return executionSteps;
    }

    public void setGuide(String guide) {
        this.executionSteps = guide;
    }

    public String getGuideSteps() {
        return executionSteps;
    }

    public void setGuideSteps(String guideSteps) {
        this.executionSteps = guideSteps;
    }

    public Integer getDefaultDuration() {
        return duration;
    }

    public void setDefaultDuration(Integer defaultDuration) {
        this.duration = defaultDuration;
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

    @Transient
    public String getStatus() {
        return switch (moderationStatus == null ? "" : moderationStatus.toUpperCase(java.util.Locale.ROOT)) {
            case "PENDING" -> EntryStatus.PENDING.name();
            case "REJECTED" -> EntryStatus.REJECTED.name();
            default -> EntryStatus.ACCEPTED.name();
        };
    }

    @Transient
    public void setStatus(EntryStatus status) {
        setStatus(status == null ? null : status.name());
    }

    @Transient
    public void setStatus(String status) {
        if (status == null) {
            this.moderationStatus = null;
            return;
        }
        this.moderationStatus = switch (status.toUpperCase(java.util.Locale.ROOT)) {
            case "ACCEPTED", "ACTIVE" -> "ACTIVE";
            case "PENDING" -> "PENDING";
            case "REJECTED" -> "REJECTED";
            default -> status;
        };
    }

    private static String normalizeSource(String source) {
        if (source == null || source.isBlank()) {
            return "SYSTEM";
        }
        String normalized = source.trim().toUpperCase(java.util.Locale.ROOT);
        return "MEMBER".equals(normalized) ? "CUSTOM" : normalized;
    }
}
