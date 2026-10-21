package com.calishealth.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.support.ReloadableResourceBundleMessageSource;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

/**
 * Cấu hình i18n:
 * - Đọc message từ messages_vi.properties / messages_en.properties
 * - Chọn ngôn ngữ theo header Accept-Language mà frontend gửi kèm
 * - Mặc định: vi (tiếng Việt) nếu client không gửi header hoặc gửi ngôn ngữ lạ
 */
@Configuration
public class I18nConfig {

    /** UTF-8 là bắt buộc, nếu không tiếng Việt sẽ bị đọc sai (mojibake). */
    @Bean
    public ReloadableResourceBundleMessageSource messageSource() {
        ReloadableResourceBundleMessageSource source = new ReloadableResourceBundleMessageSource();
        source.setBasename("classpath:messages");
        source.setDefaultEncoding(StandardCharsets.UTF_8.name());
        source.setFallbackToSystemLocale(false);
        source.setCacheSeconds(-1); // tắt cache để sửa file là áp dụng ngay khi dev
        return source;
    }

    /**
     * Mặc định Hibernate Validator dùng ResourceBundle riêng, KHÔNG đọc MessageSource của Spring.
     * Đăng ký LocalValidatorFactoryBean + SpringMessageInterpolator để message trong
     * @NotBlank / @StrongPassword cũng lấy từ messages_*.properties.
     */
    @Bean
    public LocalValidatorFactoryBean defaultValidator() {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.setValidationMessageSource(messageSource());
        return validator;
    }

    /**
     * Ngôn ngữ lấy từ header "Accept-Language" mà frontend gửi kèm mỗi request
     * (xem client/src/api/client.js - interceptor gắn header này).
     *
     * KHÔNG dùng LocaleChangeInterceptor ở đây: interceptor đó chỉ hoạt động với
     * Session/Cookie LocaleResolver. Kết hợp với AcceptHeaderLocaleResolver sẽ ném
     * UnsupportedOperationException ("Cannot change HTTP Accept-Language header").
     */
    @Bean
    public LocaleResolver localeResolver() {
        AcceptHeaderLocaleResolver resolver = new AcceptHeaderLocaleResolver();
        resolver.setDefaultLocale(Locale.forLanguageTag("vi"));
        resolver.setSupportedLocales(List.of(Locale.forLanguageTag("vi"), Locale.forLanguageTag("en")));
        return resolver;
    }
}
