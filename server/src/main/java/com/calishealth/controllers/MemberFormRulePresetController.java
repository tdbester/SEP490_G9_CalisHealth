package com.calishealth.controllers;

import com.calishealth.dtos.FormRuleAdminDtos.FormRulePresetsView;
import com.calishealth.dtos.FormRuleSuggestionDtos.SuggestionResponse;
import com.calishealth.service.FormRulePresetService;
import com.calishealth.service.FormRuleSuggestionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Bộ ngưỡng mẫu và gợi ý ngưỡng khi member tạo bài tập custom. */
@RestController
@RequestMapping("/api/member/form-rules")
@RequiredArgsConstructor
@Tag(name = "Member Form Rules", description = "Ngưỡng chấm form, bộ ngưỡng mẫu và gợi ý cho member")
public class MemberFormRulePresetController {

    private final FormRulePresetService presetService;
    private final FormRuleSuggestionService suggestionService;

    @Operation(summary = "Danh sách bộ ngưỡng mẫu", description = "Các preset member có thể chọn khi tạo bài tập custom")
    @GetMapping("/presets")
    public FormRulePresetsView listPresets() {
        return presetService.listAll();
    }

    @Operation(summary = "Bộ ngưỡng mẫu theo nhóm chuyển động và loại bài")
    @GetMapping("/presets/by-group")
    public FormRulePresetsView listPresetsByGroup(
            @RequestParam String movementGroup,
            @RequestParam String category) {
        return presetService.listByGroup(movementGroup, category);
    }

    @Operation(summary = "Gợi ý ngưỡng chấm form", description = "Trung bình ngưỡng của các bài đang có trong cùng nhóm chuyển động")
    @GetMapping("/suggestions")
    public SuggestionResponse suggest(
            @RequestParam String movementGroup,
            @RequestParam(required = false) String category) {
        return suggestionService.suggest(movementGroup, category);
    }
}
