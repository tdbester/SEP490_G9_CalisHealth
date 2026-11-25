package com.calishealth.service;

import com.calishealth.exception.OpenAiException;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Bo sung coverage cho {@link OpenAiChatService} va {@link GeminiChatService}: nhanh thu lai
 * voi ngan sach token lon hon va cach dich cac lo loi HTTP.
 */
class AiChatRetryAndErrorMappingTest {

    private HttpServer server;
    private String baseUrl;
    private final List<String> receivedBodies = new ArrayList<>();
    private int responseStatus = 200;
    private String responseBody = "{}";

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
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

    private OpenAiChatService openAi(int maxTokens) {
        return new OpenAiChatService("sk-test", "gpt-4o-mini", baseUrl, 10, maxTokens, true);
    }

    private GeminiChatService gemini(int maxTokens) {
        return new GeminiChatService("key", "gemini-3.5-flash", baseUrl, 10, maxTokens, true);
    }

    // ------------------------------------------------------------------- OpenAI

    @Test
    @DisplayName("OpenAI: bi cat cụt -> thu lai voi ngan sach gap doi")
    void openAiRetriesWithLargerBudget() {
        responseBody = """
                {"choices":[{"message":{"content":"partial"},"finish_reason":"length"}]}
                """;

        assertThatThrownBy(() -> openAi(700).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class);
        assertThat(receivedBodies).hasSize(2);
        // Lan hai dung ngan sach gap doi.
        assertThat(receivedBodies.get(0)).contains("\"max_completion_tokens\":700");
        assertThat(receivedBodies.get(1)).contains("\"max_completion_tokens\":1400");
    }

    @Test
    @DisplayName("OpenAI: ngan sach toi da -> khong thu lai")
    void openAiDoesNotRetryWhenBudgetIsCapped() {
        responseBody = """
                {"choices":[{"message":{"content":"partial"},"finish_reason":"length"}]}
                """;

        assertThatThrownBy(() -> openAi(4096).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class);
        assertThat(receivedBodies).hasSize(1);
    }

    @Test
    @DisplayName("OpenAI: bi cat cụt -> ma loi AI_TRUNCATED")
    void openAiTruncatedResponseCarriesTruncatedCode() {
        responseBody = """
                {"choices":[{"message":{"content":"partial"},"finish_reason":"length"}]}
                """;

        assertThatThrownBy(() -> openAi(4096).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class)
                .satisfies(e -> assertThat(((OpenAiException) e).getCode()).isEqualTo("AI_TRUNCATED"));
    }

    @Test
    @DisplayName("OpenAI: loi khac AI_TRUNCATED -> nem luon, khong thu lai")
    void openAiDoesNotRetryOtherErrors() {
        responseStatus = 500;
        responseBody = "{\"error\":\"server\"}";

        assertThatThrownBy(() -> openAi(700).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class);
        assertThat(receivedBodies).hasSize(1);
    }

    @Test
    @DisplayName("OpenAI: 401 -> AI_INVALID_KEY")
    void openAiMapsInvalidKey() {
        responseStatus = 401;
        responseBody = "{\"error\":\"unauthorized\"}";

        assertThatThrownBy(() -> openAi(700).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class)
                .satisfies(e -> assertThat(((OpenAiException) e).getCode()).isEqualTo("AI_INVALID_KEY"));
    }

    @Test
    @DisplayName("OpenAI: 403 -> AI_INVALID_KEY")
    void openAiMapsForbidden() {
        responseStatus = 403;
        responseBody = "{\"error\":\"forbidden\"}";

        assertThatThrownBy(() -> openAi(700).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class)
                .satisfies(e -> assertThat(((OpenAiException) e).getCode()).isEqualTo("AI_INVALID_KEY"));
    }

