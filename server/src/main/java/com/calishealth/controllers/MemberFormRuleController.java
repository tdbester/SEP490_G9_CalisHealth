package com.calishealth.controllers;

import com.calishealth.dtos.MemberFormRuleDtos.FormRulesResponse;
import com.calishealth.service.MemberFormRuleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Cấu hình chấm form cho màn Real-time AI Pose Tracking. */
@RestController
@RequestMapping("/api/member/form-rules")
@RequiredArgsConstructor
@Tag(name = "Member Form Rules", description = "Ngưỡng chấm form và câu nhắc voice coach theo từng bài tập")
public class MemberFormRuleController {

    private final MemberFormRuleService formRuleService;

    @Operation(summary = "Lấy form rules của một bài tập", description = "Trả về ngưỡng góc khớp, độ sâu ROM và câu nhắc cho voice coach")
    @GetMapping
    public FormRulesResponse getFormRules(@RequestParam String exerciseCode) {
        return formRuleService.getFormRules(exerciseCode);
    }
}
