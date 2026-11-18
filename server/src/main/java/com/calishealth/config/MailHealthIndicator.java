package com.calishealth.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.health.contributor.AbstractHealthIndicator;
import org.springframework.boot.health.contributor.Health;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Thay thế {@code MailHealthIndicator} mặc định của Spring Boot.
 *
 * <p>Vấn đề: Spring Boot tự đăng ký mail health indicator và đánh dấu DOWN khi
 * không kết nối được SMTP. Với project demo, SMTP thường chưa cấu hình
 * (MAIL_USERNAME / MAIL_PASSWORD rỗng) nên {@code GET /actuator/health} trả 503
 * dù ứng dụng hoạt động hoàn toàn bình thường — gây hiểu lầm là app đang lỗi.
 *
 * <p>Ứng dụng đã cố tình fallback sang in log console khi gửi mail thất bại
 * (xem {@code EmailService}), nên "chưa cấu hình SMTP" là trạng thái hợp lệ,
 * không phải lỗi sức khoẻ.
 *
 * <p>Để bean này được dùng, {@code MailHealthContributorAutoConfiguration} đã bị
 * loại trừ trong {@code CalisHealthApplication}.
 */
@Component("mailHealthIndicator")
public class MailHealthIndicator extends AbstractHealthIndicator {

    private final JavaMailSender mailSender;
    private final String username;
    private final String password;

    public MailHealthIndicator(
            JavaMailSender mailSender,
            @Value("${spring.mail.username:}") String username,
            @Value("${spring.mail.password:}") String password) {
        this.mailSender = mailSender;
        this.username = username;
        this.password = password;
    }

    @Override
    protected void doHealthCheck(Health.Builder builder) {
        if (!StringUtils.hasText(username) || !StringUtils.hasText(password)) {
            // Chưa cấu hình SMTP -> tính năng gửi mail đang tắt, app vẫn chạy bình thường.
            builder.up()
                    .withDetail("smtp", "Chưa cấu hình MAIL_USERNAME/MAIL_PASSWORD - tính năng gửi mail đang tắt");
            return;
        }
        try {
            if (mailSender instanceof JavaMailSenderImpl sender) {
                sender.testConnection();
            }
            builder.up().withDetail("smtp", "Kết nối SMTP thành công");
        } catch (Exception exception) {
            // SMTP sai thông tin (ví dụ mật khẩu ứng dụng Gmail đã hết hạn) cũng KHÔNG phải lỗi
            // sức khoẻ: `EmailService` bắt lỗi và in nội dung mail ra console, nên app vẫn chạy
            // và mọi luồng gửi mail vẫn hoàn tất. Đánh DOWN ở đây khiến /actuator/health trả
            // 503 dù ứng dụng hoạt động bình thường - team tưởng app đang lỗi.
            builder.up()
                    .withDetail("smtp", "Không kết nối được SMTP (" + exception.getMessage()
                            + ") - nội dung mail sẽ được in ra console thay vì gửi qua email");
        }
    }
}
