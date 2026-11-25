package com.calishealth.service;

import com.cloudinary.Api;
import com.cloudinary.Cloudinary;
import com.cloudinary.api.ApiResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test cho {@link CloudinarySetupService}: đọc cây folder của tài khoản Cloudinary,
 * đếm file và tạo folder còn thiếu.
 */
class CloudinarySetupServiceTest {

    private Api api;
    private Cloudinary cloudinary;
    private CloudinaryFolderService folders;
    private CloudinarySetupService service;

    @BeforeEach
    void setUp() {
        api = mock(Api.class);
        cloudinary = mock(Cloudinary.class);
        lenient().when(cloudinary.api()).thenReturn(api);
        folders = new CloudinaryFolderService("calishealth");
        service = new CloudinarySetupService("u9vojlr2", folders, cloudinary);
    }

    /** Một ApiResponse giả trả về các giá trị cho sẵn. */
    private static ApiResponse apiResponse(Map<String, Object> values) {
        ApiResponse response = mock(ApiResponse.class);
        lenient().doAnswer(inv -> values.get(inv.getArgument(0))).when(response).get(anyString());
        return response;
    }

    private static Map<String, Object> folder(String path) {
        Map<String, Object> map = new HashMap<>();
        map.put("path", path);
        return map;
    }

    private static Map<String, Object> resource(String publicId, long bytes) {
        Map<String, Object> map = new HashMap<>();
        map.put("public_id", publicId);
        map.put("bytes", bytes);
        return map;
    }

    private void stubFolders(List<Map<String, Object>> foldersList) throws Exception {
        ApiResponse response = apiResponse(Map.of("folders", foldersList));
        // Chỉ folder gốc trả về danh sách; các folder con trả về rỗng để không đệ quy vô hạn.
        lenient().when(api.subFolders(anyString(), any(Map.class))).thenAnswer(inv -> {
            String parent = inv.getArgument(0, String.class);
            return "calishealth".equals(parent) ? response : apiResponse(Map.of("folders", List.of()));
        });
    }

    private void stubResources(List<Map<String, Object>> resourcesList) throws Exception {
        ApiResponse response = apiResponse(Map.of("resources", resourcesList));
        when(api.resources(any(Map.class))).thenReturn(response);
    }

    // ------------------------------------------------------------------ enabled

    @Test
    @DisplayName("enabled: co cloud name -> true")
    void enabledWithCloudName() {
        assertThat(service.enabled()).isTrue();
    }

    @Test
    @DisplayName("enabled: khong co cloud name -> false")
    void enabledWithoutCloudName() {
        CloudinarySetupService off = new CloudinarySetupService("  ", folders, cloudinary);
        assertThat(off.enabled()).isFalse();
    }

    // ------------------------------------------------------------- targetFolders

    @Test
    @DisplayName("targetFolders: tra ve danh sach folder app can dung")
    void targetFoldersListsAllFolders() {
        assertThat(service.targetFolders()).containsExactly(
                "calishealth/exercise-demos",
                "calishealth/exercise-anatomy",
                "calishealth/profile-avatars",
                "calishealth/member-exercises/exercise-demos",
                "calishealth/member-exercises/exercise-anatomy",
                "calishealth/trash");
    }

    @Test
    @DisplayName("folderLabels: co nhan de client dich")
    void folderLabelsHaveTranslationKeys() {
        Map<String, String> labels = service.folderLabels();

        assertThat(labels).containsEntry("calishealth/exercise-demos", "systemDemo");
        assertThat(labels).containsEntry("calishealth/trash", "trash");
    }

    // --------------------------------------------------------------- setupFolders

    @Test
    @DisplayName("setupFolders: folder da ton tai -> khong tao lai")
    void setupFoldersKeepsExistingFolders() throws Exception {
        stubFolders(List.of(folder("calishealth/exercise-demos")));
        stubResources(List.of());

        CloudinarySetupService.SetupResult result = service.setupFolders();

        assertThat(result.existing()).contains("calishealth/exercise-demos");
        // Các folder chưa có trong tài khoản được tạo mới.
        assertThat(result.created()).contains("calishealth/trash");
        verify(api, org.mockito.Mockito.atLeastOnce()).createFolder(anyString(), any(Map.class));
    }

    @Test
    @DisplayName("setupFolders: folder chua co -> tao moi")
    void setupFoldersCreatesMissingFolders() throws Exception {
        stubFolders(List.of());
        stubResources(List.of());
        ApiResponse created = apiResponse(Map.of());
        when(api.createFolder(anyString(), any(Map.class))).thenReturn(created);

        CloudinarySetupService.SetupResult result = service.setupFolders();

        assertThat(result.created()).hasSize(6);
        assertThat(result.failed()).isEmpty();
        assertThat(result.folders()).allSatisfy(f -> assertThat(f.exists()).isTrue());
    }

    @Test
    @DisplayName("setupFolders: doc folder that -> coi nhu da ton tai")
    void setupFoldersTreatsFailedReadAsExisting() throws Exception {
        when(api.subFolders(anyString(), any(Map.class))).thenThrow(new RuntimeException("rate limited"));
        stubResources(List.of());

        CloudinarySetupService.SetupResult result = service.setupFolders();

        assertThat(result.created()).isEmpty();
        assertThat(result.existing()).hasSize(6);
    }

    // ------------------------------------------------------------- folderExists

    @Test
    @DisplayName("folderExists: path rong -> false")
    void folderExistsRejectsBlankPath() {
        assertThat(service.folderExists(null)).isFalse();
        assertThat(service.folderExists("  ")).isFalse();
    }

    @Test
    @DisplayName("folderExists: folder co trong tai khoan -> true")
    void folderExistsReadsAccount() throws Exception {
        stubFolders(List.of(folder("calishealth/exercise-demos")));
        stubResources(List.of());

        assertThat(service.folderExists("calishealth/exercise-demos")).isTrue();
        assertThat(service.folderExists("calishealth/other")).isFalse();
    }

    // ------------------------------------------------------------- fileCount/bytes

    @Test
    @DisplayName("fileCount: dem file theo folder va cac folder cha")
    void fileCountCountsFolderTree() throws Exception {
        stubFolders(List.of(folder("calishealth/exercise-demos")));
        stubResources(List.of(resource("calishealth/exercise-demos/a.mp4", 100)));

        // Mỗi loại tài nguyên (image + video) được đếm một lần.
        assertThat(service.fileCount("calishealth/exercise-demos")).isEqualTo(2);
        assertThat(service.folderBytes("calishealth/exercise-demos")).isEqualTo(200L);
    }

    @Test
    @DisplayName("fileCount: folder khong co -> 0")
    void fileCountDefaultsToZero() throws Exception {
        stubFolders(List.of());
        stubResources(List.of());

        assertThat(service.fileCount("calishealth/exercise-demos")).isZero();
        assertThat(service.folderBytes("calishealth/exercise-demos")).isZero();
    }

    // --------------------------------------------------------------------- cache

    @Test
    @DisplayName("doc lai: ket qua duoc cache trong mot luc")
    void readFoldersIsCached() throws Exception {
        stubFolders(List.of(folder("calishealth/exercise-demos")));
        stubResources(List.of());

        service.folderExists("calishealth/exercise-demos");
        service.folderExists("calishealth/exercise-demos");

        // Một lần cho folder gốc và một lần cho folder con của cây.
        verify(api, org.mockito.Mockito.times(2)).subFolders(anyString(), any(Map.class));
    }
}
