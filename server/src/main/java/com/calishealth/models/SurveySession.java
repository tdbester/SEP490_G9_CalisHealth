package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "survey_sessions")
@Getter
@Setter
@NoArgsConstructor
public class SurveySession {
    /**
     * IN_PROGRESS -> COMPLETED (kết thúc, không sửa được nữa)
     * IN_PROGRESS -> SKIPPED   (giữ nguyên câu trả lời)
     * SKIPPED     -> IN_PROGRESS (qua API resume)
     */
    public enum Status { IN_PROGRESS, COMPLETED, SKIPPED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Trỏ tới đúng 1 version bất biến của survey. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "survey_id", nullable = false)
    private Survey survey;

    @Column(name = "survey_version", nullable = false)
    private int surveyVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status = Status.IN_PROGRESS;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "skipped_at")
    private LocalDateTime skippedAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
