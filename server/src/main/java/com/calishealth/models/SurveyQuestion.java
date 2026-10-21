package com.calishealth.models;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "survey_question")
@Getter @Setter @NoArgsConstructor
public class SurveyQuestion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Integer displayOrder;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String questionText;

    /** Tên cột trong DB là `anwer_type` (typo có sẵn trong schema). */
    @Column(name = "anwer_type")
    private String anwerType;

    @Column(columnDefinition = "TEXT")
    private String options;

    @ManyToOne
    @JoinColumn(name = "survey_id")
    private Survey survey;
}