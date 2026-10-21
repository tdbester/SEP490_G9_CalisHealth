package com.calishealth;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("validate")
class SchemaValidationTest {
    @Test
    void contextLoadsAndValidatesSchema() {
        // Khi ddl-auto=validate, Spring context sẽ FAIL TO START
        // nếu schema trong DB lệch với entity (@Column name, types, FK).
        // Việc context load thành công = schema match tất cả entity.
    }
}
