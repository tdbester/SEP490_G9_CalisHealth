package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Kết quả của một set trong một bài tập của buổi tập; dùng để tính % clean theo từng set. */
@Entity
@Table(name = "session_set_results")
@Getter
@Setter
@NoArgsConstructor
public class SessionSetResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "set_number", nullable = false)
    private Integer setNumber;

    @Column(name = "total_reps", nullable = false)
    private Integer totalReps = 0;

    @Column(name = "clean_reps", nullable = false)
    private Integer cleanReps = 0;

    @Column(name = "total_seconds", nullable = false)
    private Integer totalSeconds = 0;

    @Column(name = "clean_seconds", nullable = false)
    private Integer cleanSeconds = 0;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_exercise_result_id", nullable = false)
    private SessionExerciseResult sessionExerciseResult;
}
