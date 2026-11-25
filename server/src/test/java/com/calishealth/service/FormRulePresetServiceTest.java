package com.calishealth.service;

import com.calishealth.models.FormRulePreset;
import com.calishealth.repository.FormRulePresetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Test {@link FormRulePresetService}: đọc bộ ngưỡng mẫu cho member. */
class FormRulePresetServiceTest {

    private FormRulePresetRepository presets;
    private FormRulePresetService service;

    @BeforeEach
    void setUp() {
        presets = mock(FormRulePresetRepository.class);
        service = new FormRulePresetService(presets);
    }

    private static FormRulePreset preset(long id, String code, String name,
                                        String category, String group) {
        FormRulePreset preset = new FormRulePreset();
        preset.setId(id);
        preset.setCode(code);
        preset.setName(name);
        preset.setCategory(category);
        preset.setMovementGroup(group);
        preset.setDescription("Mo ta");
        preset.setActive(true);
        return preset;
    }

    @Test
    @DisplayName("listAll: tra ve tat ca preset dang bat")
    void listsAllPresets() {
        when(presets.findAllActive()).thenReturn(List.of(
                preset(1L, "PUSHUP_STANDARD", "Push-up (standard)", "REPS", "PUSH"),
                preset(2L, "PLANK_STANDARD", "Plank", "HOLD", "CORE")));

        var view = service.listAll();

        assertThat(view.presets()).hasSize(2);
        assertThat(view.presets().get(0).code()).isEqualTo("PUSHUP_STANDARD");
        assertThat(view.presets().get(1).movementGroup()).isEqualTo("CORE");
    }

    @Test
    @DisplayName("listByGroup: loc theo nhom chuyen dong va loai bai")
    void listsByGroup() {
        when(presets.findActiveByGroupAndCategory("PUSH", "REPS")).thenReturn(List.of(
                preset(1L, "PUSHUP_STANDARD", "Push-up (standard)", "REPS", "PUSH")));

        var view = service.listByGroup("push", "reps");

        assertThat(view.presets()).hasSize(1);
        assertThat(view.presets().get(0).name()).isEqualTo("Push-up (standard)");
    }

    @Test
    @DisplayName("listByGroup: nhom rong -> khong co preset")
    void returnsEmptyForBlankGroup() {
        when(presets.findActiveByGroupAndCategory("", "")).thenReturn(List.of());

        var view = service.listByGroup(null, null);

        assertThat(view.presets()).isEmpty();
    }

    @Test
    @DisplayName("findByCode: tim thay preset")
    void findsByCode() {
        when(presets.findByCode("PLANK_STANDARD")).thenReturn(List.of(
                preset(2L, "PLANK_STANDARD", "Plank", "HOLD", "CORE")));

        assertThat(service.findByCode("PLANK_STANDARD")).isNotNull();
    }

    @Test
    @DisplayName("findByCode: khong ton tai -> null")
    void returnsNullWhenMissing() {
        when(presets.findByCode("NOPE")).thenReturn(List.of());

        assertThat(service.findByCode("NOPE")).isNull();
    }
}
