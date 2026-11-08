package com.calishealth.service;

import com.calishealth.dtos.AiSupportDtos.AnswerResponse;
import com.calishealth.exception.OpenAiException;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Kiểm tra lớp bọc Google Gemini API (Generative Language API).
 *
 * Dùng HTTP server nhúng trong JVM để giả lập Gemini: kiểm tra đúng
 * request được gửi đi (model, api key header, systemInstruction, lịch sử
 * chat) và cách service xử lý response / lỗi.
 */
class GeminiChatServiceTest {

    private HttpServer server;
    private String baseUrl;
    private final List<String> receivedBodies = new ArrayList<>();
    private final List<String> receivedApiKeys = new ArrayList<>();
    private final List<String> receivedPaths = new ArrayList<>();

    /** Mã HTTP server trả về cho request kế tiếp. */
    private int responseStatus = 200;
    /** Nội dung JSON server trả về cho request kế tiếp. */
    private String responseBody = "{}";

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        // Gemini dùng path dạng /v1beta/models/{model}:generateContent
        server.createContext("/v1beta/models/", exchange -> {
            receivedPaths.add(exchange.getRequestURI().getPath());
            receivedApiKeys.add(exchange.getRequestHeaders().getFirst("x-goog-api-key"));
            try (InputStream input = exchange.getRequestBody()) {
                receivedBodies.add(new String(input.readAllBytes(), StandardCharsets.UTF_8));
            }
            byte[] payload = responseBody.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(responseStatus, payload.length);
            exchange.getResponseBody().write(payload);
            exchange.close();
        });
        server.start();
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    private GeminiChatService service(String apiKey) {
        return new GeminiChatService(apiKey, "gemini-3.5-flash", baseUrl, 10, true);
    }

    @Test
    void reportsNotConfiguredWhenApiKeyIsBlank() {
        GeminiChatService service = service("   ");

        assertFalse(service.isConfigured());
        assertThrows(OpenAiException.class, () -> service.chat("system", "hello"));
    }

    @Test
    void exposesDemoFallbackFlag() {
        assertTrue(service("gemini-test-key").isDemoFallbackEnabled());
        assertFalse(new GeminiChatService("gemini-test-key", "gemini-3.5-flash", baseUrl, 10, false)
                .isDemoFallbackEnabled());
    }

    @Test
    void sendsGenerateContentRequestWithModelAndApiKey() {
        responseBody = """
                {"candidates":[{"content":{"parts":[{"text":"{\\"ok\\":true}"}],"role":"model"}}],
                 "usageMetadata":{"totalTokenCount":42}}
                """;
        GeminiChatService service = service("gemini-test-key");

        AiChatProvider.ChatResult result = service.chat("You are a coach", "Why is my form bad?");

        assertEquals(42, result.totalTokens());
        assertTrue(result.content().contains("ok"));
        assertEquals(1, receivedBodies.size());

        String body = receivedBodies.get(0);
        assertTrue(body.contains("\"temperature\":0.4"), body);
        assertTrue(body.contains("\"responseMimeType\":\"application/json\""), body);
        assertTrue(body.contains("\"role\":\"user\""), body);
        assertTrue(body.contains("Why is my form bad?"), body);
        // System prompt nằm riêng trong systemInstruction của Gemini.
        assertTrue(body.contains("systemInstruction"), body);
        assertTrue(body.contains("You are a coach"), body);
        // Thinking của Gemini 3.x phải tắt, nếu không sẽ ăn hết maxOutputTokens
        // và cắt cụt JSON trả về.
        assertTrue(body.contains("\"thinkingBudget\":0"), body);

        assertEquals("gemini-test-key", receivedApiKeys.get(0));
        assertEquals("/v1beta/models/gemini-3.5-flash:generateContent", receivedPaths.get(0));
    }

