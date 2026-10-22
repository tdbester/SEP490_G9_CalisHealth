package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "assessment_questions")
@Getter
@Setter
@NoArgsConstructor
public class AssessmentQuestion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "question_code", nullable = false, unique = true, length = 64)
    private String questionCode;

    @Column(name = "question_text", nullable = false, length = 500)
    private String questionText;

    @Column(columnDefinition = "TEXT")
    private String description;

    /** Chuỗi tự do trong DB; chỉ hợp lệ khi QuestionTypeRegistry có handler tương ứng. */
    @Column(name = "question_type", nullable = false, length = 32)
    private String questionType;

    @Column(nullable = false)
    private boolean required;

    /** JSON thô, được parse trong SurveyDefinitionLoader. */
    @Column(name = "validation_rules", columnDefinition = "json")
    private String validationRules;

    @Column(name = "display_config", columnDefinition = "json")
    private String displayConfig;

    @Column(length = 32)
    private String unit;

    @Column(name = "default_value", columnDefinition = "json")
    private String defaultValue;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ConfigStatus status = ConfigStatus.ACTIVE;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;
}
