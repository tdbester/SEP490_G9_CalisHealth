package com.calishealth.repository;

import com.calishealth.models.AiSupportMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface AiSupportMessageRepository extends JpaRepository<AiSupportMessage, Long> {

    /** Lịch sử hỏi của member trong ngày (mới nhất trước). */
    List<AiSupportMessage> findByUser_IdAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc(
            Long userId, LocalDateTime from);

    /** Số câu đã hỏi trong một phiên chat cụ thể. */
    long countByUser_IdAndSessionId(Long userId, String sessionId);

    /** Các câu hỏi của một phiên chat, cũ nhất trước (để khôi phục hội thoại). */
    List<AiSupportMessage> findByUser_IdAndSessionIdOrderByCreatedAtAsc(Long userId, String sessionId);
}
