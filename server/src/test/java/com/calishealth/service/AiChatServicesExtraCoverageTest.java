package com.calishealth.service;

import com.calishealth.dtos.AiSupportDtos.AnswerResponse;
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
 * Bộ test bổ sung cho {@link OpenAiChatService} và {@link GeminiChatService}: các nhánh
 * cấu hình mặc định, dịch lỗi HTTP và parse response.
 */
class AiChatServicesExtraCoverageTest {

    private HttpServer server;
    private String baseUrl;
    private final List<String> receivedBodies = new ArrayList<>();
    private final List<String> receivedPaths = new ArrayList<>();
    private int responseStatus = 200;
    private String responseBody = "{}";
    /** Khi khác null, server dong ket noi ngay thay vi tra body. */
    private boolean closeWithoutBody = false;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            receivedPaths.add(exchange.getRequestURI().getPath());
            try (InputStream input = exchange.getRequestBody()) {
                receivedBodies.add(new String(input.readAllBytes(), StandardCharsets.UTF_8));
            }
            if (closeWithoutBody) {
                exchange.close();
                return;
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

    private OpenAiChatService openAi(String apiKey, int maxTokens) {
        return new OpenAiChatService(apiKey, "gpt-4o-mini", baseUrl, 10, maxTokens, true);
    }

    private GeminiChatService gemini(String apiKey, int maxTokens) {
        return new GeminiChatService(apiKey, "gemini-3.5-flash", baseUrl, 10, maxTokens, true);
    }

    // ----------------------------------------------------------- OpenAI config

    @Test
    @DisplayName("OpenAI: api key null -> khong duoc cau hinh")
    void openAiHandlesNullApiKey() {
        OpenAiChatService service = new OpenAiChatService(null, null, null, 0, 0, false);

        assertThat(service.isConfigured()).isFalse();
        assertThat(service.model()).isEqualTo("gpt-4o-mini");
        assertThat(service.baseUrl()).isEqualTo("https://api.openai.com");
        assertThat(service.isDemoFallbackEnabled()).isFalse();
    }

    @Test
    @DisplayName("OpenAI: danh sach tin nhan rong -> nem IllegalArgumentException")
    void openAiRejectsEmptyMessages() {
        assertThatThrownBy(() -> openAi("sk-test", 700).chat("system", List.of()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> openAi("sk-test", 700).chat("system", (List<AiChatProvider.ChatMessage>) null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("OpenAI: bo qua tin nhan rong khi gui len")
    void openAiSkipsBlankMessages() {
        responseBody = """
                {"choices":[{"message":{"content":"answer"}}],"usage":{"total_tokens":5}}
                """;
        OpenAiChatService service = openAi("sk-test", 700);

        service.chat("system", List.of(
                AiChatProvider.ChatMessage.user(""),
                AiChatProvider.ChatMessage.user("real question")));

        String body = receivedBodies.get(0);
        assertThat(body).contains("real question");
        assertThat(body).doesNotContain("\"content\":\"\"");
    }

    @Test
    @DisplayName("OpenAI: system prompt null -> gui chuoi rong")
    void openAiHandlesNullSystemPrompt() {
        responseBody = """
                {"choices":[{"message":{"content":"answer"}}],"usage":{"total_tokens":5}}
                """;
        openAi("sk-test", 700).chat(null, "question");

        assertThat(receivedBodies.get(0)).contains("\"role\":\"system\"");
    }

    @Test
    @DisplayName("OpenAI: response rong -> AI_EMPTY_RESPONSE")
    void openAiRejectsBlankResponse() {
        responseBody = "   ";
        assertThatThrownBy(() -> openAi("sk-test", 700).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class)
                .hasMessageContaining("AI Support");
    }

    @Test
    @DisplayName("OpenAI: response khong phai JSON -> AI_INVALID_RESPONSE")
    void openAiRejectsNonJsonResponse() {
        responseBody = "not json at all";
        assertThatThrownBy(() -> openAi("sk-test", 700).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class);
    }

    @Test
    @DisplayName("OpenAI: loi HTTP khong ro -> AI_REQUEST_FAILED")
    void openAiMapsUnknownHttpError() {
        responseStatus = 400;
        responseBody = "{\"error\":\"bad request\"}";

        assertThatThrownBy(() -> openAi("sk-test", 700).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class)
                .hasMessageContaining("AI Support");
    }

    @Test
    @DisplayName("OpenAI: toAnswer voi JSON hong -> dung noi dung thuan")
    void openAiFallsBackToPlainText() {
        AnswerResponse answer = openAi("sk-test", 700).toAnswer("Your hips dropped on rep 8.");

        assertThat(answer.causes()).hasSize(1);
        assertThat(answer.causes().get(0).detail()).contains("hips dropped");
    }

    @Test
    @DisplayName("OpenAI: toAnswer voi noi dung rong -> khong co nguyen nhan")
    void openAiHandlesEmptyAnswer() {
        AnswerResponse answer = openAi("sk-test", 700).toAnswer("   ");

        assertThat(answer.causes()).isEmpty();
        assertThat(answer.tip()).isEmpty();
        assertThat(answer.followUps()).isEmpty();
    }

    @Test
    @DisplayName("OpenAI: toAnswer bo qua nguyen nhan rong tieu de")
    void openAiSkipsCausesWithoutTitle() {
        AnswerResponse answer = openAi("sk-test", 700).toAnswer(
                "{\"causes\":[{\"title\":\"\",\"detail\":\"x\"},{\"title\":\"Good\",\"detail\":\"y\"}]}");

        assertThat(answer.causes()).hasSize(1);
        assertThat(answer.causes().get(0).title()).isEqualTo("Good");
    }

    // ----------------------------------------------------------- Gemini config

    @Test
    @DisplayName("Gemini: api key null -> khong duoc cau hinh")
    void geminiHandlesNullApiKey() {
        GeminiChatService service = new GeminiChatService(null, null, null, 0, 0, false);

        assertThat(service.isConfigured()).isFalse();
        assertThat(service.model()).isEqualTo("gemini-3.5-flash");
        assertThat(service.baseUrl()).isEqualTo("https://generativelanguage.googleapis.com");
        assertThat(service.isDemoFallbackEnabled()).isFalse();
    }

    @Test
    @DisplayName("Gemini: danh sach tin nhan rong -> nem IllegalArgumentException")
    void geminiRejectsEmptyMessages() {
        assertThatThrownBy(() -> gemini("key", 1024).chat("system", List.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Gemini: gui len dung endpoint va role model")
    void geminiSendsCorrectPayload() {
        responseBody = """
                {"candidates":[{"content":{"parts":[{"text":"answer"}]}}],
                 "usageMetadata":{"totalTokenCount":11}}
                """;
        GeminiChatService service = gemini("key", 1024);

        AiChatProvider.ChatResult result = service.chat("system prompt", List.of(
                AiChatProvider.ChatMessage.user("question"),
                AiChatProvider.ChatMessage.assistant("earlier")));

        assertThat(result.content()).isEqualTo("answer");
        assertThat(result.totalTokens()).isEqualTo(11);
        assertThat(receivedPaths.get(0)).contains("generateContent");
        String body = receivedBodies.get(0);
        assertThat(body).contains("\"role\":\"model\"");
        assertThat(body).contains("\"thinkingBudget\":0");
        assertThat(body).contains("systemInstruction");
    }

    @Test
    @DisplayName("Gemini: bo qua tin nhan rong")
    void geminiSkipsBlankMessages() {
        responseBody = """
                {"candidates":[{"content":{"parts":[{"text":"answer"}]}}]}
                """;
        gemini("key", 1024).chat("system", List.of(
                AiChatProvider.ChatMessage.user("  "),
                AiChatProvider.ChatMessage.user("real")));

        assertThat(receivedBodies.get(0)).contains("real");
    }

    @Test
    @DisplayName("Gemini: response rong -> loi")
    void geminiRejectsBlankResponse() {
        responseBody = "";
        assertThatThrownBy(() -> gemini("key", 1024).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class);
    }

    @Test
    @DisplayName("Gemini: response khong phai JSON -> loi")
    void geminiRejectsNonJsonResponse() {
        responseBody = "<<<not json>>>";
        assertThatThrownBy(() -> gemini("key", 1024).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class);
    }

    @Test
    @DisplayName("Gemini: finish reason MAX_TOKENS -> thu lai voi ngan sach lon hon")
    void geminiRetriesWhenTruncated() {
        responseBody = """
                {"candidates":[{"content":{"parts":[{"text":"{\\"causes\\""}]},"finishReason":"MAX_TOKENS"}]}
                """;
        GeminiChatService service = new GeminiChatService("key", "gemini-3.5-flash", baseUrl, 10, 1024, true);

        assertThatThrownBy(() -> service.chat("system", "hi")).isInstanceOf(OpenAiException.class);
        assertThat(receivedBodies).hasSize(2);
    }

    @Test
    @DisplayName("Gemini: response bi cat cụt -> loi AI_TRUNCATED")
    void geminiReportsTruncation() {
        responseBody = """
                {"candidates":[{"content":{"parts":[{"text":"answer"}]},"finishReason":"MAX_TOKENS"}]}
                """;

        assertThatThrownBy(() -> gemini("key", 1024).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class);
    }

    @Test
    @DisplayName("Gemini: 400 voi API key sai -> AI_INVALID_KEY")
    void geminiMapsInvalidKey() {
        responseStatus = 400;
        responseBody = "{\"error\":{\"message\":\"API key not valid\"}}";

        assertThatThrownBy(() -> gemini("key", 1024).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class)
                .hasMessageContaining("AI Support");
    }

    @Test
    @DisplayName("Gemini: 404 -> loi")
    void geminiMapsModelNotFound() {
        responseStatus = 404;
        responseBody = "{\"error\":\"model not found\"}";

        assertThatThrownBy(() -> gemini("key", 1024).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class);
    }

    @Test
    @DisplayName("Gemini: 429 -> loi")
    void geminiMapsRateLimit() {
        responseStatus = 429;
        responseBody = "{\"error\":\"quota\"}";

        assertThatThrownBy(() -> gemini("key", 1024).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class);
    }

    @Test
    @DisplayName("Gemini: 500 -> loi")
    void geminiMapsServerError() {
        responseStatus = 500;
        responseBody = "{\"error\":\"server\"}";

        assertThatThrownBy(() -> gemini("key", 1024).chat("system", "hi"))
                .isInstanceOf(OpenAiException.class);
    }

    @Test
    @DisplayName("Gemini: toAnswer parse JSON -> lay nguyen nhan va cau hoi goi y")
    void geminiParsesStructuredAnswer() {
        AnswerResponse answer = gemini("key", 1024).toAnswer(
                "{\"causes\":[{\"title\":\"Poor bracing\",\"detail\":\"Hips drop.\"}],"
                        + "\"tip\":\"Brace harder.\",\"followUps\":[\"How?\"]}");

        assertThat(answer.causes()).hasSize(1);
        assertThat(answer.tip()).isEqualTo("Brace harder.");
        assertThat(answer.followUps()).containsExactly("How?");
    }

    @Test
    @DisplayName("Gemini: toAnswer JSON hong -> dung noi dung thuan")
    void geminiFallsBackToPlainText() {
        AnswerResponse answer = gemini("key", 1024).toAnswer("Knee caves inward.");

        assertThat(answer.causes()).hasSize(1);
        assertThat(answer.causes().get(0).detail()).contains("Knee caves");
    }

    @Test
    @DisplayName("Gemini: toAnswer rong -> khong co nguyen nhan")
    void geminiHandlesEmptyAnswer() {
        AnswerResponse answer = gemini("key", 1024).toAnswer(null);

        assertThat(answer.causes()).isEmpty();
    }
}
