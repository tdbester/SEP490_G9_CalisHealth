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
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 40)
    private String status;

    @Column(name = "best_reps")
    private Integer bestReps;

    @Column(name = "best_accuracy", precision = 6, scale = 3)
    private BigDecimal bestAccuracy;

    @Column(name = "unlocked_at")
    private LocalDateTime unlockedAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exercise_id", nullable = false)
    private Exercise exercise;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_profile_id", nullable = false)
    private MemberProfile memberProfile;
}
