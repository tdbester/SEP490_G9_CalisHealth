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
    public enum Gender { MALE, FEMALE, OTHER }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    private Gender gender;

    // ERD: member must be at least 13 years old (checked in the application layer)
    @Column(name = "date_of_birth", nullable = false)
    private LocalDate dateOfBirth;

    @Column(precision = 5, scale = 2)
    private BigDecimal weight;

    @Column(precision = 5, scale = 2)
    private BigDecimal height;

    private String goals;

    @Column(name = "streak_count", nullable = false, columnDefinition = "int not null default 0")
    private int streakCount;

    @Column(name = "longest_streak", nullable = false, columnDefinition = "int not null default 0")
    private int longestStreak;

    @Column(length = 200)
    private String bio;

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