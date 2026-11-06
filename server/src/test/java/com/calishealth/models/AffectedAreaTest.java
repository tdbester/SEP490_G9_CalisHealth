package com.calishealth.models;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AffectedAreaTest {
    private final ObjectMapper objectMapper = new ObjectMapper();

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
