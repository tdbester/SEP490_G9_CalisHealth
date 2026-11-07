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
 * API xử lý góp ý & khiếu nại của Member phía Content Manager.
 *
 * <p>Nằm dưới {@code /api/content/**} nên được bảo vệ bằng rule
 * {@code hasRole("CONTENT_MANAGER")} trong SecurityConfig.
 */
@RestController
@RequestMapping("/api/content/feedback")
@RequiredArgsConstructor
@PreAuthorize("hasRole('CONTENT_MANAGER')")
public class ContentFeedbackController {
    private final MemberFeedbackService feedbackService;

    /**
     * Danh sách đơn góp ý.
     *
     * @param status lọc theo trạng thái (PENDING | IN_REVIEW | ESCALATED | RESOLVED | REJECTED)
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
        return ResponseEntity.ok(feedbackService.listForContentManager(
                parseStatus(status), parseCategory(category), search, fromDate, toDate));
    }

    /** Chi tiết một đơn góp ý. */
    @GetMapping("/{id}")
    public ResponseEntity<FeedbackResponse> detail(@PathVariable Long id) {
        return ResponseEntity.ok(feedbackService.detailForContentManager(id));
    }

    /** Content Manager nhận việc xử lý một đơn. */
    @PatchMapping("/{id}/take")
    public ResponseEntity<FeedbackResponse> take(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(feedbackService.takeInReview(authentication.getName(), id));
    }

    /**
     * Xử lý đơn: {@code APPROVE} (tự giải quyết) | {@code ESCALATE} (chuyển lên
     * Admin) | {@code REJECT} (không chấp nhận).
     */
    @PatchMapping("/{id}/handle")
    public ResponseEntity<FeedbackResponse> handle(
            @PathVariable Long id,
            @Valid @RequestBody HandleFeedbackRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(
                feedbackService.handleByContentManager(authentication.getName(), id, request));
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
