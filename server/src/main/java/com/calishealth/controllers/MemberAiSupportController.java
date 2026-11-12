package com.calishealth.controllers;

import com.calishealth.dtos.AiSupportDtos.AskQuestionRequest;
import com.calishealth.dtos.AiSupportDtos.AskQuestionResponse;
import com.calishealth.dtos.AiSupportDtos.HistoryItem;
import com.calishealth.dtos.AiSupportDtos.QuotaResponse;
import com.calishealth.dtos.PhysiologyAlertDTO;
import com.calishealth.service.AiSupportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * AI Support — member hỏi AI về lỗi form sau buổi tập (popup ở màn kết quả).
 *
 * Hạn mức: 15 câu/ngày mỗi member, 5 câu trong một phiên chat.
 */
@RestController
@RequestMapping("/api/member/ai-support")
@RequiredArgsConstructor
@Tag(name = "Member AI Support", description = "Hỏi AI về lỗi form sau buổi tập (có giới hạn lượt/ngày)")
public class MemberAiSupportController {

    private final AiSupportService aiSupport;

    @Operation(summary = "Xem lượt AI còn lại hôm nay", description = "Trả về số câu đã hỏi, hạn mức ngày và số câu còn lại")
    @GetMapping("/quota")
    public QuotaResponse quota(Authentication authentication,
                               @RequestParam(required = false) String sessionId) {
        return aiSupport.quota(authentication.getName(), sessionId);
    }

    @Operation(summary = "Đặt câu hỏi cho AI", description = "Trả về các nguyên nhân có thể gây lỗi form, mẹp sửa và câu hỏi gợi ý")
    @PostMapping("/ask")
    public AskQuestionResponse ask(@Valid @RequestBody AskQuestionRequest request, Authentication authentication) {
        return aiSupport.ask(authentication.getName(), request);
    }

    @Operation(summary = "Lịch sử hỏi AI hôm nay", description = "Danh sách cặp hỏi/đáp của member trong ngày")
    @GetMapping("/history")
    public List<HistoryItem> history(Authentication authentication,
                                     @RequestParam(required = false) String sessionId) {
        return sessionId != null && !sessionId.isBlank()
                ? aiSupport.sessionHistory(authentication.getName(), sessionId)
                : aiSupport.history(authentication.getName());
    }

    @Operation(summary = "Cảnh báo sinh lý của bài tập",
            description = "Các luật cảnh báo sinh lý (V76) khớp với hồ sơ sinh lý của bài tập")
    @GetMapping("/alerts/{exerciseCode}")
    public List<PhysiologyAlertDTO> alerts(@PathVariable String exerciseCode) {
        return aiSupport.alertsFor(exerciseCode);
    }
}