    @Test
    @DisplayName("OpenAI: 429 het credit -> AI_OUT_OF_CREDITS")
    void openAiMapsOutOfCredits() {
        responseStatus = 429;
        responseBody = "{\"error\":{\"code\":\"insufficient_quota\"}}";

        assertThatThrownBy(() -> openAi(700).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class)
                .satisfies(e -> assertThat(((OpenAiException) e).getCode()).isEqualTo("AI_OUT_OF_CREDITS"));
    }

    @Test
    @DisplayName("OpenAI: 429 het credit (credit_balance_exhausted) -> AI_OUT_OF_CREDITS")
    void openAiMapsExhaustedCreditBalance() {
        responseStatus = 429;
        responseBody = "{\"error\":{\"code\":\"credit_balance_exhausted\"}}";

        assertThatThrownBy(() -> openAi(700).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class)
                .satisfies(e -> assertThat(((OpenAiException) e).getCode()).isEqualTo("AI_OUT_OF_CREDITS"));
    }

    @Test
    @DisplayName("OpenAI: 429 con quota -> AI_RATE_LIMITED")
    void openAiMapsRateLimit() {
        responseStatus = 429;
        responseBody = "{\"error\":{\"code\":\"rate_limit_exceeded\"}}";

        assertThatThrownBy(() -> openAi(700).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class)
                .satisfies(e -> assertThat(((OpenAiException) e).getCode()).isEqualTo("AI_RATE_LIMITED"));
    }

    @Test
    @DisplayName("OpenAI: 500 -> AI_UPSTREAM_ERROR")
    void openAiMapsUpstreamError() {
        responseStatus = 500;
        responseBody = "{\"error\":\"server\"}";

        assertThatThrownBy(() -> openAi(700).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class)
                .satisfies(e -> assertThat(((OpenAiException) e).getCode()).isEqualTo("AI_UPSTREAM_ERROR"));
    }

    @Test
    @DisplayName("OpenAI: 400 -> AI_REQUEST_FAILED")
    void openAiMapsBadRequest() {
        responseStatus = 400;
        responseBody = "{\"error\":\"bad request\"}";

        assertThatThrownBy(() -> openAi(700).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class)
                .satisfies(e -> assertThat(((OpenAiException) e).getCode()).isEqualTo("AI_REQUEST_FAILED"));
    }

    @Test
    @DisplayName("OpenAI: chua cau hinh -> AI_NOT_CONFIGURED")
    void openAiRejectsUnconfiguredService() {
        OpenAiChatService service = new OpenAiChatService("", "gpt-4o-mini", baseUrl, 10, 700, true);

        assertThatThrownBy(() -> service.chat("system", "hi"))
                .isInstanceOf(OpenAiException.class)
                .satisfies(e -> assertThat(((OpenAiException) e).getCode()).isEqualTo("AI_NOT_CONFIGURED"));
    }

    @Test
    @DisplayName("OpenAI: response rong -> AI_EMPTY_RESPONSE")
    void openAiRejectsEmptyContent() {
        responseBody = "{\"choices\":[{\"message\":{\"content\":\"\"}}]}";

        assertThatThrownBy(() -> openAi(700).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class)
                .satisfies(e -> assertThat(((OpenAiException) e).getCode()).isEqualTo("AI_EMPTY_RESPONSE"));
    }

    // ------------------------------------------------------------------- Gemini

    @Test
    @DisplayName("Gemini: bi cat cụt -> thu lai voi ngan sach gap doi")
    void geminiRetriesWithLargerBudget() {
        responseBody = """
                {"candidates":[{"content":{"parts":[{"text":"partial"}]},"finishReason":"MAX_TOKENS"}]}
                """;

        assertThatThrownBy(() -> gemini(700).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class);
        assertThat(receivedBodies).hasSize(2);
        assertThat(receivedBodies.get(0)).contains("\"maxOutputTokens\":700");
        assertThat(receivedBodies.get(1)).contains("\"maxOutputTokens\":1400");
    }

