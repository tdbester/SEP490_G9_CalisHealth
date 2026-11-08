package com.calishealth.service;

import com.calishealth.dtos.AiSupportDtos.AskQuestionRequest;
import com.calishealth.dtos.AiSupportDtos.QuotaResponse;
import com.calishealth.exception.OpenAiException;
import com.calishealth.models.AiSupportMessage;
import com.calishealth.models.AiSupportSession;
import com.calishealth.models.AiSupportUsage;
import com.calishealth.models.Exercise;
import com.calishealth.models.FormRule;
import com.calishealth.models.User;
import com.calishealth.repository.AiSupportMessageRepository;
import com.calishealth.repository.AiSupportSessionRepository;
import com.calishealth.repository.AiSupportUsageRepository;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FormRuleRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Kiểm tra luồng AI Support: quota, gọi API thật và xử lý lỗi.
 */
class AiSupportServiceTest {

    private final AiSupportUsageRepository usageRepository = mock(AiSupportUsageRepository.class);
    private final AiSupportMessageRepository messageRepository = mock(AiSupportMessageRepository.class);
    private final AiSupportSessionRepository sessionRepository = mock(AiSupportSessionRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final ExerciseRepository exercises = mock(ExerciseRepository.class);
    private final FormRuleRepository formRules = mock(FormRuleRepository.class);
    private final ContentModerationService moderation = mock(ContentModerationService.class);
    private final OpenAiChatService openAi = mock(OpenAiChatService.class);

    private final AiSupportService service = new AiSupportService(
            usageRepository, messageRepository, sessionRepository,
            users, exercises, formRules, openAi, moderation);

    private User member;
    private Exercise exercise;

    @BeforeEach
    void setUp() {
        member = new User();
        member.setId(7L);
        member.setEmail("member@example.com");

        exercise = new Exercise();
        exercise.setId(3L);
        exercise.setCode("SQUAT");
        exercise.setName("Squat");

        when(users.findByEmail("member@example.com")).thenReturn(Optional.of(member));
        when(exercises.findByCode("SQUAT")).thenReturn(Optional.of(exercise));
        when(formRules.findByExerciseCode("SQUAT")).thenReturn(List.of());
        when(moderation.findFlaggedWords(anyString(), any(), any(), any())).thenReturn(List.of());
        when(messageRepository.findByUser_IdAndSessionIdOrderByCreatedAtAsc(anyLong(), anyString()))
                .thenReturn(List.of());
    }

    /** Tạo bản ghi quota hôm nay với số câu đã dùng cho trước. */
    private AiSupportUsage usage(int used) {
        AiSupportUsage usage = new AiSupportUsage();
        usage.setUser(member);
        usage.setUsageDate(LocalDate.now());
        usage.setQuestionCount(used);
        usage.setTotalTokens(0);
        return usage;
    }

    /** Tạo bản ghi phiên chat. */
    private AiSupportSession session(int used) {
        AiSupportSession session = new AiSupportSession();
        session.setUser(member);
        session.setSessionId("session-1");
        session.setQuestionCount(used);
        return session;
    }

    @Test
    void quotaReportsAiEnabledWhenApiKeyConfigured() {
        when(usageRepository.findByUser_IdAndUsageDate(7L, LocalDate.now()))
                .thenReturn(Optional.of(usage(2)));
        when(sessionRepository.countQuestions(7L, "session-1")).thenReturn(1);
        when(openAi.isConfigured()).thenReturn(true);
        when(openAi.model()).thenReturn("gpt-4o-mini");

        QuotaResponse response = service.quota("member@example.com", "session-1");

        assertEquals(2, response.questionCount());
        assertEquals(13, response.remaining());
        assertEquals(1, response.sessionUsed());
        assertTrue(response.aiEnabled());
        assertEquals("gpt-4o-mini", response.model());
    }

    @Test
    void quotaReportsAiDisabledWhenApiKeyMissing() {
        when(usageRepository.findByUser_IdAndUsageDate(7L, LocalDate.now()))
                .thenReturn(Optional.empty());
        when(sessionRepository.countQuestions(7L, "session-1")).thenReturn(0);
        when(openAi.isConfigured()).thenReturn(false);

        QuotaResponse response = service.quota("member@example.com", "session-1");

        assertFalse(response.aiEnabled());
        assertEquals(0, response.remaining() > 0 ? 0 : 1);
        assertEquals(AiSupportUsage.DAILY_QUESTION_LIMIT, response.remaining());
    }

    @Test
    void asksRealAiAndStoresAnswerAndTokens() {
        when(usageRepository.findForUpdate(7L, LocalDate.now())).thenReturn(Optional.of(usage(0)));
        when(sessionRepository.findForUpdate(7L, "session-1")).thenReturn(Optional.of(session(0)));
        when(openAi.isConfigured()).thenReturn(true);
        when(openAi.model()).thenReturn("gpt-4o-mini");
        when(openAi.chat(anyString(), anyList())).thenReturn(new OpenAiChatService.ChatResult("""
                {"causes":[{"title":"Core fatigue","detail":"Hips drop."}],
                 "tip":"Slow the set down.","followUps":["How do I warm up?"]}
                """, 120));
        when(openAi.toAnswer(anyString())).thenReturn(new com.calishealth.dtos.AiSupportDtos.AnswerResponse(
                List.of(new com.calishealth.dtos.AiSupportDtos.LikelyCause("Core fatigue", "Hips drop.")),
                "Slow the set down.",
                List.of("How do I warm up?")));

        var response = service.ask("member@example.com", new AskQuestionRequest(
                "SQUAT", "Why do my hips drop?", "session-1", List.of("Hips drop"), 72.0));

        assertEquals("gpt-4o-mini", response.provider());
        assertEquals(120, response.totalTokens());
        assertEquals(1, response.questionCount());
        assertEquals(1, response.sessionIndex());
        assertEquals("Core fatigue", response.answer().causes().get(0).title());

        verify(messageRepository).save(any(AiSupportMessage.class));
        verify(usageRepository).save(any(AiSupportUsage.class));
    }

    @Test
    void sendsConversationHistoryToAiWithinSameSession() {
        AiSupportMessage previous = new AiSupportMessage();
        previous.setUser(member);
        previous.setExercise(exercise);
        previous.setSessionId("session-1");
        previous.setQuestion("Why do my knees cave in?");
        previous.setAnswer("{\"causes\":[{\"title\":\"Knee valgus\",\"detail\":\"Feet pull inward.\"}],"
                + "\"tip\":\"Push the floor away.\",\"followUps\":[]}");

        when(usageRepository.findForUpdate(7L, LocalDate.now())).thenReturn(Optional.of(usage(0)));
        when(sessionRepository.findForUpdate(7L, "session-1")).thenReturn(Optional.of(session(0)));
        when(messageRepository.findByUser_IdAndSessionIdOrderByCreatedAtAsc(7L, "session-1"))
                .thenReturn(List.of(previous));
        when(openAi.isConfigured()).thenReturn(true);
        when(openAi.model()).thenReturn("gpt-4o-mini");
        when(openAi.chat(anyString(), anyList()))
                .thenReturn(new OpenAiChatService.ChatResult("{}", 10));
        when(openAi.toAnswer(anyString())).thenReturn(new com.calishealth.dtos.AiSupportDtos.AnswerResponse(
                List.of(), "", List.of()));

        service.ask("member@example.com", new AskQuestionRequest(
                "SQUAT", "And what about my lower back?", "session-1", List.of(), 70.0));

        var captor = org.mockito.ArgumentCaptor.forClass(List.class);
        verify(openAi).chat(anyString(), captor.capture());
        List<?> sent = captor.getValue();
        // 1 lượt cũ -> 2 message (hỏi + đáp) + 1 câu hỏi mới.
        assertEquals(3, sent.size());
    }

    @Test
    void propagatesAiFailureInsteadOfReturningFakeAnswer() {
        when(usageRepository.findForUpdate(7L, LocalDate.now())).thenReturn(Optional.of(usage(0)));
        when(sessionRepository.findForUpdate(7L, "session-1")).thenReturn(Optional.of(session(0)));
        when(openAi.isConfigured()).thenReturn(true);
        when(openAi.chat(anyString(), anyList()))
                .thenThrow(new OpenAiException("AI_RATE_LIMITED", "AI Support is busy right now.", null));

        assertThrows(OpenAiException.class, () -> service.ask("member@example.com",
                new AskQuestionRequest("SQUAT", "Why?", "session-1", List.of(), null)));

        // Không lưu lịch sử khi AI lỗi -> không mất lượt đã hỏi.
        verify(messageRepository, never()).save(any(AiSupportMessage.class));
    }

    @Test
    void rejectsQuestionBeyondDailyQuota() {
        when(usageRepository.findForUpdate(7L, LocalDate.now()))
                .thenReturn(Optional.of(usage(AiSupportUsage.DAILY_QUESTION_LIMIT)));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.ask("member@example.com",
                        new AskQuestionRequest("SQUAT", "Why?", "session-1", List.of(), null)));

        assertEquals(429, exception.getStatusCode().value());
    }

    @Test
    void rejectsQuestionBeyondSessionLimit() {
        when(usageRepository.findForUpdate(7L, LocalDate.now())).thenReturn(Optional.of(usage(0)));
        when(sessionRepository.findForUpdate(7L, "session-1"))
                .thenReturn(Optional.of(session(AiSupportUsage.SESSION_QUESTION_LIMIT)));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.ask("member@example.com",
                        new AskQuestionRequest("SQUAT", "Why?", "session-1", List.of(), null)));

        assertEquals(429, exception.getStatusCode().value());
    }

    @Test
    void rejectsQuestionWithFlaggedWords() {
        when(moderation.findFlaggedWords(anyString(), any(), any(), any()))
                .thenReturn(List.of("badword"));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.ask("member@example.com",
                        new AskQuestionRequest("SQUAT", "badword", "session-1", List.of(), null)));

        assertEquals(400, exception.getStatusCode().value());
    }
}
