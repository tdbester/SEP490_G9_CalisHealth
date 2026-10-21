package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "member_skill_progress")
@Getter
@Setter
@NoArgsConstructor
public class MemberSkillProgress {
    public enum Status { LOCKED, UNLOCKED, MASTERED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.LOCKED;

    @Column(name = "best_reps", nullable = false)
    private Integer bestReps = 0;

    @Column(name = "best_accuracy", nullable = false, precision = 5, scale = 2)
    private BigDecimal bestAccuracy = BigDecimal.ZERO;

    @Column(name = "unlocked_at")
    private LocalDateTime unlockedAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exercise_id", nullable = false)
    private Exercise exercise;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_profile_id", nullable = false)
    private MemberProfile memberProfile;
}