    @Test
    @DisplayName("Gemini: ngan sach toi da -> khong thu lai")
    void geminiDoesNotRetryWhenBudgetIsCapped() {
        responseBody = """
                {"candidates":[{"content":{"parts":[{"text":"partial"}]},"finishReason":"MAX_TOKENS"}]}
                """;

        assertThatThrownBy(() -> gemini(4096).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class);
        assertThat(receivedBodies).hasSize(1);
    }

    @Test
    @DisplayName("Gemini: 400 -> AI_INVALID_KEY")
    void geminiMapsBadRequestToInvalidKey() {
        responseStatus = 400;
        responseBody = "{\"error\":\"bad\"}";

        assertThatThrownBy(() -> gemini(700).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class)
                .satisfies(e -> assertThat(((OpenAiException) e).getCode()).isEqualTo("AI_INVALID_KEY"));
    }

    @Test
    @DisplayName("Gemini: 403 -> AI_INVALID_KEY")
    void geminiMapsForbiddenToInvalidKey() {
        responseStatus = 403;
        responseBody = "{\"error\":\"forbidden\"}";

        assertThatThrownBy(() -> gemini(700).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class)
                .satisfies(e -> assertThat(((OpenAiException) e).getCode()).isEqualTo("AI_INVALID_KEY"));
    }

    @Test
    @DisplayName("Gemini: 429 -> AI_RATE_LIMITED")
    void geminiMapsRateLimit() {
        responseStatus = 429;
        responseBody = "{\"error\":\"quota\"}";

        assertThatThrownBy(() -> gemini(700).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class)
                .satisfies(e -> assertThat(((OpenAiException) e).getCode()).isEqualTo("AI_RATE_LIMITED"));
    }

    @Test
    @DisplayName("Gemini: 404 -> AI_MODEL_NOT_FOUND")
    void geminiMapsModelNotFound() {
        responseStatus = 404;
        responseBody = "{\"error\":\"not found\"}";

        assertThatThrownBy(() -> gemini(700).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class)
                .satisfies(e -> assertThat(((OpenAiException) e).getCode()).isEqualTo("AI_MODEL_NOT_FOUND"));
    }

    @Test
    @DisplayName("Gemini: 500 -> AI_UPSTREAM_ERROR")
    void geminiMapsUpstreamError() {
        responseStatus = 500;
        responseBody = "{\"error\":\"server\"}";

        assertThatThrownBy(() -> gemini(700).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class)
                .satisfies(e -> assertThat(((OpenAiException) e).getCode()).isEqualTo("AI_UPSTREAM_ERROR"));
    }

    @Test
    @DisplayName("Gemini: loi khong phai HTTP -> AI_REQUEST_FAILED")
    void geminiMapsUnknownError() {
        responseStatus = 418;
        responseBody = "{\"error\":\"teapot\"}";

        assertThatThrownBy(() -> gemini(700).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class)
                .satisfies(e -> assertThat(((OpenAiException) e).getCode()).isEqualTo("AI_REQUEST_FAILED"));
    }

    @Test
    @DisplayName("Gemini: chua cau hinh -> AI_NOT_CONFIGURED")
    void geminiRejectsUnconfiguredService() {
        GeminiChatService service = new GeminiChatService("", "gemini-3.5-flash", baseUrl, 10, 700, true);

        assertThatThrownBy(() -> service.chat("system", "hi"))
                .isInstanceOf(OpenAiException.class)
                .satisfies(e -> assertThat(((OpenAiException) e).getCode()).isEqualTo("AI_NOT_CONFIGURED"));
    }

    @Test
    @DisplayName("Gemini: response rong -> AI_EMPTY_RESPONSE")
    void geminiRejectsEmptyContent() {
        responseBody = "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"\"}]}}]}";

        assertThatThrownBy(() -> gemini(700).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class)
                .satisfies(e -> assertThat(((OpenAiException) e).getCode()).isEqualTo("AI_EMPTY_RESPONSE"));
    }
}
