package com.calishealth.repository;

import com.calishealth.models.AiSupportSession;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface AiSupportSessionRepository extends JpaRepository<AiSupportSession, Long> {

    /**
     * Tạo dòng phiên chat nếu chưa có (idempotent).
     *
     * Dùng {@code INSERT ... ON DUPLICATE KEY UPDATE} để chịu được request song
     * song: unique key {@code (user_id, session_id)} khiến các request phải
     * xếp hàng ở tầng DB.
     */
    @Modifying
    @Query(value = """
            INSERT INTO ai_support_sessions
                (user_id, session_id, question_count, created_at, updated_at)
            VALUES (:userId, :sessionId, 0, NOW(6), NOW(6))
            ON DUPLICATE KEY UPDATE updated_at = updated_at
            """, nativeQuery = true)
    void ensureSessionRow(@Param("userId") Long userId, @Param("sessionId") String sessionId);

    /**
     * Lấy dòng phiên chat kèm khóa ghi (pessimistic write).
     *
     * Khóa đảm bảo hai request song song không cùng tính lượt -> không vượt
     * giới hạn câu/phiên.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from AiSupportSession s where s.user.id = :userId and s.sessionId = :sessionId")
    Optional<AiSupportSession> findForUpdate(@Param("userId") Long userId,
                                             @Param("sessionId") String sessionId);

    /** Số câu đã hỏi trong phiên (đọc không khoá — chỉ để hiển thị). */
    @Query("select coalesce(max(s.questionCount), 0) from AiSupportSession s "
            + "where s.user.id = :userId and s.sessionId = :sessionId")
    int countQuestions(@Param("userId") Long userId, @Param("sessionId") String sessionId);
}
