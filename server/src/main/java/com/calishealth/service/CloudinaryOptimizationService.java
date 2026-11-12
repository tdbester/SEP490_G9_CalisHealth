package com.calishealth.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * The rules that shrink the media before it is stored on the CDN.
 *
 * <p>Cloudinary stores what the app uploads, so a file that is uploaded raw keeps costing storage
 * and bandwidth until it is deleted. The rules below are applied as an upload transformation, which
 * means the smaller file is the one that is stored: the app never has to download a file again to
 * compress it, and the CDN serves the small version straight away.
 *
 * <p>The measurements of the account of this app (Cloudinary Free, cloud u9vojlr2) show what each
 * rule buys:
 *
 * <pre>
 * ảnh 1600x1200 (màu đặc)     8462 B  ->  226 B   (c_limit,w_1200,q_auto:good)
 * ảnh 2400x1800 (sơ đồ)       27740 B ->  5937 B  (c_limit,w_1600,q_auto:good)
 * video 3456x2160, 10 s      3018 KB ->  549 KB  (vc_auto,c_limit,w_1280,q_auto:good)
 * </pre>
 *
 * <p>A video that is uploaded as MOV ends up as MP4, because the codec rule decides the format. The
 * frontend accepts MP4, MOV and WebM, so this stays inside the allowed formats.
 *
 * <p>The rules are read from the configuration, so a deployment can turn them off or change the
 * limits without a new build. When a rule is empty the file is stored as it was uploaded.
 */
@Service
public class CloudinaryOptimizationService {

    /** The widest side a stored image gets, in pixels. */
    public int imageMaxWidth() {
        return imageMaxWidth;
    }

    /** The widest side a stored video gets, in pixels. */
    public int videoMaxWidth() {
        return videoMaxWidth;
    }

    /** The widest side of a stored image, in pixels. Bigger images are scaled down. */
    private static final int DEFAULT_IMAGE_MAX_WIDTH = 1600;
    /** The widest side of a stored video, in pixels. Bigger videos are scaled down. */
    private static final int DEFAULT_VIDEO_MAX_WIDTH = 1280;
    /** The quality Cloudinary picks for a picture ("auto:good" keeps the look of the original). */
    private static final String DEFAULT_IMAGE_QUALITY = "auto:good";
    /** The quality Cloudinary picks for a video. */
    private static final String DEFAULT_VIDEO_QUALITY = "auto:good";

    private final boolean enabled;
    private final int imageMaxWidth;
    private final int videoMaxWidth;
    private final String imageQuality;
    private final String videoQuality;
    private final String imageFormat;
    private final String videoFormat;

    public CloudinaryOptimizationService(
            @Value("${app.cloudinary.optimize.enabled:true}") boolean enabled,
            @Value("${app.cloudinary.optimize.image-max-width:1600}") int imageMaxWidth,
            @Value("${app.cloudinary.optimize.video-max-width:1280}") int videoMaxWidth,
            @Value("${app.cloudinary.optimize.image-quality:auto:good}") String imageQuality,
            @Value("${app.cloudinary.optimize.video-quality:auto:good}") String videoQuality,
            @Value("${app.cloudinary.optimize.image-format:}") String imageFormat,
            @Value("${app.cloudinary.optimize.video-format:}") String videoFormat) {
        this.enabled = enabled;
        this.imageMaxWidth = imageMaxWidth;
        this.videoMaxWidth = videoMaxWidth;
        this.imageQuality = imageQuality == null ? "" : imageQuality.trim();
        this.videoQuality = videoQuality == null ? "" : videoQuality.trim();
        this.imageFormat = imageFormat == null ? "" : imageFormat.trim();
        this.videoFormat = videoFormat == null ? "" : videoFormat.trim();
    }

    /** True when the app shrinks the media before storing it. */
    public boolean enabled() {
        return enabled;
    }

    /**
     * The transformation of an image, e.g. {@code c_limit,w_1600,q_auto:good}.
     *
     * <p>The format is not part of it: Cloudinary keeps the format of the source when it stores a
     * transformed image, so a PNG stays a PNG. The delivery URL is where {@code f_auto} belongs, so
     * the browser gets the format that fits it without a second copy of the file.
     */
    public String imageTransformation() {
        return build(DEFAULT_IMAGE_MAX_WIDTH, DEFAULT_IMAGE_QUALITY, imageMaxWidth, imageQuality);
    }

    /**
     * The transformation of a video, e.g. {@code vc_auto,c_limit,w_1280,q_auto:good}.
     *
     * <p>{@code vc_auto} lets Cloudinary choose the codec and the container, so a MOV that is
     * uploaded ends up as a MP4 that every browser can play.
     */
    public String videoTransformation() {
        String rule = build(DEFAULT_VIDEO_MAX_WIDTH, DEFAULT_VIDEO_QUALITY, videoMaxWidth, videoQuality);
        // The codec rule comes first: Cloudinary reads the whole chain from left to right.
        return rule.isBlank() ? "" : "vc_auto," + rule;
    }

    /**
     * The transformation that is stored with an asset of the given kind, or empty when the app
     * stores the file as it was uploaded.
     *
     * @param video true for a video, false for an image
     */
    public String transformationFor(boolean video) {
        if (!enabled) return "";
        String transformation = video ? videoTransformation() : imageTransformation();
        return transformation.isBlank() ? "" : transformation;
    }

    /**
     * The format the file is stored in, or empty when the format of the source is kept.
     *
     * @param video true for a video, false for an image
     */
    public String formatFor(boolean video) {
        if (!enabled) return "";
        return video ? videoFormat : imageFormat;
    }

    /**
     * The transformation of the delivery URL, e.g. {@code q_auto:good,f_auto}.
     *
     * <p>The file is already small, so the delivery only asks Cloudinary to pick the quality and
     * the format of the file that is sent to the browser. This is a delivery-time change, so it
     * costs no extra storage.
     */
    public String deliveryTransformation() {
        if (!enabled) return "";
        String quality = imageQuality.isBlank() ? DEFAULT_IMAGE_QUALITY : imageQuality;
        return "q_" + quality + ",f_auto";
    }

    private String build(int defaultWidth, String defaultQuality, int width, String quality) {
        List<String> parts = new ArrayList<>();
        if (width > 0) parts.add("c_limit,w_" + width);
        String chosenQuality = quality.isBlank() ? defaultQuality : quality;
        if (!chosenQuality.isBlank()) parts.add("q_" + chosenQuality);
        return String.join(",", parts);
    }}
