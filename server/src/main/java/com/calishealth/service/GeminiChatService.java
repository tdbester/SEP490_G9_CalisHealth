package com.calishealth.service;

import com.calishealth.dtos.AiSupportDtos.AnswerResponse;
import com.calishealth.dtos.AiSupportDtos.LikelyCause;
import com.calishealth.exception.OpenAiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Bọc Google Gemini API (Generative Language API).
 *
 * Gemini free tier cho phép gọi miễn phí với rate limit hợp lý, phù hợp để
 * demo mà không cần nạp credit như OpenAI.
 *
 * Endpoint: {@code POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent}
 *
 * Cùng interface với {@link OpenAiChatService} nên {@link AiSupportService}
 * không cần sửa khi đổi provider — chỉ đổi cấu hình trong .env.
 */
@Service
@Slf4j
public class GeminiChatService implements AiChatProvider {

    /** Trần ngân sách token khi thử lại sau khi bị cắt cụt. */
    private static final int MAX_RETRY_OUTPUT_TOKENS = 4096;

    private final RestClient restClient;
    private final String apiKey;
    private final String model;
    private final String baseUrl;
    /**
     * Ngân sách token cho câu trả lời.
     *
     * <p>Cố định (không đổi theo request) để service vẫn an toàn khi chạy
     * song song nhiều request AI.
     */
    private final int maxOutputTokens;
    private final boolean demoFallbackEnabled;
    private final ObjectMapper mapper = new ObjectMapper();

