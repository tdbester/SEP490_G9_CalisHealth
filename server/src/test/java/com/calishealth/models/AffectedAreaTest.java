package com.calishealth.models;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AffectedAreaTest {

    /**
     * Spring Boot 4 dùng Jackson 3 (tools.jackson) làm mặc định cho HTTP converter,
     * nên enum phải bind được bằng đúng mapper mà runtime thực sự dùng.
     */
    private final JsonMapper objectMapper = JsonMapper.builder().build();

    @Test
    void acceptsAllCurrentAreaKeys() throws Exception {
        for (AffectedArea area : AffectedArea.values()) {
            assertEquals(area, objectMapper.readValue("\"" + area.name() + "\"", AffectedArea.class));
        }
    }

    @Test
    void acceptsLegacyAreaKeys() throws Exception {
        assertEquals(AffectedArea.MEMBER_APP_ACCESS,
                objectMapper.readValue("\"MEMBER_APP\"", AffectedArea.class));
        assertEquals(AffectedArea.MEMBER_VIDEO_UPLOADS,
                objectMapper.readValue("\"UPLOADS\"", AffectedArea.class));
    }

    @Test
    void acceptsWhitespaceAndCaseInsensitiveAreaKeys() throws Exception {
        assertEquals(AffectedArea.ADMIN_MANAGEMENT_PORTAL,
                objectMapper.readValue("\" admin_management_portal \"", AffectedArea.class));
        assertEquals(AffectedArea.AI_POSE_ASSESSMENT,
                objectMapper.readValue("\"ai_camera_training\"", AffectedArea.class));
    }

    @Test
    void rejectsUnknownAreaKeysDuringJsonBinding() {
        assertThrows(Exception.class,
                () -> objectMapper.readValue("\"UNKNOWN_AREA\"", AffectedArea.class));
    }
}
