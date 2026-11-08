package com.calishealth.repository;

import com.calishealth.models.MemberFeedback;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface MemberFeedbackRepository extends JpaRepository<MemberFeedback, Long> {
    /** Danh sách đơn của một Member, mới nhất trước. */
    List<MemberFeedback> findAllByMemberIdOrderByCreatedAtDesc(Long memberId);

    /**
     * Đơn mà Content Manager đang tiếp nhận — gồm cả đơn chưa xử lý và đơn đã
     * chuyển tiếp lên Admin (Content Manager vẫn cần theo dõi).
     */
    List<MemberFeedback> findAllByStatusInOrderByCreatedAtDesc(Collection<MemberFeedback.Status> statuses);

    /** Đơn đã chuyển tiếp lên Admin. */
    List<MemberFeedback> findAllByStatusOrderByCreatedAtDesc(MemberFeedback.Status status);

    /**
     * Đơn đã được Content Manager chuyển tiếp lên Admin — có dấu vết thời điểm
     * chuyển tiếp ({@code escalatedAt}).
     */
    List<MemberFeedback> findAllByEscalatedAtIsNotNullOrderByCreatedAtDesc();

    /** Đơn đã chuyển tiếp lên Admin, lọc thêm theo trạng thái hiện tại. */
    List<MemberFeedback> findAllByEscalatedAtIsNotNullAndStatusOrderByCreatedAtDesc(MemberFeedback.Status status);

    long countByStatus(MemberFeedback.Status status);
}
