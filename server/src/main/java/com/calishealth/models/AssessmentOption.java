package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "assessment_options")
@Getter
@Setter
@NoArgsConstructor
public class AssessmentOption {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private AssessmentQuestion question;

    @Column(name = "option_code", nullable = false, length = 64)
    private String optionCode;

    @Column(name = "option_label", nullable = false)
    private String optionLabel;

    @Column(name = "option_value")
    private String optionValue;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ConfigStatus status = ConfigStatus.ACTIVE;
}
