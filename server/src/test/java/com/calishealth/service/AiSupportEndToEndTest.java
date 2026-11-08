package com.calishealth.service;

import com.calishealth.dtos.AiSupportDtos.AskQuestionRequest;
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
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Kiểm tra end-to-end: member hỏi -> gọi OpenAI thật (HTTP server giả lập)
 * -> nhận câu trả lời có cấu trúc -> lưu lịch sử + trừ quota.
 */
class AiSupportEndToEndTest {

    /** Escape chuỗi thành JSON string literal (dùng để dựng payload giả lập). */
    private static String jsonString(String value) {
        StringBuilder builder = new StringBuilder(value.length() + 16);
        builder.append('"');
        for (char character : value.toCharArray()) {
            switch (character) {
                case '"' -> builder.append("\\\"");
                case '\\' -> builder.append("\\\\");
                case '\n' -> builder.append("\\n");
                case '\r' -> builder.append("\\r");
                case '\t' -> builder.append("\\t");
                default -> builder.append(character);
            }
        }
        return builder.append('"').toString();
    }

    @Test
    void memberQuestionReturnsStructuredAnswerFromRealApiShape() throws IOException {
        List<String> requests = new ArrayList<>();
        HttpServer openAi = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        openAi.createContext("/v1/chat/completions", exchange -> {
            try (InputStream input = exchange.getRequestBody()) {
                requests.add(new String(input.readAllBytes(), StandardCharsets.UTF_8));
            }
            String aiContent = """
                    {"causes":[{"title":"Knee valgus","detail":"Knees collapse inward because the glutes fire late."},{"title":"Insufficient depth","detail":"You stop above the depth the tracker requires."},{"title":"Rushed tempo","detail":"The descent is too fast to count as a clean rep."}],"tip":"Push the floor away and control the descent for 2 seconds.","followUps":["Should I go lighter?","How often should I squat?"]}""";
            String responseJson = """
                    {"id":"chatcmpl-1","object":"chat.completion","model":"gpt-4o-mini",
                     "choices":[{"index":0,"finish_reason":"stop","message":{"role":"assistant","content":%s}}],
                     "usage":{"prompt_tokens":220,"completion_tokens":150,"total_tokens":370}}
                    """.formatted(jsonString(aiContent));
            byte[] payload = responseJson.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, payload.length);
            exchange.getResponseBody().write(payload);
            exchange.close();
        });
        openAi.start();

