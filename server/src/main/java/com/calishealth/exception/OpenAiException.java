package com.calishealth.exception;

/**
 * Lỗi khi gọi OpenAI API.
 *
 * Mang theo mã lỗi để tầng trên (controller / frontend) biết chính xác
 * nguyên nhân và hiển thị đúng thông báo cho member, thay vì nuốt lỗi rồi
 * trả về câu trả lời giả.
 */
public class OpenAiException extends RuntimeException {

    /** Mã lỗi (đồng thời là mã frontend dùng để dịch thông báo). */
    private final String code;

    /** Thông báo thân thiện cho member. */
    private final String userMessage;

    public OpenAiException(String code, String userMessage, Throwable cause) {
        super(userMessage, cause);
        this.code = code;
        this.userMessage = userMessage;
    }

    public String getCode() {
        return code;
    }

    public String getUserMessage() {
        return userMessage;
    }
}
