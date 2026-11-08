package com.calishealth.models;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Phiếu góp ý / khiếu nại do Member gửi.
 *
 * <p>Đơn luôn bắt đầu ở Content Manager: nếu Content Manager tự giải quyết được
 * thì chuyển sang {@link Status#RESOLVED}, nếu vấn đề thuộc về hệ thống thì
 * chuyển tiếp lên Admin bằng {@link Status#ESCALATED}.
 */
@Entity
@Table(name = "member_feedback")
@Getter
@Setter
@NoArgsConstructor
public class MemberFeedback {
    /** Vòng đời của một đơn góp ý. */
    public enum Status {
        /** Member vừa gửi — chờ Content Manager tiếp nhận. */
        PENDING,
        /** Content Manager đã nhận việc và đang xử lý. */
        IN_REVIEW,
        /** Đã chuyển tiếp lên Admin (vấn đề thuộc về hệ thống). */
        ESCALATED,
        /** Đã xử lý xong — trả trạng thái lại cho Member. */
        RESOLVED,
        /** Không chấp nhận đơn. */
        REJECTED;

        /** Trạng thái đã đóng — Member có thể xem kết quả xử lý. */
        public boolean isClosed() {
            return this == RESOLVED || this == REJECTED;
        }
    }

    /** Nhóm nội dung của đơn — giúp bộ lọc và định tuyến xử lý. */
    public enum Category {
        GENERAL,
        EXERCISE_CONTENT,
        WORKOUT_CONTENT,
        TECHNICAL,
        OTHER;

        /** Đơn về nội dung thư viện có thể do Content Manager tự xử lý. */
        public boolean isContentScope() {
            return this == EXERCISE_CONTENT || this == WORKOUT_CONTENT || this == GENERAL;
        }
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Category category = Category.GENERAL;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.PENDING;

    /** Ghi chú của người xử lý — hiển thị lại cho Member. */
    @Column(name = "resolution_note", columnDefinition = "TEXT")
    private String resolutionNote;

    /** Id của người xử lý (Content Manager hoặc Admin). */
    @Column(name = "handled_by")
    private Long handledBy;

    @Column(name = "escalated_at")
    private LocalDateTime escalatedAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void setTimestamps() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void updateTimestamp() {
        updatedAt = LocalDateTime.now();
    }
}
