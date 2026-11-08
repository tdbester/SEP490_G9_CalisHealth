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
 * Kiểm tra lớp bọc OpenAI Chat Completions API.
 *
 * Dùng HTTP server nhúng trong JVM để giả lập OpenAI: kiểm tra đúng
 * request được gửi đi (model, auth header, response_format, lịch sử chat)
 * và cách service xử lý response / lỗi.
 */
class OpenAiChatServiceTest {

    private HttpServer server;
    private String baseUrl;
    private final List<String> receivedBodies = new ArrayList<>();
    private final List<String> receivedAuth = new ArrayList<>();
    private final List<String> receivedPaths = new ArrayList<>();

    /** Mã HTTP server trả về cho request kế tiếp. */
    private int responseStatus = 200;
    /** Nội dung JSON server trả về cho request kế tiếp. */
    private String responseBody = "{}";

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            receivedPaths.add(exchange.getRequestURI().getPath());
            receivedAuth.add(exchange.getRequestHeaders().getFirst("Authorization"));
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

    private OpenAiChatService service(String apiKey) {
        return new OpenAiChatService(apiKey, "gpt-4o-mini", baseUrl, 10, true);
    }

    @Test
    void reportsNotConfiguredWhenApiKeyIsBlank() {
        OpenAiChatService service = service("   ");

        assertFalse(service.isConfigured());
        assertThrows(OpenAiException.class, () -> service.chat("system", "hello"));
    }

    @Test
    void exposesDemoFallbackFlag() {
        assertTrue(service("sk-test-key").isDemoFallbackEnabled());
        assertFalse(new OpenAiChatService("sk-test-key", "gpt-4o-mini", baseUrl, 10, false)
                .isDemoFallbackEnabled());
    }

    @Test
    void sendsChatRequestWithModelAuthAndJsonResponseFormat() {
        responseBody = """
                {"choices":[{"message":{"content":"{\\"ok\\":true}"}}],
                 "usage":{"total_tokens":42}}
                """;
        OpenAiChatService service = service("sk-test-key");

        OpenAiChatService.ChatResult result = service.chat("You are a coach", "Why is my form bad?");

        assertEquals(42, result.totalTokens());
        assertTrue(result.content().contains("ok"));
        assertEquals(1, receivedBodies.size());

        String body = receivedBodies.get(0);
        assertTrue(body.contains("\"model\":\"gpt-4o-mini\""), body);
        assertTrue(body.contains("\"type\":\"json_object\""), body);
        assertTrue(body.contains("\"role\":\"system\""), body);
        assertTrue(body.contains("\"role\":\"user\""), body);
        assertTrue(body.contains("Why is my form bad?"), body);

        assertEquals("Bearer sk-test-key", receivedAuth.get(0));
        assertEquals("/v1/chat/completions", receivedPaths.get(0));
    }

    @Test
    void sendsConversationHistorySoModelKeepsContext() {
        responseBody = """
                {"choices":[{"message":{"content":"answer"}}],"usage":{"total_tokens":10}}
                """;
        OpenAiChatService service = service("sk-test-key");

        service.chat("system prompt", List.of(
                OpenAiChatService.ChatMessage.user("first question"),
                OpenAiChatService.ChatMessage.assistant("first answer"),
                OpenAiChatService.ChatMessage.user("second question")));

        String body = receivedBodies.get(0);
        assertTrue(body.contains("first question"), body);
        assertTrue(body.contains("first answer"), body);
        assertTrue(body.contains("second question"), body);
        assertTrue(body.contains("\"role\":\"assistant\""), body);
    }

    @Test
    void mapsInvalidApiKeyToDedicatedErrorCode() {
        responseStatus = 401;
        responseBody = "{\"error\":{\"message\":\"Incorrect API key provided\"}}";

        OpenAiException exception = assertThrows(OpenAiException.class,
                () -> service("sk-wrong").chat("system", "hello"));

        assertEquals("AI_INVALID_KEY", exception.getCode());
    }

    @Test
    void mapsRateLimitToDedicatedErrorCode() {
        responseStatus = 429;
        responseBody = "{\"error\":{\"message\":\"Rate limit reached\"}}";

        OpenAiException exception = assertThrows(OpenAiException.class,
                () -> service("sk-test-key").chat("system", "hello"));

        assertEquals("AI_RATE_LIMITED", exception.getCode());
    }

    @Test
    void mapsExhaustedCreditsToDedicatedErrorCode() {
        responseStatus = 429;
        responseBody = """
                {"error":{"message":"You have no credits remaining.","type":"insufficient_quota",
                 "code":"credit_balance_exhausted"}}
                """;

        OpenAiException exception = assertThrows(OpenAiException.class,
                () -> service("sk-test-key").chat("system", "hello"));

        assertEquals("AI_OUT_OF_CREDITS", exception.getCode());
    }

    @Test
    void mapsUpstreamServerErrorToDedicatedErrorCode() {
        responseStatus = 500;
        responseBody = "{\"error\":{\"message\":\"server error\"}}";

        OpenAiException exception = assertThrows(OpenAiException.class,
                () -> service("sk-test-key").chat("system", "hello"));

        assertEquals("AI_UPSTREAM_ERROR", exception.getCode());
    }

    @Test
    void failsWhenResponseHasNoContent() {
        responseBody = "{\"choices\":[]}";

        OpenAiException exception = assertThrows(OpenAiException.class,
                () -> service("sk-test-key").chat("system", "hello"));

        assertEquals("AI_EMPTY_RESPONSE", exception.getCode());
    }

    @Test
    void parsesStructuredAnswerFromModelJson() {
        OpenAiChatService service = service("sk-test-key");

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
        OpenAiChatService service = service("sk-test-key");

        AnswerResponse answer = service.toAnswer("Your elbows flared out on the way down.");

        assertEquals(1, answer.causes().size());
        assertTrue(answer.causes().get(0).detail().contains("elbows flared"));
        assertNotNull(answer.tip());
    }
}
