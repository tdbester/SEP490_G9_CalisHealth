package com.calishealth.service;

import lombok.RequiredArgsConstructor;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * Gộp chuỗi hiển thị theo ngôn ngữ hiện tại của request (Accept-Language).
 * Dùng để thay thế chuỗi hardcode trong AuthService / AuthController.
 */
@Component
@RequiredArgsConstructor
public class MessageService {
    private final MessageSource messageSource;

    /** Lấy message theo locale của request hiện tại. */
    public String get(String key, Object... args) {
        return get(LocaleContextHolder.getLocale(), key, args);
    }

    /** Lấy message theo locale cụ thể (dùng cho email: luôn gửi tiếng Việt). */
    public String get(Locale locale, String key, Object... args) {
        return messageSource.getMessage(key, args, key, locale);
    }
}
