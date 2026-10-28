package com.calishealth.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {
    private final JavaMailSender mailSender;
    @Value("${spring.mail.username}") private String from;

    public void send(String to, String subject, String body) {
        // Luôn in ra console để demo dự phòng khi mạng/SMTP lỗi
        log.info("\n===== EMAIL TO {} =====\n{}\n=======================", to, body);
        try {
            SimpleMailMessage m = new SimpleMailMessage();
            m.setFrom(from);
            m.setTo(to);
            m.setSubject(subject);
            m.setText(body);
            mailSender.send(m);
        } catch (Exception e) {
            log.warn("Failed to send mail (use the link in the console): {}", e.getMessage());
        }
    }
}