    @Test
    void mapsAssistantRoleToModelRoleForGemini() {
        responseBody = """
                {"candidates":[{"content":{"parts":[{"text":"answer"}],"role":"model"}}],
                 "usageMetadata":{"totalTokenCount":10}}
                """;
        GeminiChatService service = service("gemini-test-key");

        service.chat("system prompt", List.of(
                AiChatProvider.ChatMessage.user("first question"),
                AiChatProvider.ChatMessage.assistant("first answer"),
                AiChatProvider.ChatMessage.user("second question")));

        String body = receivedBodies.get(0);
        assertTrue(body.contains("first question"), body);
        assertTrue(body.contains("first answer"), body);
        assertTrue(body.contains("second question"), body);
        // Gemini không có role "assistant" -> phải map sang "model".
        assertTrue(body.contains("\"role\":\"model\""), body);
        assertFalse(body.contains("\"role\":\"assistant\""), body);
    }

    @Test
    void mapsInvalidApiKeyToDedicatedErrorCode() {
        responseStatus = 400;
        responseBody = """
                {"error":{"code":400,"message":"API key not valid","status":"INVALID_ARGUMENT"}}
                """;

        OpenAiException exception = assertThrows(OpenAiException.class,
                () -> service("wrong-key").chat("system", "hello"));

        assertEquals("AI_INVALID_KEY", exception.getCode());
    }

    @Test
    void mapsRateLimitToDedicatedErrorCode() {
        responseStatus = 429;
        responseBody = """
                {"error":{"code":429,"message":"Resource exhausted","status":"RESOURCE_EXHAUSTED"}}
                """;

        OpenAiException exception = assertThrows(OpenAiException.class,
                () -> service("gemini-test-key").chat("system", "hello"));

        assertEquals("AI_RATE_LIMITED", exception.getCode());
    }

    @Test
    void mapsUnknownModelToDedicatedErrorCode() {
        responseStatus = 404;
        responseBody = """
                {"error":{"code":404,"message":"models/xxx is not found","status":"NOT_FOUND"}}
                """;

        OpenAiException exception = assertThrows(OpenAiException.class,
                () -> service("gemini-test-key").chat("system", "hello"));

        assertEquals("AI_MODEL_NOT_FOUND", exception.getCode());
    }

    @Test
    void mapsUpstreamServerErrorToDedicatedErrorCode() {
        responseStatus = 500;
        responseBody = "{\"error\":{\"code\":500,\"message\":\"server error\"}}";

        OpenAiException exception = assertThrows(OpenAiException.class,
                () -> service("gemini-test-key").chat("system", "hello"));

        assertEquals("AI_UPSTREAM_ERROR", exception.getCode());
    }

    @Test
    void failsWhenResponseHasNoContent() {
        responseBody = "{\"candidates\":[]}";

        OpenAiException exception = assertThrows(OpenAiException.class,
                () -> service("gemini-test-key").chat("system", "hello"));

        assertEquals("AI_EMPTY_RESPONSE", exception.getCode());
    }

    @Test
    void parsesStructuredAnswerFromModelJson() {
        GeminiChatService service = service("gemini-test-key");

        AnswerResponse answer = service.toAnswer("""
                {"causes":[{"title":"Core fatigue","detail":"Hips drop."},
                            {"title":"Insufficient ROM","detail":"Not deep enough."}],
                 "tip":"Slow the set down.",
                 "followUps":["How do I warm up?","How long to rest?"]}
                """);

        assertEquals(2, answer.causes().size());
        assertEquals("Core fatigue", answer.causes().get(0).title());
        assertEquals("Hips drop.", answer.causes().get(0).detail());
        assertEquals("Slow the set down.", answer.tip());
        assertEquals(2, answer.followUps().size());
    }

    @Test
    void fallsBackToPlainTextWhenModelReturnsNonJson() {
        GeminiChatService service = service("gemini-test-key");

        AnswerResponse answer = service.toAnswer("Your elbows flared out on the way down.");

        assertEquals(1, answer.causes().size());
        assertTrue(answer.causes().get(0).detail().contains("elbows flared"));
        assertNotNull(answer.tip());
    }
}
