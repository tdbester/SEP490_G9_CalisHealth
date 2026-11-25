package com.calishealth.service;

import com.calishealth.models.MediaFile;
import com.calishealth.models.StorageSettings;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
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

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho {@link ExerciseVideoStorageService}: lỗi I/O, thumbnail, category
 * của file Cloudinary và các nhánh chưa được chạm tới.
 */
class ExerciseVideoStorageServiceExtraCoverageTest {

    private static final String CLOUD = "u9vojlr2";

    private MediaRegistryService registry;
    private CloudinaryFolderService folders;
    private Cloudinary cloudinary;
    private Uploader uploader;
    private Api api;
    private ExerciseVideoStorageService service;
    private Path videoDir;
    private Path anatomyDir;

    @BeforeEach
    void setUp() throws Exception {
        videoDir = Files.createTempDirectory("calis-videos-extra");
        anatomyDir = Files.createTempDirectory("calis-anatomy-extra");
        registry = mock(MediaRegistryService.class);
        folders = new CloudinaryFolderService("calishealth");
        cloudinary = mock(Cloudinary.class);
        uploader = mock(Uploader.class);
        api = mock(Api.class);
        lenient().when(cloudinary.uploader()).thenReturn(uploader);
        lenient().when(cloudinary.api()).thenReturn(api);
        service = new ExerciseVideoStorageService(
                videoDir.toString(), anatomyDir.toString(), CLOUD, registry, folders,
                new CloudinaryOptimizationService(true, 1600, 1280, "auto:good", "auto:good", "", ""),
                cloudinary);
    }

    private StorageSettings settings(int maxVideoMb, int maxSeconds) {
        StorageSettings s = new StorageSettings();
        s.setMaxVideoMb(maxVideoMb);
        s.setMaxImageMb(maxVideoMb);
        s.setDemoMaxSeconds(maxSeconds);
        s.setVideoFormats("MP4,MOV,WEBM");
        s.setImageFormats("JPG,PNG,WEBP");
        return s;
    }

    private static MultipartFile video(String name, String type) {
        return new MockMultipartFile("file", name, type, new byte[]{1, 2, 3, 4});
    }

    @Test
    @DisplayName("constructor: cloud name null -> rong, khong bat Cloudinary")
    void constructorHandlesNullCloudName() {
        ExerciseVideoStorageService local = new ExerciseVideoStorageService(
                videoDir.toString(), anatomyDir.toString(), null, registry, folders,
                new CloudinaryOptimizationService(true, 1600, 1280, "auto:good", "auto:good", "", ""),
                cloudinary);

        assertThat(local.listCloudinaryFiles()).isEmpty();
    }

    @Test
    @DisplayName("store: doc file that -> 500")
    void storeFailsWhenFileCannotBeRead() throws Exception {
        MultipartFile broken = mock(MultipartFile.class);
        when(broken.isEmpty()).thenReturn(false);
        when(broken.getOriginalFilename()).thenReturn("demo.mp4");
        when(broken.getContentType()).thenReturn("video/mp4");
        when(broken.getSize()).thenReturn(10L);
        when(broken.getInputStream()).thenThrow(new java.io.IOException("boom"));

        assertThatThrownBy(() -> service.store(broken, "cm@calishealth.vn"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR));
    }

    @Test
    @DisplayName("store: Cloudinary tra ve bytes null -> dung kich thuoc file goc")
    void storeUsesOriginalSizeWhenCloudinaryReportsNoBytes() throws Exception {
        User member = new User();
        member.setRole(UserRole.MEMBER);
        when(registry.checkUpload(anyString(), anyString(), anyLong(), anyString())).thenReturn(member);
        when(registry.findSameContent(anyString(), eq(MediaFile.DEMO_VIDEO))).thenReturn(Optional.empty());
        when(registry.settings()).thenReturn(settings(50, 60));
        Map<String, Object> result = new HashMap<>();
        result.put("secure_url", "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/exercise-demos/abc.mp4");
        when(uploader.uploadLarge(any(java.io.File.class), any(Map.class))).thenReturn(result);

        service.store(video("demo.mp4", "video/mp4"), "member@calishealth.vn");

        verify(registry).register(anyString(), eq("demo.mp4"), eq(4L), eq(MediaFile.DEMO_VIDEO),
                eq("mp4"), anyString(), eq(member), any(), eq(null));
    }

