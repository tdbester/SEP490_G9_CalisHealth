package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.math.BigDecimal;

@Entity
@Table(name = "form_rules")
@Getter
@Setter
@NoArgsConstructor
public class FormRule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 30)
    private String joint;

    @Column(name = "angle_threshold", precision = 5, scale = 2)
    private BigDecimal angleThreshold;

    @Column(name = "rom_depth", precision = 5, scale = 2)
    private BigDecimal romDepth;

    @Column(name = "feedback_message")
    private String feedbackMessage;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exercise_id", nullable = false)
    private Exercise exercise;
}