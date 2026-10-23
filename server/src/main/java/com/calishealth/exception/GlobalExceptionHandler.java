package com.calishealth.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleStatus(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("message", e.getReason()));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleNotFound(ResourceNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        Map<String, String> errors = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors().forEach(f ->
                errors.putIfAbsent(f.getField(), f.getDefaultMessage()));

        String message = errors.isEmpty()
                ? "Dữ liệu không hợp lệ"
                : errors.values().stream().distinct().collect(Collectors.joining("; "));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", "INVALID_REQUEST");
        body.put("message", message);
        body.put("errors", errors);
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(SurveyException.class)
    public ResponseEntity<Map<String, Object>> handleSurvey(SurveyException e) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", e.getCode());
        body.put("message", e.getMessage());
        if (!e.getErrors().isEmpty()) {
            body.put("errors", e.getErrors());
        }
        return ResponseEntity.status(e.getStatus()).body(body);
    }

    /** JSON hỏng hoặc sai kiểu ở mức cấu trúc request - không trả chi tiết parser ra ngoài. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> handleUnreadable(HttpMessageNotReadableException e) {
        return invalidRequest("Request body is missing or is not valid JSON for this endpoint");
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, String>> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        return invalidRequest("Parameter '" + e.getName() + "' has an invalid value");
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, String>> handleMissingParam(MissingServletRequestParameterException e) {
        return invalidRequest("Parameter '" + e.getParameterName() + "' is required");
    }

    private static ResponseEntity<Map<String, String>> invalidRequest(String message) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("code", "INVALID_REQUEST", "message", message));
    }
}
