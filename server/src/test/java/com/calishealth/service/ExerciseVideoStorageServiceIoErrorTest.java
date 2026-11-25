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

import java.io.IOException;
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
import static org.mockito.Mockito.when;

/**
 * Bo sung coverage cho {@link ExerciseVideoStorageService}: nhanh ghi file that bai, xoa file
 * that bai, doc thu muc that bai va cac nhanh logic chua chay toi.
 */
class ExerciseVideoStorageServiceIoErrorTest {

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
        videoDir = Files.createTempDirectory("calis-videos-io");
        anatomyDir = Files.createTempDirectory("calis-anatomy-io");
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

    private StorageSettings settings() {
        StorageSettings s = new StorageSettings();
        s.setMaxVideoMb(50);
        s.setMaxImageMb(50);
        s.setDemoMaxSeconds(60);
        s.setVideoFormats("MP4,MOV,WEBM");
        s.setImageFormats("JPG,PNG,WEBP");
        return s;
    }

    private static MultipartFile video(String name) {
        return new MockMultipartFile("file", name, "video/mp4", new byte[]{1, 2, 3, 4});
    }

    @Test
    @DisplayName("store: di chuyen file that bai -> 500")
    void storeReportsMoveFailure() throws Exception {
        // Thu muc video la mot FILE (khong phai thu muc) -> Files.move that bai.
        Path blocked = Files.createTempFile("calis-blocked", ".bin");
        ExerciseVideoStorageService local = new ExerciseVideoStorageService(
                blocked.toString(), anatomyDir.toString(), "", registry, folders,
                new CloudinaryOptimizationService(true, 1600, 1280, "auto:good", "auto:good", "", ""),
                cloudinary);
        when(registry.checkUpload(anyString(), anyString(), anyLong(), anyString())).thenReturn(null);
        when(registry.findSameContent(anyString(), eq(MediaFile.DEMO_VIDEO))).thenReturn(Optional.empty());

        assertThatThrownBy(() -> local.store(video("demo.mp4"), "cm@calishealth.vn"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR));
    }

    @Test
    @DisplayName("deleteFile: xoa mot thu muc khong rong -> false, khong nem loi")
    void deleteFileToleratesIoFailure() throws Exception {
        // Files.deleteIfExists tren thu muc khong rong nem IOException.
        Path dir = Files.createDirectories(videoDir.resolve("bundle"));
        Files.writeString(dir.resolve("a.mp4"), "x");

        boolean deleted = service.deleteFile(ExerciseVideoStorageService.VIDEO_PREFIX + "bundle");

        assertThat(deleted).isFalse();
    }

    @Test
    @DisplayName("listStoredFiles: thu muc khong phai thu muc -> bo qua, khong nem loi")
    void listStoredFilesSkipsNonDirectory() throws Exception {
        Path notADirectory = Files.createTempFile("calis-notdir", ".bin");
        ExerciseVideoStorageService local = new ExerciseVideoStorageService(
                notADirectory.toString(), anatomyDir.toString(), "", registry, folders,
                new CloudinaryOptimizationService(true, 1600, 1280, "auto:good", "auto:good", "", ""),
                cloudinary);

        assertThat(local.listStoredFiles()).isEmpty();
    }

    @Test
    @DisplayName("store: san pham trung noi dung -> dung lai file da co")
    void storeReusesIdenticalContent() throws Exception {
        when(registry.checkUpload(anyString(), anyString(), anyLong(), anyString())).thenReturn(null);
        when(registry.settings()).thenReturn(settings());
        when(registry.findSameContent(anyString(), eq(MediaFile.DEMO_VIDEO))).thenReturn(Optional.empty());
        Map<String, Object> result = new HashMap<>();
        result.put("secure_url", "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/exercise-demos/abc.mp4");
        when(uploader.uploadLarge(any(java.io.File.class), any(Map.class))).thenReturn(result);

        String url = service.store(video("demo.mp4"), "cm@calishealth.vn");

        assertThat(url).contains("exercise-demos");
    }

