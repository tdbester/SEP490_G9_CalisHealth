package com.calishealth.service;

import com.calishealth.dtos.AiSupportDtos.AnswerResponse;
import com.calishealth.exception.OpenAiException;

import java.util.List;

/**
 * Lớp bọc API chat của một nhà cung cấp AI.
 *
 * Hiện hỗ trợ:
 * - {@link OpenAiChatService} — OpenAI Chat Completions (gpt-4o-mini).
 * - {@link GeminiChatService} — Google Gemini (free tier qua API key).
 *
 * Tách interface để {@link AiSupportService} không phụ thuộc vào một
 * nhà cung cấp cụ thể: đổi provider chỉ việc đổi cấu hình, không phải sửa logic.
 */
public interface AiChatProvider {

    /** Đã cấu hình API key để gọi AI thật chưa. */
    boolean isConfigured();

    /** Tên model đang dùng (để hiển thị/log). */
    String model();

    /**
     * Có bật chế độ demo không (khi API lỗi thì trả lời bằng rule nội bộ
     * kèm cờ báo rõ cho member, thay vì báo lỗi).
     */
    boolean isDemoFallbackEnabled();

    /** Nhãn provider (vd: "gemini-2.0-flash") — hiển thị cho member. */
    default String providerName() {
        return model();
    }

    /**
     * Gửi một lượt chat kèm lịch sử hội thoại và nhận về nội dung trả lời.
     *
     * @param systemPrompt persona + ngữ cảnh (form rules, accuracy...)
     * @param messages     lịch sử chat (role + content), phần tử cuối là câu hỏi mới
     */
    /**
     * Gửi một lượt chat đơn giản (không có lịch sử hội thoại).
     *
     * @param systemPrompt persona + ngữ cảnh (form rules, accuracy...)
     * @param userPrompt    câu hỏi của member
     */
    ChatResult chat(String systemPrompt, String userPrompt);

    /**
     * Gửi một lượt chat kèm lịch sử hội thoại trước đó.
     *
     * @param systemPrompt persona + ngữ cảnh (form rules, accuracy...)
     * @param messages     lịch sử chat (role + content), phần tử cuối là câu hỏi mới
     */
    ChatResult chat(String systemPrompt, List<ChatMessage> messages);

    /**
     * Đóng gói nội dung trả lời thô của AI thành cấu trúc UI hiển thị.
     *
     * @param rawContent nội dung trả lời thô (thường là JSON)
     */
    AnswerResponse toAnswer(String rawContent);

    /** Một tin nhắn trong hội thoại (system/user/assistant). */
    record ChatMessage(String role, String content) {
        public static ChatMessage user(String content) {
            return new ChatMessage("user", content);
        }

        public static ChatMessage assistant(String content) {
            return new ChatMessage("assistant", content);
        }
    }

    /** Kết quả một lượt gọi AI: nội dung + số token đã dùng. */
    record ChatResult(String content, int totalTokens) {}

    /** Lỗi chuẩn hoá từ mọi provider (dùng chung để tầng trên xử lý). */
    class ProviderException extends RuntimeException {
        private final String code;

        public ProviderException(String code, String userMessage, Throwable cause) {
            super(userMessage, cause);
            this.code = code;
        }

        public String getCode() {
            return code;
        }
    }
}
