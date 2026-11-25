package com.calishealth.service;

import com.cloudinary.Api;
import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import com.cloudinary.api.ApiResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bo sung coverage cho {@link ProfileAvatarStorageService}: anh qua 5 MB, loi ghi dia,
 * public id khong hop le va loi xoa file.
 */
class ProfileAvatarStorageServiceExtraCoverageTest {

    private static final String CLOUD = "u9vojlr2";

    private Cloudinary cloudinary;
    private Uploader uploader;
    private Api api;
    private CloudinaryFolderService folders;
    private Path storageDir;
    private ProfileAvatarStorageService service;

    @BeforeEach
    void setUp() throws Exception {
        storageDir = Files.createTempDirectory("calis-avatars-extra");
        cloudinary = mock(Cloudinary.class);
        uploader = mock(Uploader.class);
        api = mock(Api.class);
        lenient().when(cloudinary.uploader()).thenReturn(uploader);
        lenient().when(cloudinary.api()).thenReturn(api);
        folders = new CloudinaryFolderService("calishealth");
        service = new ProfileAvatarStorageService(storageDir.toString(), CLOUD, folders,
                new CloudinaryOptimizationService(true, 1600, 1280, "auto:good", "auto:good", "", ""),
                cloudinary);
    }

    private static MultipartFile image(String name, String type, byte[] content) {
        return new MockMultipartFile("file", name, type, content);
    }

    @Test
    @DisplayName("store: anh qua 5 MB -> 400")
    void storeRejectsOversizedPhoto() {
        byte[] tooBig = new byte[6 * 1024 * 1024];

        assertThatThrownBy(() -> service.store(image("a.jpg", "image/jpeg", tooBig)))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST))
                .hasMessageContaining("5 MB");
    }

    @Test
    @DisplayName("store: ghi dia that bai -> 500")
    void storeReportsDiskWriteFailure() throws Exception {
        ProfileAvatarStorageService local = new ProfileAvatarStorageService(storageDir.toString(), "",
                folders, new CloudinaryOptimizationService(true, 1600, 1280, "auto:good", "auto:good", "", ""),
                cloudinary);
        MultipartFile broken = mock(MultipartFile.class);
        when(broken.isEmpty()).thenReturn(false);
        when(broken.getOriginalFilename()).thenReturn("a.jpg");
        when(broken.getContentType()).thenReturn("image/jpeg");
        when(broken.getSize()).thenReturn(10L);
        when(broken.getInputStream()).thenThrow(new IOException("disk full"));

        assertThatThrownBy(() -> local.store(broken))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR));
    }

    @Test
    @DisplayName("sizeOf: public id khong doc duoc -> 0")
    void sizeOfUnknownPublicIdIsZero() throws Exception {
        assertThat(service.sizeOf("https://res.cloudinary.com/" + CLOUD + "/image/fetch/v1/a.jpg")).isZero();
    }

    @Test
    @DisplayName("sizeOf: Cloudinary tra bytes khong phai so -> 0")
    void sizeOfNonNumericBytesIsZero() throws Exception {
        ApiResponse response = mock(ApiResponse.class);
        lenient().when(response.get("bytes")).thenReturn("not-a-number");
        when(api.resource(anyString(), any(Map.class))).thenReturn(response);

        assertThat(service.sizeOf(
                "https://res.cloudinary.com/" + CLOUD + "/image/upload/v1/calishealth/profile-avatars/a.jpg"))
                .isZero();
    }

    @Test
    @DisplayName("delete: xoa file that bai -> khong nem loi")
    void deleteToleratesIoFailure() throws Exception {
        Path file = storageDir.resolve("a.jpg");
        Files.write(file, new byte[]{1});

        // Khoa file tren Windows de Files.deleteIfExists that bai.
        try (java.nio.channels.FileChannel lock = java.nio.channels.FileChannel.open(file,
                java.nio.file.StandardOpenOption.READ, java.nio.file.StandardOpenOption.WRITE)) {
            service.delete(ProfileAvatarStorageService.URL_PREFIX + "a.jpg");
        }
    }

    @Test
    @DisplayName("resolve: duong dan chua chuan hoa -> rong")
    void resolveRejectsEscapingPath() {
        Optional<Path> path = service.resolve(ProfileAvatarStorageService.URL_PREFIX + "../../etc/passwd");

        assertThat(path).isEmpty();
    }
}
