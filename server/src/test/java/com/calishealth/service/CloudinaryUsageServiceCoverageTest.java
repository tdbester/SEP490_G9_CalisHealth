package com.calishealth.service;

import com.cloudinary.Api;
import com.cloudinary.Cloudinary;
import com.cloudinary.api.ApiResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bá»™ test bá»• sung cho {@link CloudinaryUsageService}: cache, lá»—i API, pháº§n trÄƒm vÃ  liÃªn káº¿t console.
 */
class CloudinaryUsageServiceCoverageTest {

    private Cloudinary cloudinary;
    private Api api;
    private ApiResponse apiResponse;
    private CloudinaryUsageService service;

    @BeforeEach
    void setUp() {
        cloudinary = mock(Cloudinary.class);
        api = mock(Api.class);
        apiResponse = mock(ApiResponse.class);
        when(cloudinary.api()).thenReturn(api);
        service = new CloudinaryUsageService(cloudinary, "u9vojlr2");
    }

    @Test
    @DisplayName("isEnabled: co cloud name -> true")
    void enabledWithCloudName() {
        assertThat(service.isEnabled()).isTrue();
        assertThat(service.cloudName()).isEqualTo("u9vojlr2");
    }

    @Test
    @DisplayName("isEnabled: cloud name null -> false")
    void disabledWithoutCloudName() {
        CloudinaryUsageService off = new CloudinaryUsageService(cloudinary, null);

        assertThat(off.isEnabled()).isFalse();
        assertThat(off.cloudName()).isEmpty();
    }

    @Test
    @DisplayName("consoleLinks: co cloud name -> tra ve duong dan")
    void consoleLinksWithAccount() {
        var links = service.consoleLinks();

        assertThat(links.mediaLibrary()).contains("media_library").contains("u9vojlr2");
        assertThat(links.usage()).contains("l_usage").contains("u9vojlr2");
        assertThat(links.uploadSettings()).contains("settings/upload");
        assertThat(links.plan()).contains("l_plan");
    }

    @Test
    @DisplayName("consoleLinks: khong co cloud name -> lien ket rong")
    void consoleLinksWithoutAccount() {
        CloudinaryUsageService off = new CloudinaryUsageService(cloudinary, "");

        var links = off.consoleLinks();

        assertThat(links.mediaLibrary()).isNull();
        assertThat(links.usage()).isNull();
        assertThat(links.uploadSettings()).isNull();
        assertThat(links.plan()).isNull();
    }

    @Test
    @DisplayName("usage: goi API that bai -> luu loi va tra rong")
    void usageFailsWhenApiThrows() throws Exception {
        when(api.usage(any())).thenThrow(new RuntimeException("network down"));

        assertThat(service.usage()).isEmpty();
        assertThat(service.lastError()).isEqualTo("network down");
    }

    @Test
    @DisplayName("usage: goi API that bai sau khi doc thanh cong -> giu so lieu cu")
    void usageKeepsLastKnownValuesOnFailure() throws Exception {
        when(api.usage(any())).thenReturn(apiResponse);
        when(apiResponse.get("plan")).thenReturn("Free");
        when(apiResponse.get("storage")).thenReturn(Map.of("usage", 100L, "limit", 200L));
        when(apiResponse.get("bandwidth")).thenReturn(Map.of("usage", 10L, "limit", 100L));
        when(apiResponse.get("credits")).thenReturn(Map.of());

        assertThat(service.usage()).isPresent();

        when(api.usage(any())).thenThrow(new RuntimeException("boom"));
        var cached = service.usage().orElseThrow();

        assertThat(cached.storageUsedBytes()).isEqualTo(100L);
        // Cache còn hiệu lực nên API không bị gọi lại -> không có lỗi mới.
        assertThat(service.lastError()).isNull();
    }

    @Test
    @DisplayName("usage: goi API 2 lan lien tiep -> ket qua duoc cache")
    void usageIsCached() throws Exception {
        when(api.usage(any())).thenReturn(apiResponse);
        when(apiResponse.get("plan")).thenReturn("Free");
        when(apiResponse.get("storage")).thenReturn(Map.of("usage", 1L, "limit", 2L));
        when(apiResponse.get("bandwidth")).thenReturn(Map.of());
        when(apiResponse.get("credits")).thenReturn(Map.of());

        service.usage();
        service.usage();

        org.mockito.Mockito.verify(api, org.mockito.Mockito.times(1)).usage(any());
    }

