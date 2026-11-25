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

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test cho {@link ProfileAvatarStorageService}: lưu ảnh đại diện, kiểm tra định dạng,
 * đo dung lượng và xoá ảnh cũ.
 */
class ProfileAvatarStorageServiceTest {

    private static final String CLOUD = "u9vojlr2";

    private Cloudinary cloudinary;
    private Uploader uploader;
    private Api api;
    private CloudinaryFolderService folders;
    private Path storageDir;
    private ProfileAvatarStorageService service;

    @BeforeEach
    void setUp() throws Exception {
        storageDir = Files.createTempDirectory("calis-avatars");
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

    // --------------------------------------------------------------------- store

    @Test
    @DisplayName("store: file rong -> 400")
    void storeRejectsEmptyFile() {
        assertThatThrownBy(() -> service.store(image("a.jpg", "image/jpeg", new byte[0])))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("store: dinh dang khong hop le -> 400")
    void storeRejectsUnsupportedFormat() {
        assertThatThrownBy(() -> service.store(image("a.gif", "image/gif", new byte[]{1})))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("store: khong co duoi tep nhung content type hop le -> dung content type")
    void storeDerivesExtensionFromContentType() {
        ProfileAvatarStorageService local = new ProfileAvatarStorageService(storageDir.toString(), "",
                folders, new CloudinaryOptimizationService(true, 1600, 1280, "auto:good", "auto:good", "", ""),
                cloudinary);

        String url = local.store(image("avatar", "image/png", new byte[]{1, 2, 3}));

        assertThat(url).startsWith(ProfileAvatarStorageService.URL_PREFIX);
        assertThat(url).endsWith(".png");
    }

    @Test
    @DisplayName("store: content type khong phai anh -> 400")
    void storeRejectsNonImageContentType() {
        assertThatThrownBy(() -> service.store(image("a.png", "text/plain", new byte[]{1})))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("store: upload len Cloudinary thanh cong")
    void storeUploadsToCloudinary() throws Exception {
        Map<String, Object> result = new HashMap<>();
        result.put("secure_url", "https://res.cloudinary.com/" + CLOUD + "/image/upload/v1/calishealth/profile-avatars/a.jpg");
        when(uploader.upload(any(byte[].class), any(Map.class))).thenReturn(result);

        String url = service.store(image("a.jpg", "image/jpeg", new byte[]{1, 2}));

        assertThat(url).contains("calishealth/profile-avatars");
    }

    @Test
    @DisplayName("store: Cloudinary loi -> 502")
    void storeReportsCloudinaryFailure() throws Exception {
        when(uploader.upload(any(byte[].class), any(Map.class))).thenThrow(new java.io.IOException("boom"));

        assertThatThrownBy(() -> service.store(image("a.jpg", "image/jpeg", new byte[]{1, 2})))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_GATEWAY));
    }

    @Test
    @DisplayName("store: Cloudinary khong tra ve URL -> 502")
    void storeReportsMissingUrl() throws Exception {
        when(uploader.upload(any(byte[].class), any(Map.class))).thenReturn(Map.of());

        assertThatThrownBy(() -> service.store(image("a.jpg", "image/jpeg", new byte[]{1, 2})))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_GATEWAY));
    }

    @Test
    @DisplayName("store: luu xuong dia khi khong co Cloudinary")
    void storeWritesToDiskWithoutCloudinary() {
        ProfileAvatarStorageService local = new ProfileAvatarStorageService(storageDir.toString(), "",
                folders, new CloudinaryOptimizationService(true, 1600, 1280, "auto:good", "auto:good", "", ""),
                cloudinary);

        String url = local.store(image("a.jpg", "image/jpeg", new byte[]{1, 2, 3}));

        assertThat(url).startsWith(ProfileAvatarStorageService.URL_PREFIX);
        assertThat(local.resolve(url)).isPresent();
    }

    // -------------------------------------------------------------------- resolve

    @Test
    @DisplayName("resolve: URL cua app -> tra ve duong dan")
    void resolveReturnsPath() {
        Optional<Path> path = service.resolve(ProfileAvatarStorageService.URL_PREFIX + "a.jpg");

        assertThat(path).isPresent();
        assertThat(path.get().getFileName().toString()).isEqualTo("a.jpg");
    }

    @Test
    @DisplayName("resolve: duong dan bay -> rong")
    void resolveRejectsPathTraversal() {
        assertThat(service.resolve(ProfileAvatarStorageService.URL_PREFIX + "../../secret.txt")).isEmpty();
    }

