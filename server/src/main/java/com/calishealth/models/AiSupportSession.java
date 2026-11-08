package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Bộ đếm lượt của một phiên chat AI Support.
 *
 * Mỗi lần member mở popup là một phiên riêng (client sinh {@code sessionId}).
 * Dòng này giữ số câu đã hỏi trong phiên để server áp dụng giới hạn
 * {@link AiSupportUsage#SESSION_QUESTION_LIMIT} câu/phiên.
 *
 * Server khóa dòng này (SELECT ... FOR UPDATE) trước khi đếm -> các request
 * song song xếp hàng, không vượt hạn mức.
 */
@Entity
@Table(name = "ai_support_sessions",
        uniqueConstraints = @UniqueConstraint(name = "uk_ai_support_sessions_user_session",
                columnNames = {"user_id", "session_id"}))
@Getter
@Setter
@NoArgsConstructor
public class AiSupportSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Id phiên chat do client sinh. */
    @Column(name = "session_id", nullable = false, length = 64)
    private String sessionId;

    /** Số câu đã hỏi trong phiên này. */
    @Column(name = "question_count", nullable = false, columnDefinition = "int not null default 0")
    private int questionCount = 0;

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
}
