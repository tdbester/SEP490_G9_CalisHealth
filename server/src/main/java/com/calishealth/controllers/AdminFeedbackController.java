package com.calishealth.controllers;

import com.calishealth.dtos.MemberFeedbackDtos.FeedbackListResponse;
import com.calishealth.dtos.MemberFeedbackDtos.FeedbackResponse;
import com.calishealth.dtos.MemberFeedbackDtos.HandleFeedbackRequest;
import com.calishealth.models.MemberFeedback;
import com.calishealth.service.MemberFeedbackService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/**
 * API xử lý góp ý & khiếu nại phía Admin.
 *
 * <p>Admin thấy các đơn đã được Content Manager chuyển tiếp lên
 * (trạng thái {@code ESCALATED}) cùng các đơn đã đóng, và đưa ra quyết định
 * cuối cùng.
 */
@RestController
@RequestMapping("/api/admin/feedback")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminFeedbackController {
    private final MemberFeedbackService feedbackService;

    /**
     * Danh sách đơn liên quan tới Admin.
     *
     * <p>Mặc định trả về các đơn đã chuyển tiếp lên Admin ({@code ESCALATED}) và
     * các đơn đã đóng ({@code RESOLVED}, {@code REJECTED}).
     *
     * @param status lọc theo trạng thái (mặc định trả về các đơn liên quan tới Admin)
     * @param category lọc theo nhóm nội dung (GENERAL | EXERCISE_CONTENT | WORKOUT_CONTENT | TECHNICAL | OTHER)
     * @param search tìm theo tên/email thành viên hoặc tiêu đề/nội dung đơn
     * @param fromDate chỉ lấy đơn gửi từ ngày này
     * @param toDate chỉ lấy đơn gửi đến hết ngày này
     */
    @GetMapping
    public ResponseEntity<FeedbackListResponse> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate
    ) {
        return ResponseEntity.ok(feedbackService.listForAdmin(
                parseStatus(status), parseCategory(category), search, fromDate, toDate));
    }

    /** Chi tiết một đơn góp ý. */
    @GetMapping("/{id}")
    public ResponseEntity<FeedbackResponse> detail(@PathVariable Long id) {
        return ResponseEntity.ok(feedbackService.detailForAdmin(id));
    }

    /**
     * Quyết định cuối cùng: {@code RESOLVE} (đóng đơn) | {@code REJECT} (không
     * chấp nhận).
     */
    @PatchMapping("/{id}/handle")
    public ResponseEntity<FeedbackResponse> handle(
            @PathVariable Long id,
            @Valid @RequestBody HandleFeedbackRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(
                feedbackService.handleByAdmin(authentication.getName(), id, request));
    }

    private MemberFeedback.Status parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return MemberFeedback.Status.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private MemberFeedback.Category parseCategory(String category) {
        if (category == null || category.isBlank()) {
            return null;
        }
        try {
            return MemberFeedback.Category.valueOf(category.trim().toUpperCase());
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }
}
