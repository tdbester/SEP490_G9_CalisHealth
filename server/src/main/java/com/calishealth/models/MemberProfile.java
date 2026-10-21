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

    @Column(name = "avatar_url", length = 1000)
    private String avatarUrl;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fitness_level_id")
    private FitnessLevel fitnessLevel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "avatar_media_id")
    private MediaFile avatarMedia;
}
