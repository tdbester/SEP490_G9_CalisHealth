package com.calishealth.models;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "survey_answers")
@Getter @Setter @NoArgsConstructor
public class SurveyAnswer {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(columnDefinition = "TEXT")
    private String answerValue;

    @ManyToOne
    @JoinColumn(name = "survey_submission_id")
    private SurveySubmission surveySubmission;

    @ManyToOne
    @JoinColumn(name = "survey_question_id")
    private SurveyQuestion surveyQuestion;
}