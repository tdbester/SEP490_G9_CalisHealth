package com.calishealth.models;

import com.fasterxml.jackson.annotation.JsonCreator;

import java.util.Arrays;
import java.util.Locale;
import java.util.Map;

public enum AffectedArea {
    MEMBER_APP_ACCESS,
    MEMBER_VIDEO_UPLOADS,
    AI_POSE_ASSESSMENT,
    SYSTEM_STORAGE_CDN,
    ADMIN_MANAGEMENT_PORTAL;

    private static final Map<String, AffectedArea> LEGACY_KEYS = Map.of(
            "MEMBER_APP", MEMBER_APP_ACCESS,
            "MEMBER_APP_ACCESS", MEMBER_APP_ACCESS,
            "UPLOADS", MEMBER_VIDEO_UPLOADS,
            "MEMBER_VIDEO_UPLOADS", MEMBER_VIDEO_UPLOADS,
            "AI_CAMERA_TRAINING", AI_POSE_ASSESSMENT,
            "AI_POSE_ASSESSMENT", AI_POSE_ASSESSMENT,
            "SYSTEM_STORAGE_CDN", SYSTEM_STORAGE_CDN,
            "ADMIN_AREA", ADMIN_MANAGEMENT_PORTAL,
            "ADMIN_MANAGEMENT_PORTAL", ADMIN_MANAGEMENT_PORTAL
    );

    @JsonCreator
    public static AffectedArea fromJson(String value) {
        if (value == null || value.trim().isEmpty()) return null;

        String cleanValue = value.trim().toUpperCase(Locale.ROOT);
        return Arrays.stream(values())
                .filter(area -> area.name().equals(cleanValue))
                .findFirst()
                .orElseGet(() -> {
                    AffectedArea legacyArea = LEGACY_KEYS.get(cleanValue);
                    if (legacyArea == null) {
                        throw new IllegalArgumentException("Unsupported affected area: " + value);
                    }
                    return legacyArea;
                });
    }
}
