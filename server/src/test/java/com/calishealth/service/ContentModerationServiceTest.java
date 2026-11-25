package com.calishealth.service;

import com.calishealth.models.ProfanityWord;
import com.calishealth.repository.ProfanityWordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bộ test cho {@link ContentModerationService}: duyet text, duyet video va ghep ly do.
 */
class ContentModerationServiceTest {

    private ProfanityWordRepository profanityWords;
    private ContentModerationService service;

    @BeforeEach
    void setUp() {
        profanityWords = mock(ProfanityWordRepository.class);
        service = new ContentModerationService(profanityWords);
        when(profanityWords.findByActiveTrueOrderByIdAsc()).thenReturn(List.of());
    }

    private static ProfanityWord word(String text) {
        ProfanityWord word = new ProfanityWord();
        word.setId(1L);
        word.setWord(text);
        word.setLanguage("EN");
        word.setSeverity("HIGH");
        word.setActive(true);
        return word;
    }

    private static byte[] mp4Header() {
        byte[] header = new byte[12];
        header[4] = 'f';
        header[5] = 't';
        header[6] = 'y';
        header[7] = 'p';
        return header;
    }

    private static byte[] webmHeader() {
        return new byte[]{(byte) 0x1a, (byte) 0x45, (byte) 0xdf, (byte) 0xa3, 0, 0, 0, 0, 0, 0, 0, 0};
    }

    @Test
    @DisplayName("checkText: khong co tu cam -> null")
    void checkTextAcceptsCleanContent() {
        assertThat(service.checkText("Push-up", "A classic move", List.of("Lie down"))).isNull();
    }

    @Test
    @DisplayName("checkText: co tu cam -> tra ve ly do")
    void checkTextFlagsProfanity() {
        when(profanityWords.findByActiveTrueOrderByIdAsc()).thenReturn(List.of(word("badword")));

        String reason = service.checkText("Badword title", "desc", List.of());

        assertThat(reason).contains("Flagged words").contains("badword");
    }

    @Test
    @DisplayName("checkText: tu cam co dau -> van bi chan")
    void checkTextHandlesUnicode() {
        when(profanityWords.findByActiveTrueOrderByIdAsc()).thenReturn(List.of(word("đm")));

        assertThat(service.checkText("đm title", null, null)).contains("Flagged words");
    }

    @Test
    @DisplayName("checkText: co targetMuscle -> cung duoc kiem tra")
    void checkTextChecksTargetMuscle() {
        when(profanityWords.findByActiveTrueOrderByIdAsc()).thenReturn(List.of(word("badword")));

        assertThat(service.checkText("Title", "desc", List.of(), "badword")).contains("Flagged words");
    }

    @Test
    @DisplayName("findFlaggedWords: toan bo text rong -> danh sach rong")
    void findFlaggedWordsHandlesBlankText() {
        assertThat(service.findFlaggedWords(null, null, null, null)).isEmpty();
    }

    @Test
    @DisplayName("findFlaggedWords: tu cam rong trong danh sach -> bo qua")
    void findFlaggedWordsSkipsBlankEntries() {
        when(profanityWords.findByActiveTrueOrderByIdAsc()).thenReturn(List.of(word("   "), word("bad")));

        assertThat(service.findFlaggedWords("bad title", null, null, null)).containsExactly("bad");
    }

    @Test
    @DisplayName("findFlaggedWords: tu cam trung nhau chi ghi 1 lan")
    void findFlaggedWordsDeduplicates() {
        when(profanityWords.findByActiveTrueOrderByIdAsc()).thenReturn(List.of(word("bad"), word("BAD")));

        assertThat(service.findFlaggedWords("bad", null, null, null)).hasSize(1);
    }

    @Test
    @DisplayName("checkVideo: video null -> tu choi")
    void checkVideoRejectsNull() {
        assertThat(service.checkVideo(null)).contains("Video check");
    }

    @Test
    @DisplayName("checkVideo: video rong -> tu choi")
    void checkVideoRejectsEmpty() {
        MultipartFile video = new MockMultipartFile("v", "a.mp4", "video/mp4", new byte[0]);

        assertThat(service.checkVideo(video)).contains("Video check");
    }

    @Test
    @DisplayName("checkVideo: dinh dang khong cho phep -> tu choi")
    void checkVideoRejectsWrongExtension() {
        MultipartFile video = new MockMultipartFile("v", "a.txt", "video/mp4", mp4Header());

        assertThat(service.checkVideo(video)).contains("Video check");
    }

    @Test
    @DisplayName("checkVideo: content type khong phai video -> tu choi")
    void checkVideoRejectsWrongContentType() {
        MultipartFile video = new MockMultipartFile("v", "a.mp4", "application/pdf", mp4Header());

        assertThat(service.checkVideo(video)).contains("Video check");
    }

    @Test
    @DisplayName("checkVideo: container khong hop le -> tu choi")
    void checkVideoRejectsBadContainer() {
        MultipartFile video = new MockMultipartFile("v", "a.mp4", "video/mp4", "notavideo".getBytes());

        assertThat(service.checkVideo(video)).contains("Video check");
    }

    @Test
    @DisplayName("checkVideo: container mp4 -> chap nhan")
    void checkVideoAcceptsMp4() {
        MultipartFile video = new MockMultipartFile("v", "a.mp4", "video/mp4", mp4Header());

        assertThat(service.checkVideo(video)).isNull();
    }

    @Test
    @DisplayName("checkVideo: container webm -> chap nhan")
    void checkVideoAcceptsWebm() {
        MultipartFile video = new MockMultipartFile("v", "a.webm", "video/webm", webmHeader());

        assertThat(service.checkVideo(video)).isNull();
    }

    @Test
    @DisplayName("checkVideo: khong co content type -> chap nhan theo container")
    void checkVideoAcceptsNullContentType() {
        MultipartFile video = new MockMultipartFile("v", "a.mp4", null, mp4Header());

        assertThat(service.checkVideo(video)).isNull();
    }

    @Test
    @DisplayName("moderate: hop le -> passed")
    void moderateAcceptsCleanContent() {
        MultipartFile video = new MockMultipartFile("v", "a.mp4", "video/mp4", mp4Header());

        var result = service.moderate("Push-up", "desc", List.of(), video);

        assertThat(result.isPassed()).isTrue();
        assertThat(result.rejectionReason()).isNull();
    }

    @Test
    @DisplayName("moderate: co text xau -> khong passed")
    void moderateRejectsBadText() {
        when(profanityWords.findByActiveTrueOrderByIdAsc()).thenReturn(List.of(word("bad")));

        var result = service.moderate("bad", "desc", List.of(), null);

        assertThat(result.isPassed()).isFalse();
        assertThat(result.rejectionReason()).contains("Flagged words");
    }

    @Test
    @DisplayName("combine: ghep ca hai ly do")
    void combineJoinsReasons() {
        var result = service.combine("text reason", "video reason");

        assertThat(result.isPassed()).isFalse();
        assertThat(result.rejectionReason()).contains("text reason").contains("video reason");
    }

    @Test
    @DisplayName("combine: khong co ly do -> passed")
    void combineReturnsPassedWhenEmpty() {
        var result = service.combine(null, "   ");

        assertThat(result.isPassed()).isTrue();
        assertThat(result.rejectionReason()).isNull();
    }
}