    @Test
    @DisplayName("resolve: URL khong thuoc app -> rong")
    void resolveIgnoresForeignUrl() {
        assertThat(service.resolve("https://example.com/a.jpg")).isEmpty();
        assertThat(service.resolve(null)).isEmpty();
    }

    // -------------------------------------------------------------------- sizeOf

    @Test
    @DisplayName("sizeOf: file tren dia -> dung so byte")
    void sizeOfReadsLocalFile() throws Exception {
        Path file = storageDir.resolve("a.jpg");
        Files.write(file, new byte[]{1, 2, 3, 4});

        assertThat(service.sizeOf(ProfileAvatarStorageService.URL_PREFIX + "a.jpg")).isEqualTo(4L);
    }

    @Test
    @DisplayName("sizeOf: file khong ton tai -> 0")
    void sizeOfMissingFileIsZero() {
        assertThat(service.sizeOf(ProfileAvatarStorageService.URL_PREFIX + "missing.jpg")).isZero();
    }

    @Test
    @DisplayName("sizeOf: anh tren Cloudinary -> doc kich thuoc tu API")
    void sizeOfReadsCloudinaryAsset() throws Exception {
        ApiResponse response = mock(ApiResponse.class);
        lenient().when(response.get("bytes")).thenReturn(4096);
        when(api.resource(anyString(), any(Map.class))).thenReturn(response);

        long size = service.sizeOf(
                "https://res.cloudinary.com/" + CLOUD + "/image/upload/v1/calishealth/profile-avatars/a.jpg");

        assertThat(size).isEqualTo(4096L);
    }

    @Test
    @DisplayName("sizeOf: Cloudinary bao loi -> 0")
    void sizeOfReturnsZeroOnCloudinaryFailure() throws Exception {
        when(api.resource(anyString(), any(Map.class))).thenThrow(new RuntimeException("boom"));

        assertThat(service.sizeOf(
                "https://res.cloudinary.com/" + CLOUD + "/image/upload/v1/calishealth/profile-avatars/a.jpg")).isZero();
    }

    @Test
    @DisplayName("sizeOf: URL khong phai Cloudinary -> 0")
    void sizeOfForeignUrlIsZero() {
        assertThat(service.sizeOf("https://example.com/a.jpg")).isZero();
        assertThat(service.sizeOf(null)).isZero();
    }

    // -------------------------------------------------------------------- delete

    @Test
    @DisplayName("delete: xoa file tren dia")
    void deleteRemovesLocalFile() throws Exception {
        Path file = storageDir.resolve("a.jpg");
        Files.write(file, new byte[]{1});

        service.delete(ProfileAvatarStorageService.URL_PREFIX + "a.jpg");

        assertThat(Files.exists(file)).isFalse();
    }

    @Test
    @DisplayName("delete: URL null -> bo qua")
    void deleteIgnoresNullUrl() throws Exception {
        service.delete(null);

        verify(uploader, never()).destroy(anyString(), any(Map.class));
    }

    @Test
    @DisplayName("delete: duong dan bay -> khong xoa")
    void deleteRejectsPathTraversal() {
        service.delete(ProfileAvatarStorageService.URL_PREFIX + "../../secret.txt");

        assertThat(Files.exists(storageDir.getParent().resolve("secret.txt"))).isFalse();
    }

    @Test
    @DisplayName("delete: anh tren Cloudinary -> goi destroy")
    void deleteRemovesCloudinaryAsset() throws Exception {
        service.delete("https://res.cloudinary.com/" + CLOUD + "/image/upload/v1/calishealth/profile-avatars/a.jpg");

        verify(uploader).destroy(anyString(), any(Map.class));
    }

    @Test
    @DisplayName("delete: Cloudinary bao loi -> khong nem loi")
    void deleteIgnoresCloudinaryFailure() throws Exception {
        when(uploader.destroy(anyString(), any(Map.class))).thenThrow(new RuntimeException("boom"));

        service.delete("https://res.cloudinary.com/" + CLOUD + "/image/upload/v1/calishealth/profile-avatars/a.jpg");
    }

    @Test
    @DisplayName("delete: URL la file local -> xoa file")
    void deleteRemovesFileOnDisk() throws Exception {
        Path file = storageDir.resolve("b.jpg");
        Files.write(file, new byte[]{1});

        service.delete(ProfileAvatarStorageService.URL_PREFIX + "b.jpg");

        assertThat(Files.exists(file)).isFalse();
    }

    @Test
    @DisplayName("getStorageDirectory: tra ve thu muc luu anh")
    void exposesStorageDirectory() {
        assertThat(service.getStorageDirectory()).isEqualTo(storageDir.toAbsolutePath().normalize());
    }
}
