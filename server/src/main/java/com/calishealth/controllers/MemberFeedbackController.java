package com.calishealth.controllers;

import com.calishealth.dtos.MemberFeedbackDtos.CreateFeedbackRequest;
import com.calishealth.dtos.MemberFeedbackDtos.FeedbackResponse;
import com.calishealth.service.MemberFeedbackService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * API góp ý & khiếu nại của Member.
 *
 * <p>Route dưới {@code /api/v1/library/feedback} được bảo vệ bằng rule
 * {@code /api/v1/library/**} trong SecurityConfig (role MEMBER).
 */
@RestController
@RequestMapping("/api/v1/library/feedback")
@RequiredArgsConstructor
@PreAuthorize("hasRole('MEMBER')")
public class MemberFeedbackController {
    private final MemberFeedbackService feedbackService;

    /** Danh sách đơn của chính Member (kèm trạng thái và ghi chú xử lý). */
    @GetMapping
    public ResponseEntity<List<FeedbackResponse>> listMine(Authentication authentication) {
        return ResponseEntity.ok(feedbackService.listMine(authentication.getName()));
    }

    /** Member gửi đơn góp ý — đơn được chuyển tới Content Manager. */
    @PostMapping
    public ResponseEntity<FeedbackResponse> create(
            @Valid @RequestBody CreateFeedbackRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(feedbackService.create(authentication.getName(), request));
    }
}
