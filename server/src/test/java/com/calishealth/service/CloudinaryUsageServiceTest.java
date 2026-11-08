package com.calishealth.service;

import com.cloudinary.Api;
import com.cloudinary.Cloudinary;
import com.cloudinary.api.ApiResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * The Storage screen shows the numbers of the Cloudinary account: how much space it uses, how much
 * bandwidth was delivered and how many credits are left.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CloudinaryUsageServiceTest {

    @Mock
    private Cloudinary cloudinary;
    @Mock
    private Api api;
    @Mock
    private ApiResponse apiResponse;

    private CloudinaryUsageService service;

    @BeforeEach
    void setUp() throws Exception {
        when(cloudinary.api()).thenReturn(api);
        when(api.usage(any())).thenReturn(apiResponse);
        service = new CloudinaryUsageService(cloudinary, "u9vojlr2");
    }

    @Test
    void readsStorageBandwidthAndCreditsFromTheProvider() {
        when(apiResponse.get("plan")).thenReturn("Free");
        when(apiResponse.get("storage")).thenReturn(Map.of("usage", 1_500_000_000L, "limit", 5_000_000_000L));
        when(apiResponse.get("bandwidth")).thenReturn(Map.of("usage", 250_000_000L, "limit", 10_000_000_000L));
        when(apiResponse.get("credits")).thenReturn(Map.of("usage", 1.5, "limit", 25.0, "used_percent", 6.0));

        var usage = service.usage().orElseThrow();

        assertThat(usage.plan()).isEqualTo("Free");
        assertThat(usage.storageUsedBytes()).isEqualTo(1_500_000_000L);
        assertThat(usage.storageLimitBytes()).isEqualTo(5_000_000_000L);
        assertThat(usage.bandwidthUsedBytes()).isEqualTo(250_000_000L);
        assertThat(usage.creditsUsed()).isEqualByComparingTo(BigDecimal.valueOf(1.5));
        assertThat(usage.creditsLimit()).isEqualByComparingTo(BigDecimal.valueOf(25.0));
        assertThat(usage.creditsUsedPercent()).isEqualTo(6.0);
        assertThat(usage.creditsLeft()).isPresent();
        assertThat(usage.creditsLeft().get()).isEqualByComparingTo(BigDecimal.valueOf(23.5));
        assertThat(usage.storagePercent()).isEqualTo(30.0);
        // The plan limits the storage, so the storage decides how much of the plan is used.
        assertThat(usage.planPercent()).isEqualTo(30.0);
    }

    @Test
    void countsTheCreditsWhenThePlanDoesNotLimitTheStorage() {
        when(apiResponse.get("plan")).thenReturn("Free");
        when(apiResponse.get("storage")).thenReturn(Map.of("usage", 176_461_284L));
        when(apiResponse.get("credits")).thenReturn(Map.of("usage", 0.19, "limit", 25.0, "used_percent", 0.76));

        var usage = service.usage().orElseThrow();

        assertThat(usage.storageLimitBytes()).isZero();
        assertThat(usage.planPercent()).isEqualTo(0.76);
    }

    @Test
    void isDisabledWithoutACloudinaryAccount() {
        CloudinaryUsageService off = new CloudinaryUsageService(cloudinary, "");

        assertThat(off.isEnabled()).isFalse();
        assertThat(off.usage()).isEmpty();
        assertThat(off.isReachable()).isFalse();
    }
}