    @Test
    @DisplayName("usage: response khong co du lieu -> so lieu 0")
    void usageHandlesEmptySections() throws Exception {
        when(api.usage(any())).thenReturn(apiResponse);
        when(apiResponse.get("plan")).thenReturn(null);
        when(apiResponse.get("storage")).thenReturn("not-a-map");
        when(apiResponse.get("bandwidth")).thenReturn(Map.of("usage", 5L));
        when(apiResponse.get("credits")).thenReturn(Map.of("usage", 1.234));

        var usage = service.usage().orElseThrow();

        assertThat(usage.plan()).isNull();
        assertThat(usage.storageUsedBytes()).isZero();
        assertThat(usage.storageLimitBytes()).isZero();
        assertThat(usage.bandwidthUsedBytes()).isEqualTo(5L);
        assertThat(usage.creditsUsed()).isEqualByComparingTo(new BigDecimal("1.23"));
        assertThat(usage.creditsLimit()).isNull();
        assertThat(usage.creditsUsedPercent()).isZero();
        assertThat(usage.creditsLeft()).isEmpty();
    }

    @Test
    @DisplayName("Usage: percentOf voi limit 0 -> 0")
    void percentOfWithoutLimit() {
        var usage = new CloudinaryUsageService.Usage("Free", 100, 0, 50, 0, null, null, 0, null);

        assertThat(usage.storagePercent()).isZero();
        assertThat(usage.bandwidthPercent()).isZero();
        assertThat(usage.percentOf(10, 0)).isZero();
    }

    @Test
    @DisplayName("Usage: percentOf vuot qua gioi han -> 100")
    void percentIsCappedAtHundred() {
        var usage = new CloudinaryUsageService.Usage("Free", 500, 100, 0, 0, null, null, 0, null);

        assertThat(usage.storagePercent()).isEqualTo(100.0);
    }

    @Test
    @DisplayName("Usage: planPercent dung credit khi khong gioi han storage")
    void planPercentUsesCreditsWithoutStorageLimit() {
        var usage = new CloudinaryUsageService.Usage("Free", 100, 0, 0, 0,
                BigDecimal.ONE, BigDecimal.TEN, 12.5, null);

        assertThat(usage.planPercent()).isEqualTo(12.5);
    }

    @Test
    @DisplayName("Usage: planPercent dung bandwidth khi khong co giá»›i han")
    void planPercentFallsBackToBandwidth() {
        var usage = new CloudinaryUsageService.Usage("Free", 100, 0, 50, 100, null, null, 0, null);

        assertThat(usage.planPercent()).isEqualTo(50.0);
    }

    @Test
    @DisplayName("Usage: creditsLeft khi het credit -> 0")
    void creditsLeftNeverGoesNegative() {
        var usage = new CloudinaryUsageService.Usage("Free", 0, 0, 0, 0,
                BigDecimal.TEN, BigDecimal.ONE, 100, null);

        assertThat(usage.creditsLeft()).isPresent();
        assertThat(usage.creditsLeft().get()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("Usage: creditsLeft khi khong do credit -> rong")
    void creditsLeftEmptyWithoutMetering() {
        var usage = new CloudinaryUsageService.Usage("Free", 0, 0, 0, 0,
                null, BigDecimal.TEN, 0, null);

        assertThat(usage.creditsLeft()).isEmpty();
    }

    @Test
    @DisplayName("isReachable: API tra status ok -> true")
    void reachableWhenApiAnswers() throws Exception {
        when(api.ping(any())).thenReturn(apiResponse);
        when(apiResponse.get("status")).thenReturn("ok");

        assertThat(service.isReachable()).isTrue();
    }

    @Test
    @DisplayName("isReachable: API khong tra status -> van true")
    void reachableWithoutStatus() throws Exception {
        when(api.ping(any())).thenReturn(apiResponse);
        when(apiResponse.get("status")).thenReturn(null);

        assertThat(service.isReachable()).isTrue();
    }

    @Test
    @DisplayName("isReachable: API loi -> false va ghi loi")
    void unreachableOnApiFailure() throws Exception {
        when(api.ping(any())).thenThrow(new RuntimeException("down"));

        assertThat(service.isReachable()).isFalse();
        assertThat(service.lastError()).isEqualTo("down");
    }
}
