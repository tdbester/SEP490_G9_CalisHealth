package com.calishealth.service;

import com.calishealth.dtos.AiSupportDtos.AnswerResponse;
import com.calishealth.dtos.AiSupportDtos.LikelyCause;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;

/**
 * Bọc OpenAI Chat Completions API.
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

    public OpenAiChatService(
            @Value("${app.openai.api-key:}") String apiKey,
            @Value("${app.openai.model:gpt-4o-mini}") String model,
            @Value("${app.openai.base-url:https://api.openai.com}") String baseUrl
    ) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model;
        this.baseUrl = baseUrl;
        this.restClient = RestClient.builder().baseUrl(baseUrl).build();
    }

    /** Đã cấu hình API key để gọi AI thật chưa. */
    public boolean isConfigured() {
        return !apiKey.isBlank();
    }

    /**
     * Gửi một lượt chat và nhận về nội dung trả lời.
     *
     * @param systemPrompt persona + ngữ cảnh (form rules, accuracy...)
     * @param userPrompt    câu hỏi của member
     * @return kết quả gồm nội dung trả lời và số token đã dùng
     */
    public ChatResult chat(String systemPrompt, String userPrompt) {
        if (!isConfigured()) {
            throw new IllegalStateException("OpenAI API key is not configured");
        }

        String payload = """
                {
                  "model": "%s",
                  "temperature": 0.4,
                  "response_format": { "type": "json_object" },
                  "messages": [
                    { "role": "system", "content": %s },
                    { "role": "user", "content": %s }
                  ]
                }
                """.formatted(model, jsonString(systemPrompt), jsonString(userPrompt));

        String body = restClient.post()
                .uri(CHAT_COMPLETIONS_PATH)
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", "Bearer " + apiKey)
                .body(payload)
                .retrieve()
                .body(String.class);

        return parse(body);
    }

    /** Đọc nội dung JSON trả về và số token đã dùng. */
    private ChatResult parse(String body) {
        if (body == null || body.isBlank()) {
            throw new IllegalStateException("OpenAI returned an empty response");
        }
        try {
            JsonNode root = com.fasterxml.jackson.databind.json.JsonMapper.builder()
                    .build()
                    .readTree(body);
            JsonNode message = root.path("choices").path(0).path("message");
            String content = message.path("content").asText("");
            int tokens = root.path("usage").path("total_tokens").asInt(0);
            return new ChatResult(content, tokens);
        } catch (Exception exception) {
            log.error("Failed to parse OpenAI response", exception);
            throw new IllegalStateException("Couldn't read the AI response", exception);
        }
    }

    /**
     * Đóng gói nội dung trả lời thô của AI thành cấu trúc mà UI hiển thị:
     * 3 nguyên nhân + 1 mẹo sửa + câu hỏi gợi ý.
     *
     * Nếu AI trả về JSON không đúng format, fallback sang phân tích text thuần
     * để member vẫn nhận được câu trả lời.
     */
    public AnswerResponse toAnswer(String rawContent) {
        List<LikelyCause> causes = new ArrayList<>();
        String tip = "";
        List<String> followUps = new ArrayList<>();

        try {
            JsonNode root = com.fasterxml.jackson.databind.json.JsonMapper.builder()
                    .build()
                    .readTree(rawContent == null ? "{}" : rawContent);
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

    /**
     * Bọc nội dung thành chuỗi JSON an toàn (escape quote, backslash, newline).
     */
    static String jsonString(String value) {
        if (value == null) {
            return "\"\"";
        }
        StringBuilder builder = new StringBuilder(value.length() + 16);
        builder.append('"');
        for (int index = 0; index < value.length(); index += 1) {
            char character = value.charAt(index);
            switch (character) {
                case '"' -> builder.append("\\\"");
                case '\\' -> builder.append("\\\\");
                case '\n' -> builder.append("\\n");
                case '\r' -> builder.append("\\r");
                case '\t' -> builder.append("\\t");
                default -> {
                    if (character < 0x20) {
                        builder.append(String.format("\\u%04x", (int) character));
                    } else {
                        builder.append(character);
                    }
                }
            }
        }
        builder.append('"');
        return builder.toString();
    }

    /** Kết quả một lượt gọi AI: nội dung + số token đã dùng. */
    public record ChatResult(String content, int totalTokens) {}
}
