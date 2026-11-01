package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Một dòng của bảng workout_exercises: bài tập trong workout kèm cấu hình riêng.
 * Cách đếm do exercises.category quyết định: HOLD dùng durationSeconds, còn lại dùng reps.
 * restSeconds là nghỉ giữa các hiệp.
 */
@Embeddable
@Getter
@Setter
@NoArgsConstructor
public class WorkoutExerciseItem {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exercise_id", nullable = false)
    private Exercise exercise;

    @Column(name = "sets", nullable = false)
    private int sets = 3;

    @Column(name = "reps")
    private Integer reps;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Column(name = "rest_seconds", nullable = false)
    private int restSeconds = 60;
}
