package com.calishealth.service;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.text.Normalizer;
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
    private static final List<String> BLOCKED_TERMS = List.of(
            "ass", "arse", "fuck", "shit", "bitch", "asshole", "bastard", "motherfucker", "stupid",
            "địt", "đụ", "đéo", "lồn", "cặc", "đĩ", "đồ chó", "đồ khốn",
            "giết người", "giết chết", "đâm chết", "bắn chết", "tự sát",
            "kill yourself", "kill him", "kill her", "murder", "rape", "stab someone");
    private static final List<Pattern> BLOCKED_TERM_PATTERNS = BLOCKED_TERMS.stream()
            .map(ContentModerationService::wordPattern)
            .toList();
    private static final String INAPPROPRIATE_TEXT_MESSAGE =
            "Exercise content contains inappropriate language. Please revise it!";
    private static final List<String> ALLOWED_EXTENSIONS = List.of("mp4", "mov", "webm");

    private static Pattern wordPattern(String term) {
        String expression = term.chars().allMatch(character -> character < 128)
                ? "\\b" + Pattern.quote(term) + "\\b"
                : "(?<![\\p{L}\\p{N}])" + Pattern.quote(term) + "(?![\\p{L}\\p{N}])";
        return Pattern.compile(expression, Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
                | Pattern.UNICODE_CHARACTER_CLASS);
    }

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
        return checkText(title, description, guideSteps, null);
    }

    public String checkText(String title, String description, List<String> guideSteps, String targetMuscle) {
        List<String> text = new ArrayList<>();
        text.add(title);
        text.add(description);
        text.add(targetMuscle);
        if (guideSteps != null) {
            text.addAll(guideSteps);
        }
        for (String value : text) {
            if (value == null) continue;
            String normalized = Normalizer.normalize(value, Normalizer.Form.NFC).toLowerCase(Locale.ROOT);
            for (Pattern matcher : BLOCKED_TERM_PATTERNS) {
                if (matcher.matcher(normalized).find()) {
                    return INAPPROPRIATE_TEXT_MESSAGE;
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
