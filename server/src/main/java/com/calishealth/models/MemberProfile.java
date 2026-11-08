package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "member_profiles")
@Getter
@Setter
@NoArgsConstructor
public class MemberProfile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 20)
    private String gender;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(precision = 6, scale = 2)
    private BigDecimal weight;

    @Column(precision = 6, scale = 2)
    private BigDecimal height;

    @Column(columnDefinition = "TEXT")
    private String goals;

    @Column(name = "streak_count", nullable = false, columnDefinition = "int not null default 0")
    private int streakCount;

    @Column(name = "longest_streak", nullable = false, columnDefinition = "int not null default 0")
    private int longestStreak;

    @Column(columnDefinition = "TEXT")
    private String bio;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fitness_level_id")
    private FitnessLevel fitnessLevel;

    /** Target training days per week; the onboarding survey seeds it, 3 until then. */
    @Column(name = "days_per_week", nullable = false, columnDefinition = "int not null default 3")
    private int daysPerWeek = 3;
}
