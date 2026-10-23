package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "member_saved_exercises")
@Getter
@Setter
@NoArgsConstructor
public class MemberSavedExercise {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    @Column(name = "exercise_id", nullable = false)
    private Long exerciseId;

    @Column(name = "saved_at", nullable = false)
    private LocalDateTime savedAt;
}
