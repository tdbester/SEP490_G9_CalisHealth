package com.calishealth.service;

import com.calishealth.dtos.FormRuleAdminDtos.FormRulePresetView;
import com.calishealth.dtos.FormRuleAdminDtos.FormRulePresetsView;
import com.calishealth.models.FormRulePreset;
import com.calishealth.repository.FormRulePresetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Đọc bộ ngưỡng mẫu (preset) mà member chọn khi tạo bài tập custom. */
@Service
@RequiredArgsConstructor
public class FormRulePresetService {

    private final FormRulePresetRepository presets;

    /** Tất cả preset đang bật. */
    @Transactional(readOnly = true)
    public FormRulePresetsView listAll() {
        return new FormRulePresetsView(presets.findAllActive().stream().map(this::toView).toList());
    }

    /** Các preset đang bật của một nhóm chuyển động và loại bài. */
    @Transactional(readOnly = true)
    public FormRulePresetsView listByGroup(String movementGroup, String category) {
        List<FormRulePreset> found = presets.findActiveByGroupAndCategory(
                movementGroup == null ? "" : movementGroup.trim().toUpperCase(),
                category == null ? "" : category.trim().toUpperCase());
        return new FormRulePresetsView(found.stream().map(this::toView).toList());
    }

    /** Tìm preset theo mã — dùng khi member chọn 1 mẫu. */
    @Transactional(readOnly = true)
    public FormRulePreset findByCode(String code) {
        return presets.findByCode(code).stream().findFirst().orElse(null);
    }

    private FormRulePresetView toView(FormRulePreset preset) {
        return new FormRulePresetView(
                preset.getId(),
                preset.getCode(),
                preset.getName(),
                preset.getCategory(),
                preset.getMovementGroup(),
                preset.getDescription());
    }
}
