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

    @Column(nullable = false, length = 20)
    private String source = "SYSTEM";

    @Column(nullable = false, length = 30)
    private String level;

    @Column(name = "month_number", nullable = false)
    private int monthNumber = 1;

    @Column(name = "days_per_week", nullable = false)
    private int daysPerWeek = 3;

    @Column(name = "day_sequence", nullable = false)
    private int daySequence = 1;

    @Column(name = "template_status", nullable = false, length = 20)
    private String templateStatus = "DRAFT";

    @Column(nullable = false)
    private boolean active = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    /** Bài tập theo thứ tự hiển thị, mỗi bài có count by / sets / reps hoặc duration / rest riêng. */
    @ElementCollection
    @CollectionTable(name = "workout_exercises", joinColumns = @JoinColumn(name = "workout_id"))
    @OrderColumn(name = "display_order")
    private List<WorkoutExerciseItem> exercises = new ArrayList<>();

    @OneToMany(mappedBy = "workout", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("dayOfWeek ASC, id ASC")
    private List<WorkoutPlanItem> planItems = new ArrayList<>();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void updateTimestamp() {
        updatedAt = LocalDateTime.now();
    }
}
