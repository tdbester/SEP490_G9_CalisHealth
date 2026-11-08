package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Một câu hỏi / câu trả lời trong phiên AI Support.
 *
 * Lưu lại để member xem lại lịch sử hỏi trong ngày, và để admin thống kê
 * câu nào hay được hỏi (dùng để cải thiện prompt).
 */
@Entity
@Table(name = "ai_support_messages")
@Getter
@Setter
@NoArgsConstructor
public class AiSupportMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Bài tập member đang hỏi về (có thể null nếu hỏi chung). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exercise_id")
    private Exercise exercise;

    /**
     * Id phiên chat (client sinh mỗi lần mở popup) — dùng đếm số câu hỏi
     * trong một phiên (giới hạn 5 câu/phiên).
     */
    @Column(name = "session_id", length = 64)
    private String sessionId;

    /** Câu hỏi của member. */
    @Column(name = "question", nullable = false, columnDefinition = "TEXT")
    private String question;

    /** Câu trả lời của AI (đã render sẵn thành 3 nguyên nhân + tip). */
    @Column(name = "answer", nullable = false, columnDefinition = "TEXT")
    private String answer;

    /** Số token đã dùng cho cặp hỏi/đáp này. */
    @Column(name = "total_tokens", nullable = false, columnDefinition = "int not null default 0")
    private int totalTokens = 0;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
