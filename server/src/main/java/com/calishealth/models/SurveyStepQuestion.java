package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "survey_step_questions")
@Getter
@Setter
@NoArgsConstructor
public class SurveyStepQuestion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "step_id", nullable = false)
    private SurveyStep step;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private AssessmentQuestion question;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    /** Ghi đè AssessmentQuestion.required trong bước này; null = dùng giá trị của câu hỏi. */
    @Column(name = "required")
    private Boolean required;

    /** JSON thô, ví dụ {"operator":"EQ","questionCode":"GOAL_TYPE","value":"HEALTH"}. */
    @Column(name = "conditional_rules", columnDefinition = "json")
    private String conditionalRules;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    /** Câu hỏi có bắt buộc trong bước này không (đã tính phần ghi đè). */
    public boolean isEffectivelyRequired() {
        return required != null ? required : question.isRequired();
    }
}