    public GeminiChatService(
            @Value("${app.gemini.api-key:}") String apiKey,
            @Value("${app.gemini.model:gemini-3.5-flash}") String model,
            @Value("${app.gemini.base-url:https://generativelanguage.googleapis.com}") String baseUrl,
            @Value("${app.gemini.timeout-seconds:45}") int timeoutSeconds,
            @Value("${app.gemini.max-output-tokens:1024}") int maxOutputTokens,
            @Value("${app.gemini.demo-fallback:true}") boolean demoFallbackEnabled
    ) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = (model == null || model.isBlank()) ? "gemini-3.5-flash" : model.trim();
        this.baseUrl = (baseUrl == null || baseUrl.isBlank())
                ? "https://generativelanguage.googleapis.com"
                : baseUrl.trim();
        // Ngân sách token cho câu trả lời. Nếu prompt dài (nhiều form rule +
        // hồ sơ sinh lý) thì 1024 token có thể hơi chật; nên cho phép chỉnh
        // qua biến môi trường GEMINI_MAX_OUTPUT_TOKENS.
        this.maxOutputTokens = maxOutputTokens <= 0 ? 1024 : maxOutputTokens;
        this.demoFallbackEnabled = demoFallbackEnabled;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        Duration timeout = Duration.ofSeconds(Math.max(5, timeoutSeconds));
        requestFactory.setConnectTimeout(timeout);
        requestFactory.setReadTimeout(timeout);
        this.restClient = RestClient.builder()
                .baseUrl(this.baseUrl)
                .requestFactory(requestFactory)
                .build();
    }

    @Override
    public boolean isConfigured() {
        return !apiKey.isBlank();
    }

    /**
     * Chế độ demo: khi API lỗi thì trả lời bằng rule nội bộ kèm cờ báo rõ.
     */
    @Override
    public boolean isDemoFallbackEnabled() {
        return demoFallbackEnabled;
    }

    @Override
    public String model() {
        return model;
    }

    /** Base URL đang dùng (để log, không log api key). */
    public String baseUrl() {
        return baseUrl;
    }

    @Override
    public ChatResult chat(String systemPrompt, String userPrompt) {
        return chat(systemPrompt, List.of(new ChatMessage("user", userPrompt)));
    }

    @Override
    public ChatResult chat(String systemPrompt, List<ChatMessage> messages) {
        if (!isConfigured()) {
            throw new OpenAiException(
                    "AI_NOT_CONFIGURED",
                    "AI Support is not configured on this server yet.",
                    null);
        }
        if (messages == null || messages.isEmpty()) {
            throw new IllegalArgumentException("At least one chat message is required");
        }

        int budget = maxOutputTokens;
        try {
            return execute(systemPrompt, messages, budget);
        } catch (OpenAiException exception) {
            // Bị cắt cụt vì hết ngân sách token -> thử lại với ngân sách gấp đôi
            // (một lần duy nhất) trước khi báo lỗi cho member.
            if (!"AI_TRUNCATED".equals(exception.getCode())) {
                throw exception;
            }
            int biggerBudget = Math.min(budget * 2, MAX_RETRY_OUTPUT_TOKENS);
            if (biggerBudget <= budget) {
                throw exception;
            }
            log.warn("Retrying Gemini with a larger token budget: {} -> {}", budget, biggerBudget);
            return execute(systemPrompt, messages, biggerBudget);
        }
    }

    /** Gọi Gemini một lần với ngân sách token cho trước. */
    private ChatResult execute(String systemPrompt, List<ChatMessage> messages, int outputTokens) {
        ObjectNode payload = mapper.createObjectNode();
        ArrayNode contents = payload.putArray("contents");

        for (ChatMessage message : messages) {
            if (message == null || message.content() == null || message.content().isBlank()) {
                continue;
            }
            ObjectNode node = contents.addObject();
            // Gemini dùng "user"/"model" thay cho "user"/"assistant".
            String role = "assistant".equalsIgnoreCase(message.role()) ? "model" : "user";
            node.put("role", role);
            ArrayNode parts = node.putArray("parts");
            parts.addObject().put("text", message.content());
        }

        // System instruction nằm riêng trong Gemini (systemInstruction).
        ObjectNode generationConfig = payload.putObject("generationConfig");
        generationConfig.put("temperature", 0.4);
        generationConfig.put("maxOutputTokens", outputTokens);
        generationConfig.put("responseMimeType", "application/json");
        // Gemini 3.x mặc định bật "thinking" -> thoughtsTokenCount có thể ăn hết
        // maxOutputTokens và cắt cụt JSON trả về. Tắt thinking để câu trả lời
        // luôn là JSON đầy đủ, parse được.
        generationConfig.putObject("thinkingConfig").put("thinkingBudget", 0);
        if (systemPrompt != null && !systemPrompt.isBlank()) {
            ObjectNode instruction = payload.putObject("systemInstruction");
            ArrayNode parts = instruction.putArray("parts");
            parts.addObject().put("text", systemPrompt);
        }

        String body;
        try {
            body = mapper.writeValueAsString(payload);
        } catch (Exception exception) {
            throw new OpenAiException(
                    "AI_REQUEST_FAILED",
                    "AI Support could not answer right now. Please try again.",
                    exception);
        }

        String response;
        try {
            response = restClient.post()
                    .uri("/v1beta/models/{model}:generateContent", model)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("x-goog-api-key", apiKey)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);
        } catch (RestClientException exception) {
            throw translate(exception);
        }

        return parse(response);
    }

    /**
     * Dịch lỗi HTTP của Gemini sang {@link OpenAiException} có mã rõ ràng.
     *
     * - 400 với {@code API_KEY_INVALID}: key sai -> lỗi cấu hình.
     * - 429: hết hạn mức request/phân bổ -> báo member thử lại sau.
     * - 5xx: Gemini đang lỗi -> báo tạm thời không khả dụng.
     */
    private OpenAiException translate(RestClientException exception) {
        String raw = exception.getMessage() == null ? "" : exception.getMessage();
        log.error("Gemini request failed: {}", raw);

        int status = 0;
        String responseBody = "";
        if (exception instanceof org.springframework.web.client.RestClientResponseException responseException) {
            status = responseException.getStatusCode().value();
            responseBody = responseException.getResponseBodyAsString();
        }

        String lower = responseBody.toLowerCase(Locale.ROOT);
        if (status == 400 && (lower.contains("api_key_invalid") || lower.contains("api key not valid"))) {
            return new OpenAiException(
                    "AI_INVALID_KEY",
                    "AI Support is not configured correctly on the server right now.",
                    exception);
        }
        if (status == 400 || status == 403) {
            return new OpenAiException(
                    "AI_INVALID_KEY",
                    "AI Support is not configured correctly on the server right now.",
                    exception);
        }
        if (status == 429) {
            // Gemini free tier có quota theo phút/ngày -> báo member thử lại.
            return new OpenAiException(
                    "AI_RATE_LIMITED",
                    "AI Support is busy right now. Please try again in a moment.",
                    exception);
        }
        if (status == 404) {
            return new OpenAiException(
                    "AI_MODEL_NOT_FOUND",
                    "AI Support is not configured correctly on the server right now.",
                    exception);
        }
        if (status >= 500) {
            return new OpenAiException(
                    "AI_UPSTREAM_ERROR",
                    "AI Support is temporarily unavailable. Please try again shortly.",
                    exception);
        }
        return new OpenAiException(
                "AI_REQUEST_FAILED",
                "AI Support could not answer right now. Please try again.",
                exception);
    }

    /** Đọc nội dung JSON trả về và số token đã dùng. */
    private ChatResult parse(String body) {
        if (body == null || body.isBlank()) {
            throw new OpenAiException(
                    "AI_EMPTY_RESPONSE",
                    "AI Support could not answer right now. Please try again.",
                    null);
        }
        try {
            JsonNode root = mapper.readTree(body);
            JsonNode candidate = root.path("candidates").path(0);
            JsonNode part = candidate.path("content").path("parts").path(0);
            String content = part.path("text").asText("");
            String finishReason = candidate.path("finishReason").asText("");
            if (content.isBlank()) {
                throw new OpenAiException(
                        "AI_EMPTY_RESPONSE",
                        "AI Support could not answer right now. Please try again.",
                        null);
            }
            // Bị cắt cụt vì hết ngân sách token -> JSON thường thiếu nốt -> không
            // parse được. Báo lỗi rõ ràng để tầng trên có thể thử lại.
            if ("MAX_TOKENS".equalsIgnoreCase(finishReason)) {
                log.warn("Gemini response was truncated (finishReason=MAX_TOKENS)");
                throw new OpenAiException(
                        "AI_TRUNCATED",
                        "AI Support could not answer right now. Please try again.",
                        null);
            }
            int tokens = root.path("usageMetadata").path("totalTokenCount").asInt(0);
            return new ChatResult(content, tokens);
        } catch (OpenAiException exception) {
            throw exception;
        } catch (Exception exception) {
            log.error("Failed to parse Gemini response", exception);
            throw new OpenAiException(
                    "AI_INVALID_RESPONSE",
                    "AI Support could not answer right now. Please try again.",
                    exception);
        }
    }

    /**
     * Đóng gói nội dung trả lời thô của AI thành cấu trúc mà UI hiển thị:
     * 3 nguyên nhân + 1 mẹp sửa + câu hỏi gợi ý.
     *
     * Nếu AI trả về JSON không đúng format, fallback sang phân tích text thuần
     * để member vẫn nhận được câu trả lời.
     */
    @Override
    public AnswerResponse toAnswer(String rawContent) {
        List<LikelyCause> causes = new ArrayList<>();
        String tip = "";
        List<String> followUps = new ArrayList<>();

        // Bỏ vỏ markdown trước khi parse: model đôi khi bọc JSON trong ```json.
        String cleaned = AiChatProvider.stripMarkdownFence(rawContent);
        try {
            JsonNode root = mapper.readTree(cleaned == null ? "{}" : cleaned);
            for (JsonNode node : root.path("causes")) {
                String title = node.path("title").asText("").trim();
                String detail = node.path("detail").asText("").trim();
                if (!title.isEmpty()) {
                    causes.add(new LikelyCause(title, detail));
                }
            }
            tip = root.path("tip").asText("").trim();
            for (JsonNode node : root.path("followUps")) {
                String value = node.asText("").trim();
                if (!value.isEmpty()) {
                    followUps.add(value);
                }
            }
        } catch (Exception exception) {
            log.warn("Gemini answer was not valid JSON, falling back to plain text", exception);
        }

        // Không parse được -> dùng chính nội dung text làm 1 nguyên nhân.
        if (causes.isEmpty()) {
            String plain = cleaned == null ? "" : cleaned.trim();
            if (!plain.isEmpty()) {
                causes.add(new LikelyCause("AI coach feedback", plain));
            }
        }
        return new AnswerResponse(List.copyOf(causes), tip, List.copyOf(followUps));
    }
}
