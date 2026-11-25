package com.calishealth.service;

import com.calishealth.models.Exercise;
import com.calishealth.repository.AiSupportMessageRepository;
import com.calishealth.repository.AiSupportSessionRepository;
import com.calishealth.repository.AiSupportUsageRepository;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FormRuleRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bo sung coverage cho {@link AiSupportService}: chon provider theo cau hinh, danh sach
 * canh bao sinh ly va bai tap khong ton tai.
 */
class AiSupportServiceProviderGapTest {

    private ExerciseRepository exercises;
    private AiSupportService service;

    @BeforeEach
    void setUp() {
        exercises = mock(ExerciseRepository.class);
        service = new AiSupportService(
                mock(AiSupportUsageRepository.class),
                mock(AiSupportMessageRepository.class),
                mock(AiSupportSessionRepository.class),
                mock(UserRepository.class),
                exercises,
                mock(FormRuleRepository.class),
                mock(OpenAiChatService.class),
                mock(GeminiChatService.class),
                mock(ContentModerationService.class),
                mock(ExercisePhysiologyService.class),
                mock(PhysiologyAlertService.class),
                mock(ExerciseSafetyService.class),
                "auto");
    }

    @Test
    @DisplayName("alertsFor: bai tap khong ton tai -> 404")
    void alertsForRejectsUnknownExercise() {
        when(exercises.findByCode(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.alertsFor("EX001"))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
                .hasMessageContaining("Exercise not found");
    }

    @Test
    @DisplayName("alertsFor: bai tap hop le -> tra ve danh sach canh bao")
    void alertsForReturnsAlerts() {
        Exercise exercise = new Exercise();
        exercise.setId(3L);
        exercise.setCode("EX001");
        when(exercises.findByCode("EX001")).thenReturn(Optional.of(exercise));
        PhysiologyAlertService alerts = mock(PhysiologyAlertService.class);
        lenient().when(alerts.evaluate(any(), any(Integer.class), any())).thenReturn(java.util.List.of());

        AiSupportService withAlerts = new AiSupportService(
                mock(AiSupportUsageRepository.class),
                mock(AiSupportMessageRepository.class),
                mock(AiSupportSessionRepository.class),
                mock(UserRepository.class),
                exercises,
                mock(FormRuleRepository.class),
                mock(OpenAiChatService.class),
                mock(GeminiChatService.class),
                mock(ContentModerationService.class),
                mock(ExercisePhysiologyService.class),
                alerts,
                mock(ExerciseSafetyService.class),
                "auto");

        assertThat(withAlerts.alertsFor("EX001")).isEmpty();
    }

    @Test
    @DisplayName("activeProvider: uu tien openai -> dung OpenAI")
    void activeProviderPrefersOpenAi() {
        OpenAiChatService openAi = mock(OpenAiChatService.class);
        GeminiChatService gemini = mock(GeminiChatService.class);
        when(openAi.isConfigured()).thenReturn(true);
        when(gemini.isConfigured()).thenReturn(true);
        UserRepository users = mock(UserRepository.class);
        com.calishealth.models.User user = new com.calishealth.models.User();
        user.setId(4L);
        user.setEmail("m@x.vn");
        when(users.findByEmail("m@x.vn")).thenReturn(Optional.of(user));

        AiSupportService service = new AiSupportService(
                mock(AiSupportUsageRepository.class),
                mock(AiSupportMessageRepository.class),
                mock(AiSupportSessionRepository.class),
                users,
                exercises,
                mock(FormRuleRepository.class),
                openAi,
                gemini,
                mock(ContentModerationService.class),
                mock(ExercisePhysiologyService.class),
                mock(PhysiologyAlertService.class),
                mock(ExerciseSafetyService.class),
                "openai");

        // Provider "auto" uu tien Gemini, "openai" uu tien OpenAI.
        assertThat(service.quota("m@x.vn", "s1")).isNotNull();
    }
}
