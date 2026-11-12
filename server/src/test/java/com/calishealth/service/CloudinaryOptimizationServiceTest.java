package com.calishealth.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The rules that shrink the media before it is stored on the CDN.
 *
 * The values are the ones that were measured on the Cloudinary account of this app, so a change in
 * the rules has to be a deliberate one.
 */
class CloudinaryOptimizationServiceTest {

    @Test
    void buildsTheImageRule() {
        CloudinaryOptimizationService service =
                new CloudinaryOptimizationService(true, 1600, 1280, "auto:good", "auto:good", "", "");
        assertEquals("c_limit,w_1600,q_auto:good", service.imageTransformation());
        assertEquals("vc_auto,c_limit,w_1280,q_auto:good", service.videoTransformation());
    }

    @Test
    void keepsTheRuleEmptyWhenTheOptimizationIsOff() {
        CloudinaryOptimizationService service =
                new CloudinaryOptimizationService(false, 1600, 1280, "auto:good", "auto:good", "", "");
        assertEquals("", service.transformationFor(false));
        assertEquals("", service.transformationFor(true));
        assertEquals("", service.deliveryTransformation());
    }

    @Test
    void letsTheConfigurationChangeTheWidth() {
        CloudinaryOptimizationService service =
                new CloudinaryOptimizationService(true, 800, 640, "auto:good", "auto:good", "", "");
        assertEquals("c_limit,w_800,q_auto:good", service.imageTransformation());
        assertEquals("vc_auto,c_limit,w_640,q_auto:good", service.videoTransformation());
    }

    @Test
    void fallsBackToTheDefaultQualityWhenItIsNotConfigured() {
        CloudinaryOptimizationService service =
                new CloudinaryOptimizationService(true, 1600, 1280, "", "", "", "");
        assertEquals("c_limit,w_1600,q_auto:good", service.imageTransformation());
        assertEquals("vc_auto,c_limit,w_1280,q_auto:good", service.videoTransformation());
    }

    @Test
    void asksTheBrowserForTheFormatThatFitsIt() {
        CloudinaryOptimizationService service =
                new CloudinaryOptimizationService(true, 1600, 1280, "auto:good", "auto:good", "", "");
        assertEquals("q_auto:good,f_auto", service.deliveryTransformation());
    }

    @Test
    void storesTheFormatOnlyWhenOneIsConfigured() {
        CloudinaryOptimizationService service =
                new CloudinaryOptimizationService(true, 1600, 1280, "auto:good", "auto:good", "", "mp4");
        assertEquals("", service.formatFor(false));
        assertEquals("mp4", service.formatFor(true));
    }

    @Test
    void tellsWhetherItIsOn() {
        assertTrue(new CloudinaryOptimizationService(true, 1600, 1280, "auto:good", "auto:good", "", "").enabled());
    }
}
