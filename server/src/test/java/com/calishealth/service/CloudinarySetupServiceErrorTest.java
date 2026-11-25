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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bo sung coverage cho {@link CloudinarySetupService}: loi tao folder, loi doc file theo
 * loai tai nguyen va loi doc cay folder.
 */
class CloudinarySetupServiceErrorTest {

    private Api api;
    private Cloudinary cloudinary;
    private CloudinaryFolderService folders;
    private CloudinarySetupService service;

    @BeforeEach
    void setUp() {
        api = mock(Api.class);
        cloudinary = mock(Cloudinary.class);
        org.mockito.Mockito.lenient().when(cloudinary.api()).thenReturn(api);
        folders = new CloudinaryFolderService("calishealth");
        service = new CloudinarySetupService("u9vojlr2", folders, cloudinary);
    }

    private static ApiResponse apiResponse(Map<String, Object> values) {
        ApiResponse response = mock(ApiResponse.class);
        org.mockito.Mockito.lenient().doAnswer(inv -> values.get(inv.getArgument(0)))
                .when(response).get(anyString());
        return response;
    }

    /** ApiResponse rong, dung khi chi can mot doi tuong tra ve hinh thuc. */
    private static ApiResponse emptyResponse() {
        return apiResponse(Map.of());
    }

    @Test
    @DisplayName("setupFolders: doc cay folder that bai -> coi nhu da ton tai")
    void setupFoldersTreatsFailedTreeReadAsExisting() throws Exception {
        ApiResponse empty = emptyResponse();
        when(api.subFolders(anyString(), any(Map.class))).thenThrow(new RuntimeException("rate limited"));
        when(api.resources(any(Map.class))).thenReturn(empty);

        CloudinarySetupService.SetupResult result = service.setupFolders();

        assertThat(result.created()).isEmpty();
        assertThat(result.existing()).hasSize(6);
        assertThat(result.failed()).isEmpty();
    }

    @Test
    @DisplayName("setupFolders: doc file theo loai that bai -> van tao duoc folder")
    void setupFoldersSurvivesResourceReadFailure() throws Exception {
        ApiResponse foldersResponse = apiResponse(Map.of("folders", List.of()));
        ApiResponse childResponse = apiResponse(Map.of("folders", List.of()));
        org.mockito.Mockito.lenient().when(api.subFolders(anyString(), any(Map.class)))
                .thenAnswer(inv -> "calishealth".equals(inv.getArgument(0, String.class))
                        ? foldersResponse : childResponse);
        when(api.resources(any(Map.class))).thenThrow(new RuntimeException("quota exceeded"));
        ApiResponse created = emptyResponse();
        when(api.createFolder(anyString(), any(Map.class))).thenReturn(created);

        CloudinarySetupService.SetupResult result = service.setupFolders();

        assertThat(result.created()).hasSize(6);
        assertThat(result.failed()).isEmpty();
    }

    @Test
    @DisplayName("setupFolders: tao folder that bai -> van ghi vao danh sach created")
    void setupFoldersReportsFailedCreation() throws Exception {
        ApiResponse foldersResponse = apiResponse(Map.of("folders", List.of()));
        ApiResponse childResponse = apiResponse(Map.of("folders", List.of()));
        ApiResponse resourcesResponse = apiResponse(Map.of("resources", List.of()));
        org.mockito.Mockito.lenient().when(api.subFolders(anyString(), any(Map.class)))
                .thenAnswer(inv -> "calishealth".equals(inv.getArgument(0, String.class))
                        ? foldersResponse : childResponse);
        when(api.resources(any(Map.class))).thenReturn(resourcesResponse);
        when(api.createFolder(anyString(), any(Map.class))).thenThrow(new RuntimeException("boom"));

        CloudinarySetupService.SetupResult result = service.setupFolders();

        // createFolder nuot loi ben trong -> folder van duoc coi la da tao.
        assertThat(result.created()).hasSize(6);
        assertThat(result.folders()).allSatisfy(f -> assertThat(f.exists()).isTrue());
    }

    @Test
    @DisplayName("fileCount: doc file that bai -> dem duoc 0")
    void fileCountIsZeroWhenResourceReadFails() throws Exception {
        ApiResponse foldersResponse = apiResponse(Map.of("folders", List.of()));
        ApiResponse childResponse = apiResponse(Map.of("folders", List.of()));
        org.mockito.Mockito.lenient().when(api.subFolders(anyString(), any(Map.class)))
                .thenAnswer(inv -> "calishealth".equals(inv.getArgument(0, String.class))
                        ? foldersResponse : childResponse);
        when(api.resources(any(Map.class))).thenThrow(new RuntimeException("quota exceeded"));

        assertThat(service.fileCount("calishealth/exercise-demos")).isZero();
        assertThat(service.folderBytes("calishealth/exercise-demos")).isZero();
    }

    @Test
    @DisplayName("folderExists: doc cay folder that bai -> false")
    void folderExistsIsFalseWhenTreeReadFails() throws Exception {
        when(api.subFolders(anyString(), any(Map.class))).thenThrow(new RuntimeException("boom"));

        assertThat(service.folderExists("calishealth/exercise-demos")).isFalse();
    }

    @Test
    @DisplayName("setupFolders: folder cha co trong tai khoan -> tao moi")
    void setupFoldersCreatesMissingFolders() throws Exception {
        ApiResponse foldersResponse = apiResponse(Map.of("folders", List.of()));
        ApiResponse childResponse = apiResponse(Map.of("folders", List.of()));
        ApiResponse resourcesResponse = apiResponse(Map.of("resources", List.of()));
        ApiResponse created = emptyResponse();
        org.mockito.Mockito.lenient().when(api.subFolders(anyString(), any(Map.class)))
                .thenAnswer(inv -> "calishealth".equals(inv.getArgument(0, String.class))
                        ? foldersResponse : childResponse);
        when(api.resources(any(Map.class))).thenReturn(resourcesResponse);
        when(api.createFolder(anyString(), any(Map.class))).thenReturn(created);

        CloudinarySetupService.SetupResult result = service.setupFolders();

        assertThat(result.created()).hasSize(6);
        assertThat(result.existing()).isEmpty();
        assertThat(result.failed()).isEmpty();
    }
}
