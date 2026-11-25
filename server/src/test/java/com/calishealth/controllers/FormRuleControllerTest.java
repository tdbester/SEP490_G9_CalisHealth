package com.calishealth.controllers;

import com.calishealth.dtos.FormRuleAdminDtos.FormRulePresetView;
import com.calishealth.dtos.FormRuleAdminDtos.FormRulePresetsView;
import com.calishealth.dtos.FormRuleAdminDtos.FormRulesRequest;
import com.calishealth.dtos.FormRuleAdminDtos.FormRulesView;
import com.calishealth.dtos.FormRuleAdminDtos.FormRuleView;
import com.calishealth.dtos.FormRuleSuggestionDtos.SuggestedRule;
import com.calishealth.dtos.FormRuleSuggestionDtos.SuggestionResponse;
import com.calishealth.service.FormRuleAdminService;
import com.calishealth.service.FormRulePresetService;
import com.calishealth.service.FormRuleSuggestionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Test các endpoint cấu hình chấm form cho Content Manager và member. */
@SpringBootTest
@AutoConfigureMockMvc
class FormRuleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private FormRuleAdminService formRuleAdminService;

    @MockitoBean
    private FormRulePresetService presetService;

    @MockitoBean
    private FormRuleSuggestionService suggestionService;

    @Test
    void contentManagerReadsFormRules() throws Exception {
        when(formRuleAdminService.getFormRules("EX_1")).thenReturn(new FormRulesView(
                "EX_1", "Push-up",
                List.of(new FormRuleView(1L, "ELBOW", new BigDecimal("165"), new BigDecimal("97"),
                        null, null, new BigDecimal("0.30"), new BigDecimal("20"), "DEFAULT"
                        ))));

        mockMvc.perform(get("/api/content/exercises/EX_1/form-rules")
                        .with(SecurityMockMvcRequestPostProcessors.user("cm").roles("CONTENT_MANAGER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.exerciseCode").value("EX_1"))
                .andExpect(jsonPath("$.rules[0].joint").value("ELBOW"))
                .andExpect(jsonPath("$.rules[0].weight").value(0.30));
    }

    @Test
    void contentManagerReplacesFormRules() throws Exception {
        when(formRuleAdminService.replaceFormRules(eq("EX_1"), any(FormRulesRequest.class),
                eq(FormRuleAdminService.SOURCE_CONTENT_MANAGER)))
                .thenReturn(new FormRulesView("EX_1", "Push-up", List.of()));

        mockMvc.perform(put("/api/content/exercises/EX_1/form-rules")
                        .with(SecurityMockMvcRequestPostProcessors.user("cm").roles("CONTENT_MANAGER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"rules":[{"joint":"ELBOW","angleThreshold":165,"romDepth":97}]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.exerciseCode").value("EX_1"));

        verify(formRuleAdminService).replaceFormRules(eq("EX_1"), any(FormRulesRequest.class),
                eq(FormRuleAdminService.SOURCE_CONTENT_MANAGER));
    }

    @Test
    void memberListsPresets() throws Exception {
        when(presetService.listAll()).thenReturn(new FormRulePresetsView(List.of(
                new FormRulePresetView(1L, "PUSHUP_STANDARD", "Push-up (standard)",
                        "REPS", "PUSH", "Standard push-up"))));

        mockMvc.perform(get("/api/member/form-rules/presets")
                        .with(SecurityMockMvcRequestPostProcessors.user("member").roles("MEMBER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.presets[0].code").value("PUSHUP_STANDARD"))
                .andExpect(jsonPath("$.presets[0].movementGroup").value("PUSH"));
    }

    @Test
    void memberListsPresetsByGroup() throws Exception {
        when(presetService.listByGroup("PUSH", "REPS")).thenReturn(new FormRulePresetsView(List.of()));

        mockMvc.perform(get("/api/member/form-rules/presets/by-group")
                        .param("movementGroup", "PUSH")
                        .param("category", "REPS")
                        .with(SecurityMockMvcRequestPostProcessors.user("member").roles("MEMBER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.presets").isArray());
    }

    @Test
    void memberReadsSuggestions() throws Exception {
        when(suggestionService.suggest("PUSH", "REPS")).thenReturn(new SuggestionResponse(
                "PUSH", "REPS",
                List.of(new SuggestedRule("ELBOW", new BigDecimal("165"), new BigDecimal("97"),
                        null, null, new BigDecimal("0.30"), new BigDecimal("20"),
                        3)),
                3));

        mockMvc.perform(get("/api/member/form-rules/suggestions")
                        .param("movementGroup", "PUSH")
                        .param("category", "REPS")
                        .with(SecurityMockMvcRequestPostProcessors.user("member").roles("MEMBER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.movementGroup").value("PUSH"))
                .andExpect(jsonPath("$.suggestions[0].joint").value("ELBOW"))
                .andExpect(jsonPath("$.suggestions[0].similarCount").value(3));
    }
}