    @Test
    @DisplayName("store: Cloudinary tra ve format null -> dung dinh dang goc")
    void storeUsesOriginalFormatWhenCloudinaryReportsNoFormat() throws Exception {
        when(registry.checkUpload(anyString(), anyString(), anyLong(), anyString())).thenReturn(null);
        when(registry.findSameContent(anyString(), eq(MediaFile.DEMO_VIDEO))).thenReturn(Optional.empty());
        when(registry.settings()).thenReturn(settings(50, 60));
        Map<String, Object> result = new HashMap<>();
        result.put("secure_url", "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/exercise-demos/abc.mp4");
        when(uploader.uploadLarge(any(java.io.File.class), any(Map.class))).thenReturn(result);

        service.store(video("demo.mp4", "video/mp4"), "cm@calishealth.vn");

        verify(registry).register(anyString(), eq("demo.mp4"), anyLong(), eq(MediaFile.DEMO_VIDEO),
                eq("mp4"), anyString(), any(), any(), eq(null));
    }

    @Test
    @DisplayName("store: Cloudinary loi runtime -> 502")
    void storeReportsCloudinaryRuntimeFailure() throws Exception {
        when(registry.checkUpload(anyString(), anyString(), anyLong(), anyString())).thenReturn(null);
        when(registry.findSameContent(anyString(), eq(MediaFile.DEMO_VIDEO))).thenReturn(Optional.empty());
        when(uploader.uploadLarge(any(java.io.File.class), any(Map.class)))
                .thenThrow(new RuntimeException("boom"));

        assertThatThrownBy(() -> service.store(video("demo.mp4", "video/mp4"), "cm@calishealth.vn"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_GATEWAY));
    }

    @Test
    @DisplayName("store: dang ky that bai -> xoa file da upload")
    void storeDeletesUploadWhenRegistrationFails() throws Exception {
        when(registry.checkUpload(anyString(), anyString(), anyLong(), anyString())).thenReturn(null);
        when(registry.findSameContent(anyString(), eq(MediaFile.DEMO_VIDEO))).thenReturn(Optional.empty());
        when(registry.settings()).thenReturn(settings(50, 60));
        Map<String, Object> result = new HashMap<>();
        result.put("secure_url", "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/exercise-demos/abc.mp4");
        when(uploader.uploadLarge(any(java.io.File.class), any(Map.class))).thenReturn(result);
        when(registry.register(anyString(), anyString(), anyLong(), anyString(), anyString(), anyString(),
                any(), any(), any())).thenThrow(new RuntimeException("db down"));
        when(uploader.destroy(anyString(), any(Map.class))).thenReturn(Map.of("result", "ok"));

        assertThatThrownBy(() -> service.store(video("demo.mp4", "video/mp4"), "cm@calishealth.vn"))
                .isInstanceOf(RuntimeException.class);
        verify(uploader).destroy(anyString(), any(Map.class));
    }

    @Test
    @DisplayName("store: Cloudinary khong tra ve URL -> 502")
    void storeRejectsUploadWithoutUrl() throws Exception {
        when(registry.checkUpload(anyString(), anyString(), anyLong(), anyString())).thenReturn(null);
        when(registry.findSameContent(anyString(), eq(MediaFile.DEMO_VIDEO))).thenReturn(Optional.empty());
        when(uploader.uploadLarge(any(java.io.File.class), any(Map.class))).thenReturn(new HashMap<>());

        assertThatThrownBy(() -> service.store(video("demo.mp4", "video/mp4"), "cm@calishealth.vn"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_GATEWAY));
    }

