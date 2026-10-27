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

    /** Mã nghiệp vụ hiển thị/định danh trên URL của khu Content Manager. */
    @Column(nullable = false, unique = true, length = 30)
    private String code;

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

    /** Content Manager publish flag: false = đang chờ duyệt / đã ẩn khỏi thư viện. */
    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

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
