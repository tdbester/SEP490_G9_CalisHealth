package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Một mục đã được Member đánh dấu sao (favorite) trong thư viện.
 *
 * <p>Người dùng có thể yêu thích cả bài tập lẫn workout. Để phân biệt rõ nội dung
 * của hệ thống với nội dung do Member cung cấp, mỗi dòng lưu kèm {@link ItemType}.
 */
@Entity
@Table(name = "member_favorites")
@Getter
@Setter
@NoArgsConstructor
public class MemberFavorite {
    /** Loại nội dung được yêu thích. */
    public enum ItemType {
        /** Bài tập do Content Manager tạo (có cây progression). */
        SYSTEM_EXERCISE,
        /** Bài tập do Member tự tạo hoặc cộng đồng chia sẻ. */
        MEMBER_EXERCISE,
        /** Workout do Content Manager tạo. */
        SYSTEM_WORKOUT,
        /** Workout do Member tự tạo hoặc cộng đồng chia sẻ. */
        MEMBER_WORKOUT;

        /** Nhóm nội dung "của hệ thống" — dùng để gom tab trong màn Favorites. */
        public boolean isSystemOwned() {
            return this == SYSTEM_EXERCISE || this == SYSTEM_WORKOUT;
        }

        /** Nhóm nội dung "do Member cung cấp". */
        public boolean isMemberOwned() {
            return this == MEMBER_EXERCISE || this == MEMBER_WORKOUT;
        }
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long memberId;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_type", nullable = false, length = 30)
    private ItemType itemType;

    @Column(name = "item_id", nullable = false)
    private Long itemId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void stampCreatedAt() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
