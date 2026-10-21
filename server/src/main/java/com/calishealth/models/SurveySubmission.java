package com.calishealth.models;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "survey_submissions")
@Getter @Setter @NoArgsConstructor
public class SurveySubmission {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Integer score;

    private LocalDateTime submittedAt;

    @ManyToOne
    @JoinColumn(name = "member_profile_id")
    private MemberProfile memberProfile;

    @ManyToOne
    @JoinColumn(name = "survey_id")
    private Survey survey;

    @ManyToOne
    @JoinColumn(name = "fitness_level_id")
    private FitnessLevel fitnessLevel;
}