    @Test
    @DisplayName("store: luu dia local that bai -> 500")
    void storeReportsLocalWriteFailure() throws Exception {
        ExerciseVideoStorageService local = new ExerciseVideoStorageService(
                videoDir.toString(), anatomyDir.toString(), "", registry, folders,
                new CloudinaryOptimizationService(true, 1600, 1280, "auto:good", "auto:good", "", ""),
                cloudinary);
        when(registry.checkUpload(anyString(), anyString(), anyLong(), anyString())).thenReturn(null);
        when(registry.findSameContent(anyString(), eq(MediaFile.DEMO_VIDEO))).thenReturn(Optional.empty());
        when(registry.register(anyString(), anyString(), anyLong(), anyString(), anyString(), anyString(),
                any(), any())).thenThrow(new RuntimeException("db down"));

        assertThatThrownBy(() -> local.store(video("demo.mp4", "video/mp4"), "cm@calishealth.vn"))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    @DisplayName("thumbnailUrl: file tren Cloudinary -> tra ve URL anh nho")
    void thumbnailUrlBuildsPreview() {
        Optional<String> thumbnail = service.thumbnailUrl(
                "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/exercise-demos/a.mp4", true);

        assertThat(thumbnail).isPresent();
        assertThat(thumbnail.get()).contains("so_0,c_limit,w_160");
    }

    @Test
    @DisplayName("thumbnailUrl: hinh anh -> dung quy tac anh")
    void thumbnailUrlForImage() {
        Optional<String> thumbnail = service.thumbnailUrl(
                "https://res.cloudinary.com/" + CLOUD + "/image/upload/v1/calishealth/exercise-anatomy/a.png", false);

        assertThat(thumbnail).isPresent();
        assertThat(thumbnail.get()).contains("c_limit,w_160,q_auto:low,f_auto");
    }

    @Test
    @DisplayName("thumbnailUrl: URL ngoai -> rong")
    void thumbnailUrlIgnoresForeignUrl() {
        assertThat(service.thumbnailUrl("https://example.com/a.mp4", true)).isEmpty();
        assertThat(service.thumbnailUrl(null, true)).isEmpty();
    }

    @Test
    @DisplayName("thumbnailUrl: URL co query string -> bo qua query")
    void thumbnailUrlStripsQueryString() {
        Optional<String> thumbnail = service.thumbnailUrl(
                "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/exercise-demos/a.mp4?x=1", true);

        assertThat(thumbnail).isPresent();
        assertThat(thumbnail.get()).doesNotContain("?");
    }

    @Test
    @DisplayName("cloudinaryKey: URL khong dung cloud -> rong")
    void cloudinaryKeyIgnoresOtherCloud() {
        assertThat(service.cloudinaryKey("https://res.cloudinary.com/other-cloud/video/upload/v1/a.mp4")).isEmpty();
    }

    @Test
    @DisplayName("cloudinaryKey: URL khong phai resource type upload -> rong")
    void cloudinaryKeyIgnoresNonUploadPath() {
        assertThat(service.cloudinaryKey(
                "https://res.cloudinary.com/" + CLOUD + "/video/fetch/v1/a.mp4")).isEmpty();
    }

    @Test
    @DisplayName("cloudinaryKey: public id rong -> rong")
    void cloudinaryKeyIgnoresEmptyPublicId() {
        assertThat(service.cloudinaryKey(
                "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/.mp4")).isEmpty();
    }

    @Test
    @DisplayName("deleteFile: file local da xoa -> true")
    void deleteFileToleratesMissingLocalFile() {
        assertThat(service.deleteFile(ExerciseVideoStorageService.VIDEO_PREFIX + "nope.mp4")).isTrue();
    }

    @Test
    @DisplayName("deleteFile: Cloudinary tra 'not found' -> true")
    void deleteFileAcceptsNotFoundResult() throws Exception {
        when(uploader.destroy(anyString(), any(Map.class))).thenReturn(Map.of("result", "not found"));

        assertThat(service.deleteFile(
                "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/exercise-demos/a.mp4")).isTrue();
    }

    @Test
    @DisplayName("deleteFile: Cloudinary tra ket qua khac -> false")
    void deleteFileRejectsUnexpectedResult() throws Exception {
        when(uploader.destroy(anyString(), any(Map.class))).thenReturn(Map.of("result", "failed"));

        assertThat(service.deleteFile(
                "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/exercise-demos/a.mp4")).isFalse();
    }

    @Test
    @DisplayName("listCloudinaryFiles: co trang thai thu muc -> dung category")
    void listCloudinaryFilesReadsFolderCategory() throws Exception {
        Map<String, Object> resource = new HashMap<>();
        resource.put("public_id", "calishealth/exercise-anatomy/a.png");
        resource.put("secure_url", "https://res.cloudinary.com/" + CLOUD + "/image/upload/v1/calishealth/exercise-anatomy/a.png");
        resource.put("created_at", "not-a-date");
        ApiResponse apiResponse = mock(ApiResponse.class);
        lenient().when(apiResponse.get("resources")).thenReturn(List.of(resource));
        lenient().when(apiResponse.get("next_cursor")).thenReturn(null);
        when(api.resources(any(Map.class))).thenReturn(apiResponse);

        Optional<Map<String, ExerciseVideoStorageService.CloudFile>> files = service.listCloudinaryFiles();

        assertThat(files).isPresent();
        assertThat(files.get().get("image/calishealth/exercise-anatomy/a.png").category())
                .isEqualTo(MediaFile.ANATOMY_IMAGE);
    }

    @Test
    @DisplayName("listCloudinaryFiles: file trong thung rac -> van giu category goc")
    void listCloudinaryFilesKeepsCategoryInTrash() throws Exception {
        Map<String, Object> resource = new HashMap<>();
        resource.put("public_id", "calishealth/trash/profile-avatars/a.png");
        resource.put("secure_url", "https://res.cloudinary.com/" + CLOUD + "/image/upload/v1/calishealth/trash/profile-avatars/a.png");
        resource.put("created_at", "2026-01-02T03:04:05Z");
        ApiResponse apiResponse = mock(ApiResponse.class);
        lenient().when(apiResponse.get("resources")).thenReturn(List.of(resource));
        lenient().when(apiResponse.get("next_cursor")).thenReturn(null);
        when(api.resources(any(Map.class))).thenReturn(apiResponse);

        Optional<Map<String, ExerciseVideoStorageService.CloudFile>> files = service.listCloudinaryFiles();

        assertThat(files).isPresent();
        assertThat(files.get().get("image/calishealth/trash/profile-avatars/a.png").category())
                .isEqualTo(MediaFile.PROFILE_AVATAR);
    }

    @Test
    @DisplayName("listCloudinaryFiles: resource khong hop le -> bo qua")
    void listCloudinaryFilesSkipsInvalidResources() throws Exception {
        ApiResponse apiResponse = mock(ApiResponse.class);
        lenient().when(apiResponse.get("resources")).thenReturn(List.of("not-a-map"));
        lenient().when(apiResponse.get("next_cursor")).thenReturn(null);
        when(api.resources(any(Map.class))).thenReturn(apiResponse);

        assertThat(service.listCloudinaryFiles()).isPresent();
        assertThat(service.listCloudinaryFiles().get()).isEmpty();
    }

    @Test
    @DisplayName("listCloudinaryFiles: co trang thai tiep -> doc trang sau")
    void listCloudinaryFilesFollowsCursor() throws Exception {
        Map<String, Object> resource = new HashMap<>();
        resource.put("public_id", "calishealth/exercise-demos/a.mp4");
        resource.put("secure_url", "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/exercise-demos/a.mp4");
        resource.put("created_at", "2026-01-02T03:04:05Z");

        ApiResponse first = mock(ApiResponse.class);
        lenient().when(first.get("resources")).thenReturn(List.of(resource));
        lenient().when(first.get("next_cursor")).thenReturn("cursor-1");
        ApiResponse second = mock(ApiResponse.class);
        lenient().when(second.get("resources")).thenReturn(List.of());
        lenient().when(second.get("next_cursor")).thenReturn(null);
        when(api.resources(any(Map.class))).thenReturn(first, second);

        assertThat(service.listCloudinaryFiles()).isPresent();
        verify(api, org.mockito.Mockito.atLeast(2)).resources(any(Map.class));
    }

    @Test
    @DisplayName("trashFolderFor: folder khong thuoc app -> giu nguyen")
    void trashFolderForKeepsForeignFolder() {
        assertThat(service.trashFolderFor("other-folder")).isEqualTo("calishealth/trash/other-folder");
    }

    @Test
    @DisplayName("trashFolderForCategory: category DEMO_VIDEO -> folder thung rac dung")
    void trashFolderForCategoryHandlesDemoVideo() {
        assertThat(service.trashFolderForCategory(MediaFile.DEMO_VIDEO))
                .isEqualTo("calishealth/trash/exercise-demos");
    }

    @Test
    @DisplayName("folderFor: file tren Cloudinary -> folder that cua file")
    void folderForReadsCloudFolder() {
        assertThat(service.folderFor(
                "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/exercise-demos/a.mp4",
                MediaFile.DEMO_VIDEO)).isEqualTo("calishealth/exercise-demos");
    }

    @Test
    @DisplayName("resolve: URL cua anh giai phau -> tra ve duong dan")
    void resolveReturnsPathForAnatomyUrl() {
        Optional<Path> path = service.resolve(ExerciseVideoStorageService.ANATOMY_PREFIX + "a.png");

        assertThat(path).isPresent();
        assertThat(path.get().getFileName().toString()).isEqualTo("a.png");
    }

    @Test
    @DisplayName("hash: file dang co -> hash 64 ky tu")
    void hashOfExistingFile() throws Exception {
        Path file = Files.createTempFile("hash-extra", ".bin");
        Files.writeString(file, "calishealth");

        assertThat(service.hash(file)).hasSize(64);
    }

    @Test
    @DisplayName("hash: doc file bang InputStream that -> tra ve hash")
    void hashOfStream() throws Exception {
        Path file = Files.createTempFile("hash-stream", ".bin");
        Files.writeString(file, "payload");

        try (InputStream in = Files.newInputStream(file)) {
            assertThat(in.readAllBytes()).isNotEmpty();
        }
        assertThat(service.hash(file)).hasSize(64);
    }
}