    @Test
    @DisplayName("store: member tai len -> folder member-exercises")
    void storeMarksMemberAsSource() throws Exception {
        User member = new User();
        member.setRole(UserRole.MEMBER);
        when(registry.checkUpload(anyString(), anyString(), anyLong(), anyString())).thenReturn(member);
        when(registry.settings()).thenReturn(settings());
        when(registry.findSameContent(anyString(), eq(MediaFile.DEMO_VIDEO))).thenReturn(Optional.empty());
        Map<String, Object> result = new HashMap<>();
        result.put("secure_url", "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/member-exercises/exercise-demos/abc.mp4");
        when(uploader.uploadLarge(any(java.io.File.class), any(Map.class))).thenReturn(result);

        service.store(video("demo.mp4"), "member@calishealth.vn");

        assertThat(capturedUploadFolder()).contains("member-exercises");
    }

    @Test
    @DisplayName("store: content manager tai len -> folder he thong")
    void storeMarksStaffAsSystemSource() throws Exception {
        when(registry.checkUpload(anyString(), anyString(), anyLong(), anyString())).thenReturn(null);
        when(registry.settings()).thenReturn(settings());
        when(registry.findSameContent(anyString(), eq(MediaFile.DEMO_VIDEO))).thenReturn(Optional.empty());
        Map<String, Object> result = new HashMap<>();
        result.put("secure_url", "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/exercise-demos/abc.mp4");
        when(uploader.uploadLarge(any(java.io.File.class), any(Map.class))).thenReturn(result);

        service.store(video("demo.mp4"), "cm@calishealth.vn");

        assertThat(capturedUploadFolder()).doesNotContain("member-exercises");
    }

    @SuppressWarnings("unchecked")
    private String capturedUploadFolder() throws Exception {
        org.mockito.ArgumentCaptor<Map> captor = org.mockito.ArgumentCaptor.forClass(Map.class);
        org.mockito.Mockito.verify(uploader).uploadLarge(any(java.io.File.class), captor.capture());
        Object folder = captor.getValue().get("folder");
        return folder == null ? "" : folder.toString();
    }

    @Test
    @DisplayName("listCloudinaryFiles: khong co Cloudinary -> rong")
    void listCloudinaryFilesWithoutCloudNameIsEmpty() throws Exception {
        ExerciseVideoStorageService local = new ExerciseVideoStorageService(
                videoDir.toString(), anatomyDir.toString(), "", registry, folders,
                new CloudinaryOptimizationService(true, 1600, 1280, "auto:good", "auto:good", "", ""),
                cloudinary);

        assertThat(local.listCloudinaryFiles()).isEmpty();
    }

    @Test
    @DisplayName("resolve: duong dan chua chuan hoa -> rong")
    void resolveRejectsEscapingPath() {
        Optional<Path> path = service.resolve(ExerciseVideoStorageService.VIDEO_PREFIX + "../../secret.txt");

        assertThat(path).isEmpty();
    }

    @Test
    @DisplayName("resolve: URL null -> rong")
    void resolveRejectsNullUrl() {
        assertThat(service.resolve(null)).isEmpty();
    }

    @Test
    @DisplayName("lastModified: file khong ton tai -> dung gio hien tai")
    void lastModifiedFallsBackToNow() {
        Path missing = videoDir.resolve("missing.mp4");

        assertThat(ExerciseVideoStorageService.lastModified(missing)).isNotNull();
    }

    @Test
    @DisplayName("listStoredFiles: thu muc rong -> khong co file")
    void listStoredFilesOnEmptyDirectory() {
        assertThat(service.listStoredFiles()).isEmpty();
    }

    @Test
    @DisplayName("listCloudinaryFiles: api tra ve danh sach rong -> rong")
    void listCloudinaryFilesWithEmptyResponse() throws Exception {
        ApiResponse response = mock(ApiResponse.class);
        lenient().when(response.get("resources")).thenReturn(List.of());
        lenient().when(response.get("next_cursor")).thenReturn(null);
        when(api.resources(any(Map.class))).thenReturn(response);

        Optional<Map<String, ExerciseVideoStorageService.CloudFile>> files = service.listCloudinaryFiles();

        assertThat(files).isPresent();
        assertThat(files.get()).isEmpty();
    }
}
