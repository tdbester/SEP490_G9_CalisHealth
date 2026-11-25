package com.calishealth.service;

import com.calishealth.exception.RequestValidationException;
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

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho {@link ExerciseVideoStorageService}: luu file, kiem tra dinh dang,
 * xoa file, liet ke file va thao tac voi Cloudinary.
 */
class ExerciseVideoStorageServiceCoverageTest {

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
        videoDir = Files.createTempDirectory("calis-videos");
        anatomyDir = Files.createTempDirectory("calis-anatomy");
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

    private StorageSettings settings(int maxVideoMb, int maxSeconds, String videoFormats, String imageFormats) {
        StorageSettings s = new StorageSettings();
        s.setMaxVideoMb(maxVideoMb);
        s.setMaxImageMb(maxVideoMb);
        s.setDemoMaxSeconds(maxSeconds);
        s.setVideoFormats(videoFormats);
        s.setImageFormats(imageFormats);
        return s;
    }

    private static MultipartFile video(String name, String type) {
        return new MockMultipartFile("file", name, type, new byte[]{1, 2, 3, 4});
    }

    // --------------------------------------------------------------------- store

    @Test
    @DisplayName("store: file null -> 400")
    void storeRejectsNullFile() {
        assertThatThrownBy(() -> service.store(null, "cm@calishealth.vn"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("store: file rong -> 400")
    void storeRejectsEmptyFile() {
        MultipartFile empty = new MockMultipartFile("file", "a.mp4", "video/mp4", new byte[0]);

        assertThatThrownBy(() -> service.store(empty, "cm@calishealth.vn"))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("store: ten file khong co duoi -> 400")
    void storeRejectsFileWithoutExtension() {
        assertThatThrownBy(() -> service.store(video("noextension", "video/mp4"), "cm@calishealth.vn"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("store: content type khong phai video -> 400")
    void storeRejectsNonVideoContentType() {
        assertThatThrownBy(() -> service.store(video("a.mp4", "text/plain"), "cm@calishealth.vn"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("store: luu video vao dia local khi Cloudinary tat")
    void storeWritesToDiskWhenCloudinaryDisabled() throws Exception {
        ExerciseVideoStorageService local = new ExerciseVideoStorageService(
                videoDir.toString(), anatomyDir.toString(), "", registry, folders,
                new CloudinaryOptimizationService(true, 1600, 1280, "auto:good", "auto:good", "", ""),
                cloudinary);
        User uploaderUser = new User();
        uploaderUser.setRole(UserRole.CONTENT_MANAGER);
        when(registry.checkUpload(eq(MediaFile.DEMO_VIDEO), eq("mp4"), any(Long.class), anyString()))
                .thenReturn(uploaderUser);
        when(registry.findSameContent(anyString(), eq(MediaFile.DEMO_VIDEO))).thenReturn(Optional.empty());

        String url = local.store(video("demo.mp4", "video/mp4"), "cm@calishealth.vn");

        assertThat(url).startsWith(ExerciseVideoStorageService.VIDEO_PREFIX);
        verify(registry).register(anyString(), eq("demo.mp4"), any(Long.class),
                eq(MediaFile.DEMO_VIDEO), eq("mp4"), anyString(), any(), any());
    }

    @Test
    @DisplayName("store: noi dung trung -> tai dung ban luu")
    void storeReusesSameContent() throws Exception {
        Files.writeString(videoDir.resolve("existing.mp4"), "x");
        MediaFile existing = new MediaFile();
        existing.setId(5L);
        existing.setFileUrl("/media/exercise-demos/existing.mp4");
        when(registry.checkUpload(anyString(), anyString(), any(Long.class), anyString())).thenReturn(null);
        when(registry.findSameContent(anyString(), eq(MediaFile.DEMO_VIDEO))).thenReturn(Optional.of(existing));
        when(registry.reuse(5L)).thenReturn("/media/exercise-demos/existing.mp4");

        String url = service.store(video("demo.mp4", "video/mp4"), "cm@calishealth.vn");

        assertThat(url).isEqualTo("/media/exercise-demos/existing.mp4");
        verify(registry).reuse(5L);
        verify(uploader, never()).upload(any(java.io.File.class), any(Map.class));
    }

    @Test
    @DisplayName("store: upload len Cloudinary thanh cong")
    void storeUploadsToCloudinary() throws Exception {
        User member = new User();
        member.setRole(UserRole.MEMBER);
        when(registry.checkUpload(anyString(), anyString(), any(Long.class), anyString())).thenReturn(member);
        when(registry.findSameContent(anyString(), eq(MediaFile.DEMO_VIDEO))).thenReturn(Optional.empty());
        when(registry.settings()).thenReturn(settings(50, 60, "MP4,MOV,WEBM", "JPG,PNG,WEBP"));
        Map<String, Object> result = new HashMap<>();
        result.put("secure_url", "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/member-exercises/exercise-demos/abc.mp4");
        result.put("bytes", 1024);
        result.put("duration", 12);
        result.put("format", "mp4");
        when(uploader.uploadLarge(any(java.io.File.class), any(Map.class))).thenReturn(result);

        String url = service.store(video("demo.mp4", "video/mp4"), "member@calishealth.vn");

        assertThat(url).contains("res.cloudinary.com");
        verify(registry).register(anyString(), eq("demo.mp4"), eq(1024L), eq(MediaFile.DEMO_VIDEO),
                eq("mp4"), anyString(), eq(member), any(), eq(12));
    }

    @Test
    @DisplayName("store: video qua dai -> 400 va xoa file tren Cloudinary")
    void storeRejectsTooLongVideo() throws Exception {
        when(registry.checkUpload(anyString(), anyString(), any(Long.class), anyString())).thenReturn(null);
        when(registry.findSameContent(anyString(), eq(MediaFile.DEMO_VIDEO))).thenReturn(Optional.empty());
        when(registry.settings()).thenReturn(settings(50, 5, "MP4,MOV,WEBM", "JPG,PNG,WEBP"));
        Map<String, Object> result = new HashMap<>();
        result.put("secure_url", "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/exercise-demos/abc.mp4");
        result.put("duration", 60);
        when(uploader.uploadLarge(any(java.io.File.class), any(Map.class))).thenReturn(result);
        when(uploader.destroy(anyString(), any(Map.class))).thenReturn(Map.of("result", "ok"));

        assertThatThrownBy(() -> service.store(video("demo.mp4", "video/mp4"), "cm@calishealth.vn"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
        verify(uploader, org.mockito.Mockito.atLeastOnce()).destroy(anyString(), any(Map.class));
    }

    @Test
    @DisplayName("store: Cloudinary loi -> 502")
    void storeReportsCloudinaryFailure() throws Exception {
        when(registry.checkUpload(anyString(), anyString(), any(Long.class), anyString())).thenReturn(null);
        when(registry.findSameContent(anyString(), eq(MediaFile.DEMO_VIDEO))).thenReturn(Optional.empty());
        when(uploader.uploadLarge(any(java.io.File.class), any(Map.class))).thenThrow(new java.io.IOException("boom"));

        assertThatThrownBy(() -> service.store(video("demo.mp4", "video/mp4"), "cm@calishealth.vn"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_GATEWAY));
    }

    // -------------------------------------------------------------- anatomy image

    @Test
    @DisplayName("storeAnatomyImage: file rong -> 400")
    void storeAnatomyImageRejectsEmptyFile() {
        MultipartFile empty = new MockMultipartFile("file", "a.png", "image/png", new byte[0]);

        assertThatThrownBy(() -> service.storeAnatomyImage(empty, "cm@calishealth.vn"))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("storeAnatomyImage: ten khong co duoi -> 400")
    void storeAnatomyImageRejectsFileWithoutExtension() {
        assertThatThrownBy(() -> service.storeAnatomyImage(
                new MockMultipartFile("file", "noext", "image/png", new byte[]{1}), "cm@calishealth.vn"))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("storeAnatomyImage: content type khong phai anh -> 400")
    void storeAnatomyImageRejectsNonImageContentType() {
        assertThatThrownBy(() -> service.storeAnatomyImage(
                new MockMultipartFile("file", "a.png", "text/plain", new byte[]{1}), "cm@calishealth.vn"))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("storeAnatomyImage: upload thanh cong")
    void storeAnatomyImageUploadsToCloudinary() throws Exception {
        when(registry.checkUpload(eq(MediaFile.ANATOMY_IMAGE), eq("png"), any(Long.class), anyString())).thenReturn(null);
        when(registry.findSameContent(anyString(), eq(MediaFile.ANATOMY_IMAGE))).thenReturn(Optional.empty());
        Map<String, Object> result = new HashMap<>();
        result.put("secure_url", "https://res.cloudinary.com/" + CLOUD + "/image/upload/v1/calishealth/exercise-anatomy/abc.png");
        result.put("bytes", 512);
        when(uploader.upload(any(java.io.File.class), any(Map.class))).thenReturn(result);

        String url = service.storeAnatomyImage(
                new MockMultipartFile("file", "anatomy.png", "image/png", new byte[]{1}), "cm@calishealth.vn");

        assertThat(url).contains("exercise-anatomy");
        verify(registry).register(anyString(), eq("anatomy.png"), eq(512L), eq(MediaFile.ANATOMY_IMAGE),
                eq("png"), anyString(), any(), any(), eq(null));
    }

    // ------------------------------------------------------------ validateVideoFile

    @Test
    @DisplayName("validateVideoFile: file rong va khong bat buoc -> bo qua")
    void validateVideoFileIgnoresEmptyOptionalFile() {
        MultipartFile empty = new MockMultipartFile("file", "a.mp4", "video/mp4", new byte[0]);

        service.validateVideoFile(empty, false);
    }

    @Test
    @DisplayName("validateVideoFile: file rong va bat buoc -> 400")
    void validateVideoFileRequiresFile() {
        MultipartFile empty = new MockMultipartFile("file", "a.mp4", "video/mp4", new byte[0]);

        assertThatThrownBy(() -> service.validateVideoFile(empty, true))
                .isInstanceOf(RequestValidationException.class);
    }

    @Test
    @DisplayName("validateVideoFile: dinh dang khong hop le -> 400")
    void validateVideoFileRejectsWrongFormat() {
        when(registry.settings()).thenReturn(settings(50, 30, "MP4,MOV", "JPG,PNG"));

        assertThatThrownBy(() -> service.validateVideoFile(video("a.avi", "video/x-msvideo"), true))
                .isInstanceOf(RequestValidationException.class);
    }

    @Test
    @DisplayName("validateVideoFile: qua dung luong -> 400")
    void validateVideoFileRejectsTooLargeFile() {
        when(registry.settings()).thenReturn(settings(0, 30, "MP4,MOV", "JPG,PNG"));
        MultipartFile big = new MockMultipartFile("file", "a.mp4", "video/mp4", new byte[10]);

        assertThatThrownBy(() -> service.validateVideoFile(big, true))
                .isInstanceOf(RequestValidationException.class);
    }

    @Test
    @DisplayName("validateVideoFile: content type khong phai video -> 400")
    void validateVideoFileRejectsNonVideoContentType() {
        when(registry.settings()).thenReturn(settings(50, 30, "MP4,MOV", "JPG,PNG"));

        assertThatThrownBy(() -> service.validateVideoFile(video("a.mp4", "text/plain"), true))
                .isInstanceOf(RequestValidationException.class);
    }

    @Test
    @DisplayName("validateVideoFile: hop le -> khong nem loi")
    void validateVideoFileAcceptsValidFile() {
        when(registry.settings()).thenReturn(settings(50, 30, "MP4,MOV", "JPG,PNG"));

        service.validateVideoFile(video("a.mp4", "video/mp4"), true);
    }

    // ------------------------------------------------------------------ cloudinaryKey

    @Test
    @DisplayName("cloudinaryKey: URL tren Cloudinary -> tra ve resource/publicId")
    void cloudinaryKeyReadsPublicId() {
        Optional<String> key = service.cloudinaryKey(
                "https://res.cloudinary.com/" + CLOUD + "/video/upload/v123/calishealth/exercise-demos/abc.mp4");

        assertThat(key).isPresent();
        assertThat(key.get()).isEqualTo("video/calishealth/exercise-demos/abc");
    }

    @Test
    @DisplayName("cloudinaryKey: URL khong phai Cloudinary -> rong")
    void cloudinaryKeyIgnoresForeignUrl() {
        assertThat(service.cloudinaryKey("https://example.com/a.mp4")).isEmpty();
        assertThat(service.cloudinaryKey(null)).isEmpty();
        assertThat(service.cloudinaryKey("/media/exercise-demos/a.mp4")).isEmpty();
    }

    // ------------------------------------------------------------------- folderOf

    @Test
    @DisplayName("folderOf: file trong folder -> tra ve folder")
    void folderOfReadsFolder() {
        Optional<String> folder = service.folderOf(
                "https://res.cloudinary.com/" + CLOUD + "/image/upload/v1/calishealth/profile-avatars/a.png");

        assertThat(folder).contains("calishealth/profile-avatars");
    }

    @Test
    @DisplayName("folderOf: file khong co folder -> rong")
    void folderOfEmptyForRootFile() {
        Optional<String> folder = service.folderOf(
                "https://res.cloudinary.com/" + CLOUD + "/image/upload/v1/abc.png");

        assertThat(folder).isEmpty();
    }

    @Test
    @DisplayName("folderFor: URL la file local -> dung folder cua category")
    void folderForFallsBackToCategoryFolder() {
        assertThat(service.folderFor("/media/exercise-demos/a.mp4", MediaFile.DEMO_VIDEO))
                .isEqualTo("calishealth/exercise-demos");
    }

    // ------------------------------------------------------------------ trashFolderFor

    @Test
    @DisplayName("trashFolderFor: folder hien tai -> folder thung rac")
    void trashFolderForMirrorsOriginalFolder() {
        assertThat(service.trashFolderFor("calishealth/exercise-demos"))
                .isEqualTo("calishealth/trash/exercise-demos");
    }

    @Test
    @DisplayName("trashFolderFor: folder rong -> folder thung rac goc")
    void trashFolderForBlankFolder() {
        assertThat(service.trashFolderFor("  ")).isEqualTo("calishealth/trash");
    }

    @Test
    @DisplayName("trashFolderForCategory: dinh danh -> folder thung rac")
    void trashFolderForCategoryBuildsTrashFolder() {
        assertThat(service.trashFolderForCategory(MediaFile.ANATOMY_IMAGE))
                .isEqualTo("calishealth/trash/exercise-anatomy");
    }

    // ------------------------------------------------------------------ moveToFolder

    @Test
    @DisplayName("moveToFolder: file khong phai Cloudinary -> rong")
    void moveToFolderIgnoresForeignUrl() {
        assertThat(service.moveToFolder("/media/exercise-demos/a.mp4", "calishealth/trash")).isEmpty();
    }

    @Test
    @DisplayName("moveToFolder: folder rong -> rong")
    void moveToFolderIgnoresBlankFolder() {
        assertThat(service.moveToFolder(
                "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/exercise-demos/a.mp4", " ")).isEmpty();
    }

    @Test
    @DisplayName("moveToFolder: thanh cong -> tra ve URL moi")
    void moveToFolderReturnsNewUrl() throws Exception {
        Map<String, Object> result = new HashMap<>();
        result.put("secure_url", "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/trash/exercise-demos/b.mp4");
        when(uploader.rename(anyString(), anyString(), any(Map.class))).thenReturn(result);

        Optional<String> moved = service.moveToFolder(
                "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/exercise-demos/a.mp4",
                "calishealth/trash/exercise-demos");

        assertThat(moved).isPresent();
        assertThat(moved.get()).contains("trash/exercise-demos");
    }

    @Test
    @DisplayName("moveToFolder: Cloudinary tra loi loi -> rong")
    void moveToFolderReturnsEmptyOnFailure() throws Exception {
        when(uploader.rename(anyString(), anyString(), any(Map.class))).thenThrow(new RuntimeException("boom"));

        assertThat(service.moveToFolder(
                "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/exercise-demos/a.mp4",
                "calishealth/trash")).isEmpty();
    }

    @Test
    @DisplayName("moveToFolder: khong co secure_url -> rong")
    void moveToFolderReturnsEmptyWithoutUrl() throws Exception {
        when(uploader.rename(anyString(), anyString(), any(Map.class))).thenReturn(Map.of());

        assertThat(service.moveToFolder(
                "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/exercise-demos/a.mp4",
                "calishealth/trash")).isEmpty();
    }

    // ---------------------------------------------------------------- restoreFromTrash

    @Test
    @DisplayName("restoreFromTrash: file khong phai Cloudinary -> rong")
    void restoreFromTrashIgnoresForeignUrl() {
        assertThat(service.restoreFromTrash("/media/exercise-demos/a.mp4")).isEmpty();
    }

    @Test
    @DisplayName("restoreFromTrash: file khong nam trong thung rac -> giu nguyen URL")
    void restoreFromTrashKeepsUrlWhenNotTrashed() {
        String url = "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/exercise-demos/a.mp4";

        assertThat(service.restoreFromTrash(url)).contains(url);
    }

    @Test
    @DisplayName("restoreFromTrash: file trong thung rac -> di chuyen ve folder goc")
    void restoreFromTrashMovesBackToOriginalFolder() throws Exception {
        Map<String, Object> result = new HashMap<>();
        result.put("secure_url", "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/exercise-demos/a.mp4");
        when(uploader.rename(anyString(), anyString(), any(Map.class))).thenReturn(result);

        Optional<String> restored = service.restoreFromTrash(
                "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/trash/exercise-demos/a.mp4");

        assertThat(restored).isPresent();
        assertThat(restored.get()).contains("calishealth/exercise-demos");
    }

    // ------------------------------------------------------------------- deleteFile

    @Test
    @DisplayName("deleteFile: URL la file local -> xoa file tren dia")
    void deleteFileRemovesLocalFile() throws Exception {
        Path file = videoDir.resolve("local.mp4");
        Files.writeString(file, "x");

        assertThat(service.deleteFile(ExerciseVideoStorageService.VIDEO_PREFIX + "local.mp4")).isTrue();
        assertThat(Files.exists(file)).isFalse();
    }

    @Test
    @DisplayName("deleteFile: file da bi xoa -> true")
    void deleteFileToleratesMissingFile() {
        assertThat(service.deleteFile(ExerciseVideoStorageService.VIDEO_PREFIX + "missing.mp4")).isTrue();
    }

    @Test
    @DisplayName("deleteFile: file tren Cloudinary -> goi destroy")
    void deleteFileRemovesCloudinaryAsset() throws Exception {
        when(uploader.destroy(anyString(), any(Map.class))).thenReturn(Map.of("result", "ok"));

        boolean deleted = service.deleteFile(
                "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/exercise-demos/a.mp4");

        assertThat(deleted).isTrue();
        verify(uploader).destroy(anyString(), any(Map.class));
    }

    @Test
    @DisplayName("deleteFile: Cloudinary bao loi -> false")
    void deleteFileReportsCloudinaryFailure() throws Exception {
        when(uploader.destroy(anyString(), any(Map.class))).thenThrow(new RuntimeException("boom"));

        assertThat(service.deleteFile(
                "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/exercise-demos/a.mp4")).isFalse();
    }

    // ---------------------------------------------------------------------- resolve

    @Test
    @DisplayName("resolve: URL cua app -> tra ve duong dan")
    void resolveReturnsPathForAppUrl() {
        Optional<Path> path = service.resolve(ExerciseVideoStorageService.VIDEO_PREFIX + "a.mp4");

        assertThat(path).isPresent();
        assertThat(path.get().getFileName().toString()).isEqualTo("a.mp4");
    }

    @Test
    @DisplayName("resolve: duong dan bay (path traversal) -> rong")
    void resolveRejectsPathTraversal() {
        assertThat(service.resolve(ExerciseVideoStorageService.VIDEO_PREFIX + "../../secret.txt")).isEmpty();
    }

    @Test
    @DisplayName("resolve: URL khong thuoc app -> rong")
    void resolveIgnoresForeignUrl() {
        assertThat(service.resolve("https://example.com/a.mp4")).isEmpty();
        assertThat(service.resolve(null)).isEmpty();
    }

    // --------------------------------------------------------------- listStoredFiles

    @Test
    @DisplayName("listStoredFiles: tra ve cac file tren dia")
    void listStoredFilesReturnsFilesOnDisk() throws Exception {
        Files.writeString(videoDir.resolve("a.mp4"), "x");
        Files.writeString(anatomyDir.resolve("b.png"), "x");

        List<ExerciseVideoStorageService.StoredFile> files = service.listStoredFiles();

        assertThat(files).hasSize(2);
        assertThat(files).anySatisfy(f -> assertThat(f.url()).contains("a.mp4"));
    }

    @Test
    @DisplayName("listStoredFiles: thu muc khong ton tai -> rong")
    void listStoredFilesEmptyWhenDirectoryMissing() throws Exception {
        ExerciseVideoStorageService other = new ExerciseVideoStorageService(
                videoDir.resolve("missing").toString(), anatomyDir.resolve("missing").toString(),
                CLOUD, registry, folders,
                new CloudinaryOptimizationService(true, 1600, 1280, "auto:good", "auto:good", "", ""),
                cloudinary);

        assertThat(other.listStoredFiles()).isEmpty();
    }

    // ------------------------------------------------------------------- hash/lastModified

    @Test
    @DisplayName("hash: cung noi dung -> cung hash")
    void hashIsStable() throws Exception {
        Path file = Files.createTempFile("hash", ".bin");
        Files.writeString(file, "calishealth");

        assertThat(service.hash(file)).isEqualTo(service.hash(file));
        assertThat(service.hash(file)).hasSize(64);
    }

    @Test
    @DisplayName("lastModified: file khong ton tai -> dung thoi diem hien tai")
    void lastModifiedFallsBackToNow() {
        assertThat(ExerciseVideoStorageService.lastModified(videoDir.resolve("missing.mp4"))).isNotNull();
    }

    // --------------------------------------------------------------- listCloudinaryFiles

    @Test
    @DisplayName("listCloudinaryFiles: Cloudinary tat -> rong")
    void listCloudinaryFilesEmptyWhenDisabled() {
        ExerciseVideoStorageService local = new ExerciseVideoStorageService(
                videoDir.toString(), anatomyDir.toString(), "", registry, folders,
                new CloudinaryOptimizationService(true, 1600, 1280, "auto:good", "auto:good", "", ""),
                cloudinary);

        assertThat(local.listCloudinaryFiles()).isEmpty();
    }

    @Test
    @DisplayName("listCloudinaryFiles: doc danh sach -> tra ve map theo key")
    void listCloudinaryFilesReadsResources() throws Exception {
        Map<String, Object> resource = new HashMap<>();
        resource.put("public_id", "calishealth/exercise-demos/a.mp4");
        resource.put("secure_url", "https://res.cloudinary.com/" + CLOUD + "/video/upload/v1/calishealth/exercise-demos/a.mp4");
        resource.put("bytes", 2048);
        resource.put("format", "mp4");
        resource.put("created_at", "2026-01-02T03:04:05Z");
        Map<String, Object> page = new HashMap<>();
        page.put("resources", List.of(resource));
        ApiResponse apiResponse = mock(ApiResponse.class);
        lenient().when(apiResponse.get("resources")).thenReturn(List.of(resource));
        lenient().when(apiResponse.get("next_cursor")).thenReturn(null);
        when(api.resources(any(Map.class))).thenReturn(apiResponse);

        Optional<Map<String, ExerciseVideoStorageService.CloudFile>> files = service.listCloudinaryFiles();

        assertThat(files).isPresent();
        assertThat(files.get()).containsKey("video/calishealth/exercise-demos/a.mp4");
        assertThat(files.get().get("video/calishealth/exercise-demos/a.mp4").category())
                .isEqualTo(MediaFile.DEMO_VIDEO);
    }

    @Test
    @DisplayName("listCloudinaryFiles: Cloudinary bao loi -> rong")
    void listCloudinaryFilesEmptyOnFailure() throws Exception {
        when(api.resources(any(Map.class))).thenThrow(new RuntimeException("boom"));

        assertThat(service.listCloudinaryFiles()).isEmpty();
    }

    // ------------------------------------------------------------------- directories

    @Test
    @DisplayName("getStorageDirectory/getAnatomyImageDirectory tra ve duong dan")
    void exposesDirectories() {
        assertThat(service.getStorageDirectory()).isEqualTo(videoDir.toAbsolutePath().normalize());
        assertThat(service.getAnatomyImageDirectory()).isEqualTo(anatomyDir.toAbsolutePath().normalize());
    }
}
