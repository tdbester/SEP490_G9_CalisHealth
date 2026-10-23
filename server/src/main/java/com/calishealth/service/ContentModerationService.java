package com.calishealth.service;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import java.util.stream.Stream;

@Service
public class ContentModerationService {
    private static final long MAX_VIDEO_SIZE = 50L * 1024 * 1024;
    private static final String VIDEO_REJECTION =
            "Video check: we could not detect a full body in most frames. Re-record in better light with your whole body in frame.";
    private static final List<String> BLOCKED_TERMS = List.of("stupid", "badword");
    private static final List<String> ALLOWED_EXTENSIONS = List.of("mp4", "mov", "webm");

    public ModerationResult moderate(String title, String description, List<String> guideSteps, MultipartFile video) {
        String textReason = checkText(title, description, guideSteps);
        String videoReason = checkVideo(video);
        return combine(textReason, videoReason);
    }

    public ModerationResult combine(String textReason, String videoReason) {
        String reason = Stream.of(textReason, videoReason)
                .filter(value -> value != null && !value.isBlank())
                .reduce((left, right) -> left + " " + right)
                .orElse(null);
        return new ModerationResult(reason == null, reason);
    }

    public String checkText(String title, String description, List<String> guideSteps) {
        List<String> text = new ArrayList<>();
        text.add(title);
        text.add(description);
        if (guideSteps != null) {
            text.addAll(guideSteps);
        }
        for (String value : text) {
            if (value == null) continue;
            String normalized = value.toLowerCase(Locale.ROOT);
            for (String blockedTerm : BLOCKED_TERMS) {
                if (normalized.matches("(?s).*\\b" + Pattern.quote(blockedTerm) + "\\b.*")) {
                    return "Text check: content contains inappropriate wording ('" + blockedTerm + "').";
                }
            }
        }
        return null;
    }

    public String checkVideo(MultipartFile video) {
        if (video == null || video.isEmpty() || video.getSize() > MAX_VIDEO_SIZE) {
            return VIDEO_REJECTION;
        }
        String name = video.getOriginalFilename();
        int dot = name == null ? -1 : name.lastIndexOf('.');
        String extension = dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            return VIDEO_REJECTION;
        }
        String contentType = video.getContentType();
        if (contentType != null && !contentType.isBlank()
                && !contentType.toLowerCase(Locale.ROOT).startsWith("video/")) {
            return VIDEO_REJECTION;
        }
        try (var input = video.getInputStream()) {
            byte[] header = input.readNBytes(12);
            boolean mp4Container = header.length >= 8
                    && header[4] == 'f' && header[5] == 't' && header[6] == 'y' && header[7] == 'p';
            boolean webmContainer = header.length >= 4
                    && (header[0] & 0xff) == 0x1a && (header[1] & 0xff) == 0x45
                    && (header[2] & 0xff) == 0xdf && (header[3] & 0xff) == 0xa3;
            if (!(mp4Container || webmContainer)) {
                return VIDEO_REJECTION;
            }
        } catch (IOException exception) {
            return VIDEO_REJECTION;
        }
        return null;
    }

    public record ModerationResult(boolean isPassed, String rejectionReason) {}
}
