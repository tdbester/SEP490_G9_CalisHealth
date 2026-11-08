package com.calishealth.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

/**
 * DTO cho luồng góp ý & khiếu nại của Member.
 *
 * <p>Gom cả request của Member (tạo đơn) và response trả về cho cả ba vai trò,
 * vì mọi bên đều xem cùng một cấu trúc đơn.
 */
public class MemberFeedbackDtos {

    /**
     * Đơn góp ý do Member gửi lên.
     *
     * @param title    tiêu đề đơn (bắt buộc)
     * @param content nội dung chi tiết (bắt buộc)
     * @param category nhóm nội dung — GENERAL | EXERCISE_CONTENT | WORKOUT_CONTENT | TECHNICAL | OTHER
     */
    public record CreateFeedbackRequest(
            @NotBlank(message = "Title is required")
            @Size(max = 200, message = "Title must not exceed 200 characters")
            String title,

            @NotBlank(message = "Content is required")
            @Size(max = 5000, message = "Content must not exceed 5000 characters")
            String content,

            @Pattern(
                    regexp = "GENERAL|EXERCISE_CONTENT|WORKOUT_CONTENT|TECHNICAL|OTHER",
                    message = "Category must be GENERAL, EXERCISE_CONTENT, WORKOUT_CONTENT, TECHNICAL or OTHER"
            )
            String category
    ) {
        /** Khi client không gửi category thì mặc định là góp ý chung. */
        public String categoryOrDefault() {
            return category == null || category.isBlank() ? "GENERAL" : category.trim().toUpperCase();
        }
    }

    /**
     * Một đơn góp ý trả về cho frontend.
     *
     * @param id             id của đơn
     * @param title          tiêu đề
     * @param content        nội dung đơn
     * @param category       nhóm nội dung
     * @param status         trạng thái hiện tại
     * @param resolutionNote ghi chú xử lý (null nếu chưa xử lý)
     * @param memberId       id của Member gửi đơn
     * @param memberName     tên Member gửi đơn
     * @param memberEmail    email Member gửi đơn
     * @param handledBy      id người xử lý (null nếu chưa ai xử lý)
     * @param escalatedAt    thời điểm chuyển tiếp lên Admin (null nếu chưa chuyển tiếp)
     * @param resolvedAt     thời điểm đóng đơn (null nếu chưa đóng)
     * @param createdAt      thời điểm Member gửi
     * @param updatedAt      thời điểm cập nhật gần nhất
     */
    public record FeedbackResponse(
            Long id,
            String title,
            String content,
            String category,
            String status,
            String resolutionNote,
            Long memberId,
            String memberName,
            String memberEmail,
            Long handledBy,
            LocalDateTime escalatedAt,
            LocalDateTime resolvedAt,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}

    /**
     * Thao tác xử lý của Content Manager hoặc Admin.
     *
     * @param action         APPROVE (tự giải quyết) | ESCALATE (chuyển lên Admin) | REJECT (không chấp nhận) | RESOLVE (Admin đóng đơn)
     * @param resolutionNote ghi chú xử lý, trả lại cho Member
     */
    public record HandleFeedbackRequest(
            @Pattern(
                    regexp = "APPROVE|ESCALATE|REJECT|RESOLVE",
                    message = "Action must be APPROVE, ESCALATE, REJECT or RESOLVE"
            )
            String action,
            @Size(max = 2000, message = "Resolution note must not exceed 2000 characters")
            String resolutionNote
    ) {}

    /**
     * Danh sách đơn kèm số liệu tổng hợp cho bộ lọc.
     *
     * @param items       danh sách đơn
     * @param total       tổng số đơn trong bộ lọc hiện tại
     * @param pending     số đơn đang chờ tiếp nhận
     * @param inReview    số đơn đang xử lý
     * @param escalated   số đơn đã chuyển tiếp lên Admin
     * @param resolved    số đơn đã xử lý xong
     */
    public record FeedbackListResponse(
            java.util.List<FeedbackResponse> items,
            long total,
            long pending,
            long inReview,
            long escalated,
            long resolved
    ) {}
}
