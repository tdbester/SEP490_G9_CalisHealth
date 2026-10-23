package com.calishealth.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

import java.util.List;

/**
 * Lỗi nghiệp vụ của Survey Engine, được GlobalExceptionHandler đổi thành
 * {"code": "...", "message": "...", "errors": [...]}.
 */
@Getter
public class SurveyException extends RuntimeException {
    /** Lỗi chi tiết theo câu hỏi; stepCode/questionCode có thể null. */
    public record ErrorItem(String stepCode, String questionCode, String code, String message) {}

    private final HttpStatus status;
    private final String code;
    private final List<ErrorItem> errors;

    public SurveyException(HttpStatus status, String code, String message) {
        this(status, code, message, List.of());
    }

    public SurveyException(HttpStatus status, String code, String message, List<ErrorItem> errors) {
        super(message);
        this.status = status;
        this.code = code;
        this.errors = List.copyOf(errors);
    }

    public static SurveyException notFound(String code, String message) {
        return new SurveyException(HttpStatus.NOT_FOUND, code, message);
    }

    public static SurveyException badRequest(String code, String message) {
        return new SurveyException(HttpStatus.BAD_REQUEST, code, message);
    }

    public static SurveyException conflict(String code, String message) {
        return new SurveyException(HttpStatus.CONFLICT, code, message);
    }

    /** Cấu hình trong DB sai: log chi tiết ở server, client chỉ nhận thông báo chung. */
    public static SurveyException configInvalid() {
        return new SurveyException(HttpStatus.INTERNAL_SERVER_ERROR, "SURVEY_CONFIG_INVALID",
                "Survey configuration is invalid. Please contact the administrator.");
    }
}
