package com.calishealth.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.Map;

/**
 * Tra 401 + JSON message (da dich theo Accept-Language) khi CHUA DANG NHAP
 * (thieu token, token sai, token het han).
 * Truoc day backend tra 401 voi body rong, khong hien thi duoc tren UI.
 */
@Component
@RequiredArgsConstructor
public class UnauthorizedEntryPoint implements AuthenticationEntryPoint {
    private final MessageSource messageSource;
    private final ObjectMapper objectMapper;

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        String message = messageSource.getMessage("auth.unauthorized", null, LocaleContextHolder.getLocale());
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getWriter(), Map.of("message", message));
    }
}
