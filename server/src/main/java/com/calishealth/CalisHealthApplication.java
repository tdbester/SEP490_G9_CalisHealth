package com.calishealth;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.mail.autoconfigure.MailHealthContributorAutoConfiguration;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(
        exclude = {
                UserDetailsServiceAutoConfiguration.class,
                // Thay bằng com.calishealth.config.MailHealthIndicator: bản mặc định đánh
                // dấu DOWN khi chưa cấu hình SMTP, khiến /actuator/health trả 503 dù
                // app chạy bình thường (chức năng gửi mail có fallback sang console log).
                MailHealthContributorAutoConfiguration.class
        })
@EnableScheduling
public class CalisHealthApplication {

    public static void main(String[] args) {
        SpringApplication.run(CalisHealthApplication.class, args);
    }

}
