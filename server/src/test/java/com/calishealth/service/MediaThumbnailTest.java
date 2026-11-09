package com.calishealth.service;

import com.calishealth.models.MediaFile;
import com.calishealth.repository.MediaFileRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The picture of a media file, so the admin sees what a file is without opening it.
 *
 * <p>The picture is made by Cloudinary on the fly, so it costs no storage of the account.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MediaThumbnailTest {

    @Mock
    private MediaFileRepository media;
    @Mock
    private MediaRegistryService registry;
    @Mock
    private CloudinaryFolderService folders;
    @Mock
    private com.cloudinary.Cloudinary cloudinary;
    @Mock
    private UserRepository users;

    private ExerciseVideoStorageService storage;

    @BeforeEach
    void setUp() {
        storage = new ExerciseVideoStorageService("target/test-media", "target/test-anatomy", "u9vojlr2",
                registry, folders, new CloudinaryOptimizationService(true, 1600, 1280, "auto:good", "auto:good", "", ""),
                cloudinary);
    }

    @Test
    void makesThePictureOfAnImageOnTheFly() {
        Optional<String> thumbnail = storage.thumbnailUrl(
                "https://res.cloudinary.com/u9vojlr2/image/upload/v123/calishealth/exercise-anatomy/abc.png", false);

        assertThat(thumbnail).isPresent();
        assertThat(thumbnail.get())
                .isEqualTo("https://res.cloudinary.com/u9vojlr2/image/upload/c_limit,w_160,q_auto:low,f_auto"
                        + "/calishealth/exercise-anatomy/abc.png");
    }

    @Test
    void makesTheFirstFrameOfAVideo() {
        Optional<String> thumbnail = storage.thumbnailUrl(
                "https://res.cloudinary.com/u9vojlr2/video/upload/v123/calishealth/exercise-demos/abc.mp4", true);

        assertThat(thumbnail).isPresent();
        assertThat(thumbnail.get())
                .isEqualTo("https://res.cloudinary.com/u9vojlr2/video/upload/so_0,c_limit,w_160"
                        + "/calishealth/exercise-demos/abc.mp4");
    }

    @Test
    void hasNoPictureForAFileThatIsNotOnCloudinary() {
        assertThat(storage.thumbnailUrl("/media/exercise-demos/local.mp4", true)).isEmpty();
        assertThat(storage.thumbnailUrl("https://example.com/video.mp4", true)).isEmpty();
        assertThat(storage.thumbnailUrl(null, false)).isEmpty();
    }

    @Test
    void leavesTheQueryStringOutOfTheExtension() {
        Optional<String> thumbnail = storage.thumbnailUrl(
                "https://res.cloudinary.com/u9vojlr2/image/upload/v123/calishealth/exercise-anatomy/abc.png?x=1", false);

        assertThat(thumbnail).isPresent();
        assertThat(thumbnail.get()).endsWith("/calishealth/exercise-anatomy/abc.png");
    }
}
