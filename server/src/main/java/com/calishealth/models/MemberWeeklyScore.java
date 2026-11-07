package com.calishealth.models;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "member_weekly_scores", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"member_id", "week_start", "fitness_level_id"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MemberWeeklyScore {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private MemberProfile member;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fitness_level_id")
    private FitnessLevel fitnessLevel;

    @Column(name = "sessions_score", precision = 10, scale = 2)
    private BigDecimal sessionsScore = BigDecimal.ZERO;

    @Column(name = "time_score", precision = 10, scale = 2)
    private BigDecimal timeScore = BigDecimal.ZERO;

    @Column(name = "accuracy_score", precision = 10, scale = 2)
    private BigDecimal accuracyScore = BigDecimal.ZERO;

    @Column(name = "rest_day_bonus", precision = 10, scale = 2)
    private BigDecimal restDayBonus = BigDecimal.ZERO;

    @Column(name = "streak_bonus", precision = 10, scale = 2)
    private BigDecimal streakBonus = BigDecimal.ZERO;

    @Column(name = "total_score", precision = 10, scale = 2)
    private BigDecimal totalScore = BigDecimal.ZERO;

    @Column(name = "rank")
    private Integer rank;

    @Column(name = "previous_rank")
    private Integer previousRank;

    @Column(name = "rank_change")
    private Integer rankChange;

    @Column(name = "created_at", nullable = false, updatable = false)
    private java.time.LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private java.time.LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = java.time.LocalDateTime.now();
        updatedAt = java.time.LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = java.time.LocalDateTime.now();
    }

    public void calculateTotalScore() {
        // Scores are additive; the leaderboard does not impose a maximum total.
        this.totalScore = (sessionsScore != null ? sessionsScore : BigDecimal.ZERO)
            .add(timeScore != null ? timeScore : BigDecimal.ZERO)
            .add(accuracyScore != null ? accuracyScore : BigDecimal.ZERO)
            .add(restDayBonus != null ? restDayBonus : BigDecimal.ZERO)
            .add(streakBonus != null ? streakBonus : BigDecimal.ZERO);
    }
}
