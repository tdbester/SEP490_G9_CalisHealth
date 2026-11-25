package com.calishealth.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bo sung coverage cho {@link CloudinaryOptimizationService}: cac getter cua gioi han.
 */
class CloudinaryOptimizationServiceExtraCoverageTest {

    @Test
    @DisplayName("imageMaxWidth: tra ve gioi han rong")
    void exposesImageMaxWidth() {
        CloudinaryOptimizationService service =
                new CloudinaryOptimizationService(true, 1600, 1280, "auto:good", "auto:good", "", "");

        assertThat(service.imageMaxWidth()).isEqualTo(1600);
    }

    @Test
    @DisplayName("videoMaxWidth: tra ve gioi han rong")
    void exposesVideoMaxWidth() {
        CloudinaryOptimizationService service =
                new CloudinaryOptimizationService(true, 1600, 1280, "auto:good", "auto:good", "", "");

        assertThat(service.videoMaxWidth()).isEqualTo(1280);
    }
}
