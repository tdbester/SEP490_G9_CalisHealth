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

/**
 * Bọc OpenAI Chat Completions API (model {@code gpt-4o-mini}).
 *
 * Dùng {@link RestClient} của Spring thay vì thêm SDK — payload Chat
 * Completions khá đơn giản, và project không muốn thêm dependency.
 *
 * Khi chưa cấu hình {@code OPENAI_API_KEY}, service vẫn khởi động bình thường
 * (không crash app); lúc đó {@link #isConfigured()} trả false và tầng trên
 * có thể trả lời bằng fallback nội bộ.
 */
@Service
@Slf4j
public class OpenAiChatService {

    private static final String CHAT_COMPLETIONS_PATH = "/v1/chat/completions";

    private final RestClient restClient;
    private final String apiKey;
    private final String model;
    private final String baseUrl;
    private final int maxOutputTokens;
    private final boolean demoFallbackEnabled;
    private final ObjectMapper mapper = new ObjectMapper();

    public OpenAiChatService(
            @Value("${app.openai.api-key:}") String apiKey,
            @Value("${app.openai.model:gpt-4o-mini}") String model,
            @Value("${app.openai.base-url:https://api.openai.com}") String baseUrl,
            @Value("${app.openai.timeout-seconds:45}") int timeoutSeconds,
            @Value("${app.openai.demo-fallback:true}") boolean demoFallbackEnabled
    ) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = (model == null || model.isBlank()) ? "gpt-4o-mini" : model.trim();
        this.baseUrl = (baseUrl == null || baseUrl.isBlank())
                ? "https://api.openai.com"
                : baseUrl.trim();
        this.maxOutputTokens = 700;
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

    /** Đã cấu hình API key để gọi AI thật chưa. */
    public boolean isConfigured() {
        return !apiKey.isBlank();
    }

    /**
     * Có bật chế độ demo (tự trả lời bằng rule nội bộ khi API lỗi) không.
     *
     * Bật mặc định để demo được khi tài khoản OpenAI chưa nạp credit hoặc
     * server mất mạng. Câu trả lời fallback luôn được gắn cờ để member
     * biết đó không phải câu trả lời từ AI thật.
     */
    public boolean isDemoFallbackEnabled() {
        return demoFallbackEnabled;
    }

    /** Model đang dùng (để hiển thị/log). */
    public String model() {
        return model;
    }

    /** Base URL đang dùng (để log, không log api key). */
    public String baseUrl() {
        return baseUrl;
    }

    /**
     * Gửi một lượt chat và nhận về nội dung trả lời.
     *
     * @param systemPrompt persona + ngữ cảnh (form rules, accuracy...)
     * @param userPrompt    câu hỏi của member
     * @return kết quả gồm nội dung trả lời và số token đã dùng
     */
    public ChatResult chat(String systemPrompt, String userPrompt) {
        return chat(systemPrompt, List.of(new ChatMessage("user", userPrompt)));
    }

    /**
     * Gửi một lượt chat kèm lịch sử hội thoại trước đó.
     *
     * Giữ lịch sử giúp AI nhớ được ngữ cảnh các câu hỏi trước trong cùng
     * phiên chat (thay vì mỗi câu đều độc lập), đồng thời giảm phí vì member
     * không phải lặp lại thông tin đã nói.
     *
     * @param systemPrompt persona + ngữ cảnh (form rules, accuracy...)
     * @param messages     lịch sử chat (role + content), phần tử cuối là câu hỏi mới
     */
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

        ObjectNode payload = mapper.createObjectNode();
        payload.put("model", model);
        payload.put("temperature", 0.4);
        payload.put("max_completion_tokens", maxOutputTokens);
        payload.set("response_format", mapper.createObjectNode().put("type", "json_object"));

        ArrayNode array = payload.putArray("messages");
        ObjectNode systemNode = array.addObject();
        systemNode.put("role", "system");
        systemNode.put("content", systemPrompt == null ? "" : systemPrompt);
        for (ChatMessage message : messages) {
            if (message == null || message.content() == null || message.content().isBlank()) {
                continue;
            }
            ObjectNode node = array.addObject();
            node.put("role", message.role());
            node.put("content", message.content());
        }

