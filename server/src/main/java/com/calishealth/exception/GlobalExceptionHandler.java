package com.calishealth.exception;

import lombok.RequiredArgsConstructor;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
@RequiredArgsConstructor
public class GlobalExceptionHandler {
    private final MessageSource messageSource;

    /**
     * Nếu chuỗi trong exception là KEY (ví dụ "validation.email.format") thì dịch theo
     * locale hiện tại (Accept-Language); ngược lại giữ nguyên.
     */
    private String translate(String raw) {
        if (raw == null || raw.isBlank()) {
            return translate("error.invalid_data");
        }
        try {
            return messageSource.getMessage(raw, null, LocaleContextHolder.getLocale());
        } catch (org.springframework.context.NoSuchMessageException e) {
            // Không phải key i18n (message đã dịch sẵn) -> trả nguyên
            return raw;
        }
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleStatus(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("message", translate(e.getReason())));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        Map<String, String> errors = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors().forEach(f ->
                errors.putIfAbsent(f.getField(), translate(f.getDefaultMessage())));

        // Object-level errors (vd @AssertTrue isPasswordConfirmed) không nằm trong getFieldErrors()
        e.getBindingResult().getGlobalErrors().forEach(g ->
                errors.putIfAbsent(g.getObjectName(), translate(g.getDefaultMessage())));

        String message = errors.isEmpty()
                ? translate("error.invalid_data")
                : errors.values().stream().distinct().collect(Collectors.joining("; "));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", message);
        body.put("errors", errors);
        return ResponseEntity.badRequest().body(body);
    }
}
