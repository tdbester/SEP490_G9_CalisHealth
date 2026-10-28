package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "workout_entries")
@Getter
@Setter
@NoArgsConstructor
public class WorkoutEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 30)
    private String code;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 40)
    private String type = "WORKOUT";

    @Column(name = "is_system", nullable = false)
    private boolean isSystem = true;

    @Column(name = "author_id")
    private Long authorId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", insertable = false, updatable = false)
    private User author;

    @Column(nullable = false, length = 20)
    private String source = "SYSTEM";

    @Column(name = "rest_seconds", nullable = false)
    private int restSeconds = 60;

    @Column(nullable = false, length = 30)
    private String level;

    @Column(name = "is_shared_with_community", nullable = false)
    private boolean sharedWithCommunity;

    @Column(nullable = false, length = 20)
    private String status = "ACCEPTED";

    @Column(name = "save_count", nullable = false)
    private Integer saveCount = 0;

    @Column(name = "total_sets", nullable = false)
    private Integer totalSets = 0;

    @Column(name = "estimated_duration", nullable = false)
    private Integer estimatedDuration = 0;

    @Column(nullable = false)
    private boolean active = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @ManyToMany
    @JoinTable(
            name = "workout_exercises",
            joinColumns = @JoinColumn(name = "workout_id"),
            inverseJoinColumns = @JoinColumn(name = "exercise_id")
    )
    @OrderColumn(name = "display_order")
    private List<Exercise> exercises = new ArrayList<>();

    @OneToMany(mappedBy = "workout", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("dayOfWeek ASC, id ASC")
    private List<WorkoutPlanItem> planItems = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

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
        if (totalSets == null) {
            totalSets = 0;
        }
        if (estimatedDuration == null) {
            estimatedDuration = 0;
        }
    }
}
