package com.calishealth.service;

import com.calishealth.models.MediaFile;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.MediaFileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * A profile photo is written to the registry too, so it counts toward the storage of the system and
 * an admin sees it in the Storage screen.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MediaRegistryAvatarTest {

    @Mock
    private MediaFileRepository media;

    private MediaRegistryService registry;

    @BeforeEach
    void setUp() {
        registry = new MediaRegistryService(media, null, null, null, null);
    }

    @Test
    void registersANewPhotoInTheRegistry() {
        when(media.findFirstByFileUrlAndStatusNotOrderByIdDesc("/media/profile-avatars/a.jpg", MediaFile.PURGED))
                .thenReturn(Optional.empty());
        User owner = new User();
        owner.setRole(UserRole.MEMBER);

        registry.registerAvatar("/media/profile-avatars/a.jpg", "me.jpg", 2048, owner);

        ArgumentCaptor<MediaFile> captor = ArgumentCaptor.forClass(MediaFile.class);
        verify(media).save(captor.capture());
        MediaFile file = captor.getValue();
        assertThat(file.getCategory()).isEqualTo(MediaFile.PROFILE_AVATAR);
        assertThat(file.getFileType()).isEqualTo(MediaFile.TYPE_IMAGE);
        assertThat(file.getSource()).isEqualTo(MediaFile.SOURCE_MEMBER);
        assertThat(file.getSizeBytes()).isEqualTo(2048);
        assertThat(file.getStatus()).isEqualTo(MediaFile.ACTIVE);
    }

    @Test
    void marksARemovedPhotoAsPurged() {
        MediaFile file = new MediaFile();
        file.setFileUrl("/media/profile-avatars/a.jpg");
        file.setStatus(MediaFile.ACTIVE);
        when(media.findFirstByFileUrlAndStatusNotOrderByIdDesc("/media/profile-avatars/a.jpg", MediaFile.PURGED))
                .thenReturn(Optional.of(file));

        registry.purgeAvatar("/media/profile-avatars/a.jpg");

        assertThat(file.getStatus()).isEqualTo(MediaFile.PURGED);
        assertThat(file.getPurgedAt()).isNotNull();
    }
}
