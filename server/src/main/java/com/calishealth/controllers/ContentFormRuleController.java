package com.calishealth.controllers;

import com.calishealth.dtos.FormRuleAdminDtos.FormRulesRequest;
import com.calishealth.dtos.FormRuleAdminDtos.FormRulesView;
import com.calishealth.service.FormRuleAdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Quản lý ngưỡng chấm form của bài tập (Content Manager). */
@RestController
@RequestMapping("/api/content/exercises")
@RequiredArgsConstructor
@Tag(name = "Content Form Rules", description = "Khai báo ngưỡng chấm form (AI Pose Tracking) cho bài tập")
public class ContentFormRuleController {

    private final FormRuleAdminService formRuleAdminService;

    @Operation(summary = "Đọc ngưỡng chấm form của một bài tập")
    @GetMapping("/{exerciseCode}/form-rules")
    public FormRulesView getFormRules(@PathVariable String exerciseCode) {
        return formRuleAdminService.getFormRules(exerciseCode);
    }

    @Operation(summary = "Khai báo lại toàn bộ ngưỡng chấm form của một bài tập")
    @PutMapping("/{exerciseCode}/form-rules")
    public FormRulesView replaceFormRules(
            @PathVariable String exerciseCode,
            @RequestBody FormRulesRequest request) {
        return formRuleAdminService.replaceFormRules(
                exerciseCode, request, FormRuleAdminService.SOURCE_CONTENT_MANAGER);
    }
}
