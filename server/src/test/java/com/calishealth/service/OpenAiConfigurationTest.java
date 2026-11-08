package com.calishealth.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Kiểm tra backend nạp được cấu hình OpenAI từ file .env.
 *
 * File .env thật đặt cạnh pom.xml (thư mục gốc repo) hoặc cạnh client/.env —
 * nhờ vậy chỉ cần điền OPENAI_API_KEY vào .env là AI Support dùng được
 * API thật mà không cần set biến môi trường thủ công.
 *
 * Test này dùng file .env mẫu trong test/resources để chạy độc lập với
 * máy dev (không phụ thuộc .env thật có sẵn hay không).
 */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.config.import=optional:file:src/test/resources/env-fixture/openai.env[.properties]"
})
class OpenAiConfigurationTest {

    @Autowired
    private OpenAiChatService openAi;

    @Test
    void loadsApiKeyAndModelFromEnvFile() {
        assertTrue(openAi.isConfigured(), "OPENAI_API_KEY should be loaded from the .env file");
        assertEquals("gpt-4o-mini", openAi.model());
    }
}