        // Gửi dạng chuỗi JSON thuần để không phụ thuộc converter của
        // RestClient (Jackson 2 vs Jackson 3 đều gửi đúng body).
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
                    .uri(CHAT_COMPLETIONS_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + apiKey)
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
     * Dịch lỗi HTTP của OpenAI sang {@link OpenAiException} có mã rõ ràng.
     *
     * - 401/403: API key sai hoặc không có quyền -> lỗi cấu hình.
     * - 429 với {@code insufficient_quota}: hết credit trong tài khoản ->
     *   lỗi cấu hình của chủ dự án, không phải tạm thời.
     * - 429 còn lại: rate limit -> báo member thử lại sau.
     * - 5xx: OpenAI đang lỗi -> báo tạm thời không khả dụng.
     */
    private OpenAiException translate(RestClientException exception) {
        String raw = exception.getMessage() == null ? "" : exception.getMessage();
        log.error("OpenAI request failed: {}", raw);

        int status = 0;
        String responseBody = "";
        if (exception instanceof org.springframework.web.client.HttpStatusCodeException statusException) {
            status = statusException.getStatusCode().value();
            responseBody = statusException.getResponseBodyAsString();
        } else if (exception instanceof org.springframework.web.client.RestClientResponseException responseException) {
            status = responseException.getStatusCode().value();
            responseBody = responseException.getResponseBodyAsString();
        }

        if (status == 401 || status == 403) {
            return new OpenAiException(
                    "AI_INVALID_KEY",
                    "AI Support is not configured correctly on the server right now.",
                    exception);
        }
        if (status == 429) {
            // Hết credit -> lỗi cấu hình tài khoản, không phải tạm thời.
            if (responseBody.contains("insufficient_quota")
                    || responseBody.contains("credit_balance_exhausted")) {
                return new OpenAiException(
                        "AI_OUT_OF_CREDITS",
                        "AI Support has run out of API credits on the server right now.",
                        exception);
            }
            return new OpenAiException(
                    "AI_RATE_LIMITED",
                    "AI Support is busy right now. Please try again in a moment.",
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
            JsonNode message = root.path("choices").path(0).path("message");
            String content = message.path("content").asText("");
            if (content.isBlank()) {
                throw new OpenAiException(
                        "AI_EMPTY_RESPONSE",
                        "AI Support could not answer right now. Please try again.",
                        null);
            }
            int tokens = root.path("usage").path("total_tokens").asInt(0);
            return new ChatResult(content, tokens);
        } catch (OpenAiException exception) {
            throw exception;
        } catch (Exception exception) {
            log.error("Failed to parse OpenAI response", exception);
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
    public AnswerResponse toAnswer(String rawContent) {
        List<LikelyCause> causes = new ArrayList<>();
        String tip = "";
        List<String> followUps = new ArrayList<>();

        try {
            JsonNode root = mapper.readTree(rawContent == null ? "{}" : rawContent);
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
            log.warn("AI answer was not valid JSON, falling back to plain text", exception);
        }

        // Không parse được -> dùng chính nội dung text làm 1 nguyên nhân.
        if (causes.isEmpty()) {
            String plain = rawContent == null ? "" : rawContent.trim();
            if (!plain.isEmpty()) {
                causes.add(new LikelyCause("AI coach feedback", plain));
            }
        }
        return new AnswerResponse(List.copyOf(causes), tip, List.copyOf(followUps));
    }

    /** Một tin nhắn trong hội thoại (system/user/assistant). */
    public record ChatMessage(String role, String content) {
        public static ChatMessage user(String content) {
            return new ChatMessage("user", content);
        }

        public static ChatMessage assistant(String content) {
            return new ChatMessage("assistant", content);
        }
    }

    /** Kết quả một lượt gọi AI: nội dung + số token đã dùng. */
    public record ChatResult(String content, int totalTokens) {}
}
