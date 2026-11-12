package com.calishealth.service;

import com.calishealth.models.MediaFile;
import com.calishealth.models.StorageSettings;
import com.calishealth.models.User;
import com.calishealth.repository.MediaFileRepository;
import com.calishealth.repository.StorageSettingsRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * The quota that decides whether an upload is allowed comes from the provider when there is one:
 * the Cloudinary plan gives the space, the admin setting is only the fallback for the local disk.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MediaRegistryQuotaTest {

    @Mock
    private MediaFileRepository media;
    @Mock
    private StorageSettingsRepository settingsRepository;
    @Mock
    private CloudinaryUsageService cloudinary;

    private MediaRegistryService registry;

    @BeforeEach
    void setUp() {
        registry = new MediaRegistryService(media, settingsRepository, null, null, cloudinary);
        StorageSettings settings = new StorageSettings();
        settings.setQuotaGb(5);
        settings.setMaxVideoMb(100);
        settings.setMaxImageMb(10);
        settings.setVideoFormats("MP4,MOV,WEBM");
        settings.setImageFormats("JPG,PNG,WEBP");
        settings.setMemberQuotaMb(300);
        settings.setUploadsPerDay(10);
        when(settingsRepository.findById(StorageSettings.ID)).thenReturn(java.util.Optional.of(settings));
    }

    private CloudinaryUsageService.Usage cloudUsage(long stored, long limit) {
        return new CloudinaryUsageService.Usage("Free", stored, limit, 0, 0, null, null, 0, java.time.LocalDateTime.now());
    }

    @Test
    void rejectsTheUploadWhenTheCloudinaryPlanIsFull() {
        when(cloudinary.usage()).thenReturn(java.util.Optional.of(cloudUsage(4_990_000_000L, 5_000_000_000L)));
        when(media.sumBytesOnDisk()).thenReturn(0L);

        assertThatThrownBy(() -> registry.checkUpload(MediaFile.DEMO_VIDEO, "mp4", 50_000_000L, null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(exception -> assertThat(((ResponseStatusException) exception).getStatusCode())
                        .isEqualTo(HttpStatus.INSUFFICIENT_STORAGE));
    }

    @Test
    void allowsTheUploadWhileThePlanHasRoom() {
        when(cloudinary.usage()).thenReturn(java.util.Optional.of(cloudUsage(1_000_000_000L, 5_000_000_000L)));
        when(media.sumBytesOnDisk()).thenReturn(0L);

        assertThat(registry.checkUpload(MediaFile.DEMO_VIDEO, "mp4", 50_000_000L, null)).isNull();
    }

    @Test
    void fallsBackToTheAdminQuotaWithoutACloudinaryAccount() {
        when(cloudinary.usage()).thenReturn(java.util.Optional.empty());
        when(media.sumBytesOnDisk()).thenReturn(5_360_000_000L);

        assertThatThrownBy(() -> registry.checkUpload(MediaFile.DEMO_VIDEO, "mp4", 50_000_000L, null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(exception -> assertThat(((ResponseStatusException) exception).getStatusCode())
                        .isEqualTo(HttpStatus.INSUFFICIENT_STORAGE));
    }
}
