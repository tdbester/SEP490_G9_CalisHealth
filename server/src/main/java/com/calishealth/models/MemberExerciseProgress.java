package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "member_exercise_progress")
@Getter
@Setter
@NoArgsConstructor
public class MemberExerciseProgress {
    public enum ProgressStatus { MASTERED, CURRENT, LOCKED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    @Column(name = "exercise_id", nullable = false)
    private Long exerciseId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProgressStatus status;
}
