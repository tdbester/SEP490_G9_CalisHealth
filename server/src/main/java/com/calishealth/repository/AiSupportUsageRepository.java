package com.calishealth.repository;

import com.calishealth.models.AiSupportUsage;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;

public interface AiSupportUsageRepository extends JpaRepository<AiSupportUsage, Long> {

    Optional<AiSupportUsage> findByUser_IdAndUsageDate(Long userId, LocalDate usageDate);

    /**
     * Tạo bản ghi quota của ngày nếu chưa có (idempotent).
     *
     * Dùng {@code INSERT ... ON DUPLICATE KEY UPDATE} để tránh lỗi unique
     * khi nhiều request cùng lúc là ngày đầu tiên member hỏi AI. Unique key
     * {@code (user_id, usage_date)} khiến các request song song phải xếp hàng
     * ở tầng DB -> không ai vượt hạn mức.
     */
    @Modifying
    @Query(value = """
            INSERT INTO ai_support_usage
                (user_id, usage_date, question_count, total_tokens, created_at, updated_at)
            VALUES (:userId, :usageDate, 0, 0, NOW(6), NOW(6))
            ON DUPLICATE KEY UPDATE updated_at = updated_at
            """, nativeQuery = true)
    void ensureUsageRow(@Param("userId") Long userId, @Param("usageDate") LocalDate usageDate);

    /**
     * Lấy bản ghi quota kèm khóa ghi (pessimistic write).
     *
     * Dùng khi trừ lượt: nếu member bấm gửi nhiều câu cùng lúc, các request
     * sẽ xếp hàng lại nhau -> không vượt quá hạn mức ngày.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from AiSupportUsage u where u.user.id = :userId and u.usageDate = :usageDate")
    Optional<AiSupportUsage> findForUpdate(@Param("userId") Long userId,
                                           @Param("usageDate") LocalDate usageDate);
}
