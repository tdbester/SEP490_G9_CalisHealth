package com.calishealth.controllers;

import com.calishealth.dtos.SurveyDtos.SaveAnswersRequest;
import com.calishealth.dtos.SurveyDtos.SessionResponse;
import com.calishealth.dtos.SurveyDtos.SessionSummaryResponse;
import com.calishealth.dtos.SurveyDtos.StartSessionRequest;
import com.calishealth.dtos.SurveyDtos.SurveyResultResponse;
import com.calishealth.service.SurveySessionService;
import com.calishealth.service.SurveySessionService.StartResult;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Người dùng luôn lấy từ JWT (Authentication), không bao giờ từ request body. */
@RestController
@RequestMapping("/api/survey-sessions")
@RequiredArgsConstructor
public class SurveySessionController {
    private final SurveySessionService sessions;

    /** 201 khi tạo phiên mới, 200 khi trả về phiên IN_PROGRESS đã có. */
    @PostMapping
    public ResponseEntity<SessionResponse> start(Authentication a, @Valid @RequestBody StartSessionRequest r) {
        StartResult result = sessions.start(a.getName(), r.surveyCode());
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result.session());
    }

    /** Lịch sử phiên của người dùng hiện tại (mới nhất trước) - để frontend biết đã làm onboarding chưa. */
    @GetMapping
    public List<SessionSummaryResponse> list(Authentication a, @RequestParam String surveyCode) {
        return sessions.list(a.getName(), surveyCode);
    }

    @GetMapping("/{sessionId}")
    public SessionResponse get(Authentication a, @PathVariable Long sessionId) {
        return sessions.get(a.getName(), sessionId);
    }

    @PutMapping("/{sessionId}/steps/{stepCode}/answers")
    public SessionResponse saveAnswers(
            Authentication a,
            @PathVariable Long sessionId,
            @PathVariable String stepCode,
            @Valid @RequestBody SaveAnswersRequest r) {
        return sessions.saveStepAnswers(a.getName(), sessionId, stepCode, r);
    }

    @PostMapping("/{sessionId}/complete")
    public SessionResponse complete(Authentication a, @PathVariable Long sessionId) {
        return sessions.complete(a.getName(), sessionId);
    }

    /** Level đã chấm + kế hoạch gợi ý (màn "Result and recommended plan"); chỉ cho phiên COMPLETED. */
    @GetMapping("/{sessionId}/result")
    public SurveyResultResponse result(Authentication a, @PathVariable Long sessionId) {
        return sessions.result(a.getName(), sessionId);
    }

    @PostMapping("/{sessionId}/skip")
    public SessionResponse skip(Authentication a, @PathVariable Long sessionId) {
        return sessions.skip(a.getName(), sessionId);
    }

    @PostMapping("/{sessionId}/resume")
    public SessionResponse resume(Authentication a, @PathVariable Long sessionId) {
        return sessions.resume(a.getName(), sessionId);
    }
}
