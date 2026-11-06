package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Lượt dùng AI Support của một member trong một ngày.
 *
 * Mỗi member được hỏi tối đa {@link #DAILY_QUESTION_LIMIT} câu/ngày; quota
 * reset mỗi 00:00 theo ngày của server. Dòng này là bản ghi "đã dùng bao
 * nhiêu" — lịch sử từng câu hỏi nằm ở {@link AiSupportMessage}.
 */
@Entity
@Table(name = "ai_support_usage",
        uniqueConstraints = @UniqueConstraint(name = "uk_ai_support_usage_user_day",
                columnNames = {"user_id", "usage_date"}))
@Getter
@Setter
@NoArgsConstructor
public class AiSupportUsage {

    /** Số câu hỏi tối đa mỗi member mỗi ngày. */
    public static final int DAILY_QUESTION_LIMIT = 15;

    /** Số câu hỏi tối đa trong một phiên chat mở (giới hạn mềm, khớp thiết kế Figma). */
    public static final int SESSION_QUESTION_LIMIT = 5;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Ngày của quota (00:00 theo giờ server) — mỗi user 1 dòng/ngày. */
    @Column(name = "usage_date", nullable = false)
    private LocalDate usageDate;

    /** Số câu đã hỏi trong ngày. */
    @Column(name = "question_count", nullable = false, columnDefinition = "int not null default 0")
    private int questionCount = 0;

    /** Tổng token đã tiêu (prompt + completion) — để thống kê chi phí. */
    @Column(name = "total_tokens", nullable = false, columnDefinition = "int not null default 0")
    private int totalTokens = 0;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    /** Số câu còn lại hôm nay. */
    public int remaining() {
        return Math.max(0, DAILY_QUESTION_LIMIT - questionCount);
    }
}