        try {
            AiSupportUsageRepository usageRepository = mock(AiSupportUsageRepository.class);
            AiSupportMessageRepository messageRepository = mock(AiSupportMessageRepository.class);
            AiSupportSessionRepository sessionRepository = mock(AiSupportSessionRepository.class);
            UserRepository users = mock(UserRepository.class);
            ExerciseRepository exercises = mock(ExerciseRepository.class);
            FormRuleRepository formRules = mock(FormRuleRepository.class);
            ContentModerationService moderation = mock(ContentModerationService.class);

            User member = new User();
            member.setId(11L);
            member.setEmail("member@example.com");

            Exercise exercise = new Exercise();
            exercise.setId(5L);
            exercise.setCode("SQUAT");
            exercise.setName("Bodyweight Squat");

            FormRule rule = new FormRule();
            rule.setJoint("KNEE");
            rule.setRomDepth(new BigDecimal("90.000"));
            rule.setFeedbackMessage("Bring your knees in line with your toes.");

            AiSupportUsage usage = new AiSupportUsage();
            usage.setUser(member);
            usage.setUsageDate(LocalDate.now());
            usage.setQuestionCount(4);

            AiSupportSession session = new AiSupportSession();
            session.setUser(member);
            session.setSessionId("sess-42");
            session.setQuestionCount(2);

            when(users.findByEmail("member@example.com")).thenReturn(Optional.of(member));
            when(exercises.findByCode("SQUAT")).thenReturn(Optional.of(exercise));
            when(formRules.findByExerciseCode("SQUAT")).thenReturn(List.of(rule));
            when(moderation.findFlaggedWords(anyString(), any(), any(), any())).thenReturn(List.of());
            when(usageRepository.findForUpdate(11L, LocalDate.now())).thenReturn(Optional.of(usage));
            when(sessionRepository.findForUpdate(11L, "sess-42")).thenReturn(Optional.of(session));
            when(messageRepository.findByUser_IdAndSessionIdOrderByCreatedAtAsc(anyLong(), anyString()))
                    .thenReturn(List.of());

            OpenAiChatService chatService = new OpenAiChatService(
                    "sk-real-key", "gpt-4o-mini",
                    "http://127.0.0.1:" + openAi.getAddress().getPort(), 10, true);

            AiSupportService service = new AiSupportService(
                    usageRepository, messageRepository, sessionRepository,
                    users, exercises, formRules, chatService, moderation);

            var response = service.ask("member@example.com", new AskQuestionRequest(
                    "SQUAT",
                    "Why do my knees cave in when I squat?",
                    "sess-42",
                    List.of("Knees caved inward"),
                    68.0));

            // Câu trả lời đúng cấu trúc UI mong đợi.
            assertEquals(3, response.answer().causes().size());
            assertEquals("Knee valgus", response.answer().causes().get(0).title());
            assertTrue(response.answer().tip().contains("Push the floor away"));
            assertEquals(2, response.answer().followUps().size());

            // Quota cập nhật đúng.
            assertEquals("gpt-4o-mini", response.provider());
            assertEquals(370, response.totalTokens());
            assertEquals(5, response.questionCount());
            assertEquals(3, response.sessionIndex());
            assertEquals(10, response.remaining());

            // Request gửi đi đúng: model, auth, system prompt có ngữ cảnh bài tập.
            assertEquals(1, requests.size());
            String request = requests.get(0);
            assertTrue(request.contains("\"model\":\"gpt-4o-mini\""), request);
            assertTrue(request.contains("\"response_format\":{\"type\":\"json_object\"}"), request);
            assertTrue(request.contains("Bodyweight Squat"), request);
            assertTrue(request.contains("Knees caved inward"), request);
            assertTrue(request.contains("Why do my knees cave in when I squat?"), request);

            // Lịch sử được lưu lại để member xem lại.
            org.mockito.ArgumentCaptor<AiSupportMessage> captor =
                    org.mockito.ArgumentCaptor.forClass(AiSupportMessage.class);
            org.mockito.Mockito.verify(messageRepository).save(captor.capture());
            assertTrue(captor.getValue().getAnswer().contains("Knee valgus"));
        } finally {
            openAi.stop(0);
        }
    }

    @Test
    void memberGetsClearErrorWhenApiKeyIsInvalidAndDemoIsOff() throws IOException {
        HttpServer openAi = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        openAi.createContext("/v1/chat/completions", exchange -> {
            byte[] payload = "{\"error\":{\"message\":\"Incorrect API key provided\"}}"
                    .getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(401, payload.length);
            exchange.getResponseBody().write(payload);
            exchange.close();
        });
        openAi.start();

        try {
            AiSupportUsageRepository usageRepository = mock(AiSupportUsageRepository.class);
            AiSupportMessageRepository messageRepository = mock(AiSupportMessageRepository.class);
            AiSupportSessionRepository sessionRepository = mock(AiSupportSessionRepository.class);
            UserRepository users = mock(UserRepository.class);
            ExerciseRepository exercises = mock(ExerciseRepository.class);
            FormRuleRepository formRules = mock(FormRuleRepository.class);
            ContentModerationService moderation = mock(ContentModerationService.class);

            User member = new User();
            member.setId(11L);
            Exercise exercise = new Exercise();
            exercise.setCode("SQUAT");
            exercise.setName("Bodyweight Squat");

            AiSupportUsage usage = new AiSupportUsage();
            usage.setUser(member);
            usage.setUsageDate(LocalDate.now());
            usage.setQuestionCount(0);

            AiSupportSession session = new AiSupportSession();
            session.setUser(member);
            session.setSessionId("sess-42");
            session.setQuestionCount(0);

            when(users.findByEmail("member@example.com")).thenReturn(Optional.of(member));
            when(exercises.findByCode("SQUAT")).thenReturn(Optional.of(exercise));
            when(formRules.findByExerciseCode("SQUAT")).thenReturn(List.of());
            when(moderation.findFlaggedWords(anyString(), any(), any(), any())).thenReturn(List.of());
            when(usageRepository.findForUpdate(11L, LocalDate.now())).thenReturn(Optional.of(usage));
            when(sessionRepository.findForUpdate(11L, "sess-42")).thenReturn(Optional.of(session));
            when(messageRepository.findByUser_IdAndSessionIdOrderByCreatedAtAsc(anyLong(), anyString()))
                    .thenReturn(List.of());

            // Demo tắt -> lỗi phải nổi lên, không được giấu bằng câu trả lời giả.
            OpenAiChatService chatService = new OpenAiChatService(
                    "sk-wrong", "gpt-4o-mini",
                    "http://127.0.0.1:" + openAi.getAddress().getPort(), 10, false);

            AiSupportService service = new AiSupportService(
                    usageRepository, messageRepository, sessionRepository,
                    users, exercises, formRules, chatService, moderation);

            var exception = assertThrows(RuntimeException.class,
                    () -> service.ask("member@example.com", new AskQuestionRequest(
                            "SQUAT", "Why?", "sess-42", List.of(), null)));

            assertTrue(exception.getMessage().contains("not configured correctly"), exception.getMessage());
            // Member không mất lượt khi AI lỗi.
            org.mockito.Mockito.verify(messageRepository, org.mockito.Mockito.never())
                    .save(any(AiSupportMessage.class));
        } finally {
            openAi.stop(0);
        }
    }

    @Test
    void servesDemoAnswerFlaggedWhenApiFailsAndDemoIsOn() throws IOException {
        HttpServer openAi = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        openAi.createContext("/v1/chat/completions", exchange -> {
            byte[] payload = ("{\"error\":{\"message\":\"You have no credits remaining.\","
                    + "\"type\":\"insufficient_quota\"}}").getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(429, payload.length);
            exchange.getResponseBody().write(payload);
            exchange.close();
        });
        openAi.start();

        try {
            AiSupportUsageRepository usageRepository = mock(AiSupportUsageRepository.class);
            AiSupportMessageRepository messageRepository = mock(AiSupportMessageRepository.class);
            AiSupportSessionRepository sessionRepository = mock(AiSupportSessionRepository.class);
            UserRepository users = mock(UserRepository.class);
            ExerciseRepository exercises = mock(ExerciseRepository.class);
            FormRuleRepository formRules = mock(FormRuleRepository.class);
            ContentModerationService moderation = mock(ContentModerationService.class);

            User member = new User();
            member.setId(11L);
            Exercise exercise = new Exercise();
            exercise.setCode("SQUAT");
            exercise.setName("Bodyweight Squat");

            FormRule rule = new FormRule();
            rule.setJoint("KNEE");
            rule.setRomDepth(new BigDecimal("90.000"));
            rule.setFeedbackMessage("Bring your knees in line with your toes.");

            AiSupportUsage usage = new AiSupportUsage();
            usage.setUser(member);
            usage.setUsageDate(LocalDate.now());
            usage.setQuestionCount(0);

            AiSupportSession session = new AiSupportSession();
            session.setUser(member);
            session.setSessionId("sess-42");
            session.setQuestionCount(0);

            when(users.findByEmail("member@example.com")).thenReturn(Optional.of(member));
            when(exercises.findByCode("SQUAT")).thenReturn(Optional.of(exercise));
            when(formRules.findByExerciseCode("SQUAT")).thenReturn(List.of(rule));
            when(moderation.findFlaggedWords(anyString(), any(), any(), any())).thenReturn(List.of());
            when(usageRepository.findForUpdate(11L, LocalDate.now())).thenReturn(Optional.of(usage));
            when(sessionRepository.findForUpdate(11L, "sess-42")).thenReturn(Optional.of(session));
            when(messageRepository.findByUser_IdAndSessionIdOrderByCreatedAtAsc(anyLong(), anyString()))
                    .thenReturn(List.of());

            // Demo bật -> trả lời bằng rule nội bộ, gắn cờ để member biết.
            OpenAiChatService chatService = new OpenAiChatService(
                    "sk-out-of-credits", "gpt-4o-mini",
                    "http://127.0.0.1:" + openAi.getAddress().getPort(), 10, true);

            AiSupportService service = new AiSupportService(
                    usageRepository, messageRepository, sessionRepository,
                    users, exercises, formRules, chatService, moderation);

            var response = service.ask("member@example.com", new AskQuestionRequest(
                    "SQUAT", "Why do my knees cave in?", "sess-42", List.of("Knees caved inward"), 68.0));

            assertEquals("local-rules", response.provider());
            assertEquals("AI_OUT_OF_CREDITS", response.notice());
            assertEquals(0, response.totalTokens());
            // Vẫn có câu trả lời dùng được để demo.
            assertEquals(3, response.answer().causes().size());
            assertTrue(response.answer().tip().contains("Bring your knees in line"));
            // Lượt vẫn được tính như bình thường.
            assertEquals(1, response.questionCount());
        } finally {
            openAi.stop(0);
        }
    }
}
