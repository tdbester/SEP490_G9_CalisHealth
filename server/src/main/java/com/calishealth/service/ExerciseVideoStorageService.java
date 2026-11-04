package com.calishealth.service;

import com.calishealth.models.MediaFile;
import com.calishealth.models.StorageSettings;
import com.calishealth.models.User;
import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;
import com.calishealth.exception.RequestValidationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * Stores exercise demo videos and anatomy images on Cloudinary (or the local disk when Cloudinary is
 * not configured) and registers each file in media_files. Limits come from the admin storage settings;
 * identical content is stored once. Files stored locally before Cloudinary was enabled keep working.
 */
@Service
public class ExerciseVideoStorageService {
    private static final Logger logger = LoggerFactory.getLogger(ExerciseVideoStorageService.class);
    static final String VIDEO_PREFIX = "/media/exercise-demos/";
    static final String ANATOMY_PREFIX = "/media/exercise-anatomy/";
    /** Uploads are written here first, then moved next to the other files once their hash is known. */
    private static final String INCOMING_DIR = ".incoming";

    private final Path storageDirectory;
    private final Path anatomyImageDirectory;
    private final MediaRegistryService registry;
    private final Cloudinary cloudinary;
    private final String cloudName;
    private final String cloudinaryFolder;

    /** A file found on disk by {@link #listStoredFiles()}. */
    public record StoredFile(String url, Path path, String category) {}

    public ExerciseVideoStorageService(
            @Value("${app.storage.exercise-video-dir:${user.home}/calishealth/uploads/exercise-videos}") String storageDirectory,
            @Value("${app.storage.exercise-anatomy-dir:${user.home}/calishealth/uploads/exercise-anatomy}") String anatomyImageDirectory,
            @Value("${app.cloudinary.cloud-name:}") String cloudName,
            @Value("${app.cloudinary.folder:calishealth}") String cloudinaryFolder,
            MediaRegistryService registry,
            Cloudinary cloudinary
    ) {
        this.storageDirectory = Path.of(storageDirectory).toAbsolutePath().normalize();
        this.anatomyImageDirectory = Path.of(anatomyImageDirectory).toAbsolutePath().normalize();
        this.registry = registry;
        this.cloudinary = cloudinary;
        this.cloudName = cloudName == null ? "" : cloudName.trim();
        this.cloudinaryFolder = cloudinaryFolder;
    }

    /** Stores a demo video and returns its public URL. */
    public String store(MultipartFile file, String uploaderEmail) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a video file to upload");
        }
        String extension = getExtension(file.getOriginalFilename());
        if (extension.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Video must be an MP4, MOV, or WebM file");
        }
        String contentType = file.getContentType();
        if (contentType != null && !contentType.isBlank()
                && !contentType.toLowerCase(Locale.ROOT).startsWith("video/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Uploaded file must be a video");
        }
        return storeChecked(file, extension, MediaFile.DEMO_VIDEO, uploaderEmail);
    }

    /**
     * Checks a member's video before content moderation reads it. Formats and the size limit come from
     * the admin storage settings; quotas are checked again when the file is stored.
     */
    public void validateVideoFile(MultipartFile file, boolean required) {
        if (file == null || file.isEmpty()) {
            if (required) {
                throw new RequestValidationException("videoFile", "Vui lòng chọn video bài tập");
            }
            return;
        }
        StorageSettings settings = registry.settings();
        List<String> formats = settings.videoFormatList();
        if (!formats.contains(MediaRegistryService.normalizeFormat(getExtension(file.getOriginalFilename())))) {
            throw new RequestValidationException("videoFile", "Video phải có định dạng " + String.join(", ", formats));
        }
        if (file.getSize() > settings.getMaxVideoMb() * 1024L * 1024L) {
            throw new RequestValidationException("videoFile", "Video không được vượt quá " + settings.getMaxVideoMb() + " MB");
        }
        String contentType = file.getContentType();
        if (contentType != null && !contentType.isBlank()
                && !contentType.toLowerCase(Locale.ROOT).startsWith("video/")) {
            throw new RequestValidationException("videoFile", "Tệp tải lên phải là video");
        }
    }

    /** Stores an anatomy image and returns its public URL. */
    public String storeAnatomyImage(MultipartFile file, String uploaderEmail) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose an anatomy image to upload");
        }
        String extension = getExtension(file.getOriginalFilename());
        if (extension.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image must be JPG, PNG, or WebP");
        }
        String contentType = file.getContentType();
        if (contentType != null && !contentType.isBlank() && !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Uploaded file must be an image");
        }
        return storeChecked(file, extension, MediaFile.ANATOMY_IMAGE, uploaderEmail);
    }

    private String storeChecked(MultipartFile file, String extension, String category, String uploaderEmail) {
        User uploader = registry.checkUpload(category, extension, file.getSize(), uploaderEmail);
        Path directory = directoryFor(category);
        Path incoming = directory.resolve(INCOMING_DIR);
        Path temp = incoming.resolve(UUID.randomUUID() + ".part");
        String hash;
        try {
            Files.createDirectories(incoming);
            try (InputStream in = file.getInputStream()) {
                hash = copyAndHash(in, temp);
            }
        } catch (IOException exception) {
            deleteQuietly(temp);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not save the uploaded file", exception);
        }

        Optional<MediaFile> same = registry.findSameContent(hash, category);
        if (same.isPresent() && isStored(same.get().getFileUrl())) {
            deleteQuietly(temp);
            return registry.reuse(same.get().getId());
        }

        if (cloudinaryEnabled()) {
            String url;
            try {
                url = uploadToCloudinary(temp, category);
            } catch (IOException | RuntimeException exception) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not upload the file to cloud storage", exception);
            } finally {
                deleteQuietly(temp);
            }
            try {
                registry.register(url, file.getOriginalFilename(), file.getSize(), category, extension, hash, uploader, LocalDateTime.now());
                return url;
            } catch (RuntimeException exception) {
                deleteFile(url);
                throw exception;
            }
        }

        String fileName = UUID.randomUUID() + "." + extension;
        Path destination = directory.resolve(fileName).normalize();
        String url = prefixFor(category) + fileName;
        try {
            Files.move(temp, destination, StandardCopyOption.REPLACE_EXISTING);
            registry.register(url, file.getOriginalFilename(), file.getSize(), category, extension, hash, uploader, LocalDateTime.now());
            return url;
        } catch (IOException exception) {
            deleteQuietly(temp);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not save the uploaded file", exception);
        } catch (RuntimeException exception) {
            deleteQuietly(destination);
            throw exception;
        }
    }

    private boolean cloudinaryEnabled() {
        return !cloudName.isEmpty();
    }

    /** Uploads the file into {folder}/exercise-demos or {folder}/exercise-anatomy and returns its HTTPS URL. */
    private String uploadToCloudinary(Path file, String category) throws IOException {
        boolean video = !MediaFile.ANATOMY_IMAGE.equals(category);
        Map<?, ?> options = ObjectUtils.asMap(
                "folder", cloudinaryFolder + (video ? "/exercise-demos" : "/exercise-anatomy"),
                "public_id", UUID.randomUUID().toString(),
                "resource_type", video ? "video" : "image",
                "overwrite", false
        );
        // Videos go up in chunks so files above Cloudinary's single-request limit still work.
        Map<?, ?> result = video
                ? cloudinary.uploader().uploadLarge(file.toFile(), options)
                : cloudinary.uploader().upload(file.toFile(), options);
        Object url = result.get("secure_url");
        if (url == null) throw new IOException("Cloudinary did not return a URL");
        return url.toString();
    }

    /** Resource type and public id of a file on this app's Cloudinary account. */
    private record CloudinaryAsset(String resourceType, String publicId) {}

    private Optional<CloudinaryAsset> cloudinaryAsset(String mediaUrl) {
        if (mediaUrl == null || !cloudinaryEnabled() || !mediaUrl.startsWith("http")) return Optional.empty();
        String marker = "://res.cloudinary.com/" + cloudName + "/";
        int start = mediaUrl.indexOf(marker);
        if (start < 0) return Optional.empty();
        // {resource_type}/upload/v{version}/{public_id}.{extension}
        String[] parts = mediaUrl.substring(start + marker.length()).split("/", 3);
        if (parts.length < 3 || !"upload".equals(parts[1])) return Optional.empty();
        String publicId = parts[2].replaceFirst("^v\\d+/", "");
        int dot = publicId.lastIndexOf('.');
        if (dot > publicId.lastIndexOf('/')) publicId = publicId.substring(0, dot);
        return publicId.isEmpty() ? Optional.empty() : Optional.of(new CloudinaryAsset(parts[0], publicId));
    }

    /** "{resource_type}/{public_id}" of a URL on this app's Cloudinary account; empty for any other URL. */
    public Optional<String> cloudinaryKey(String mediaUrl) {
        return cloudinaryAsset(mediaUrl).map(asset -> asset.resourceType() + "/" + asset.publicId());
    }

    /** A file found in the app's Cloudinary folders by {@link #listCloudinaryFiles()}. */
    public record CloudFile(String key, String url, long sizeBytes, String format, String category, LocalDateTime uploadedAt) {}

    /**
     * Every file in the app's Cloudinary folders, by key (see {@link #cloudinaryKey}). Empty when
     * Cloudinary is off or the listing failed, so callers never mistake an outage for missing files.
     */
    public Optional<Map<String, CloudFile>> listCloudinaryFiles() {
        if (!cloudinaryEnabled()) return Optional.empty();
        Map<String, CloudFile> files = new HashMap<>();
        try {
            collectCloudinaryFiles("video", cloudinaryFolder + "/exercise-demos/", MediaFile.DEMO_VIDEO, files);
            collectCloudinaryFiles("image", cloudinaryFolder + "/exercise-anatomy/", MediaFile.ANATOMY_IMAGE, files);
            return Optional.of(files);
        } catch (Exception exception) {
            logger.warn("Could not list Cloudinary files", exception);
            return Optional.empty();
        }
    }

    private void collectCloudinaryFiles(String resourceType, String prefix, String category,
                                        Map<String, CloudFile> files) throws Exception {
        String cursor = null;
        do {
            Map<String, Object> options = new HashMap<>(Map.of(
                    "type", "upload", "resource_type", resourceType, "prefix", prefix, "max_results", 500));
            if (cursor != null) options.put("next_cursor", cursor);
            Map<?, ?> page = cloudinary.api().resources(options);
            if (page.get("resources") instanceof List<?> resources) {
                for (Object resource : resources) {
                    if (!(resource instanceof Map<?, ?> item) || item.get("public_id") == null || item.get("secure_url") == null) continue;
                    String key = resourceType + "/" + item.get("public_id");
                    long bytes = item.get("bytes") instanceof Number number ? number.longValue() : 0;
                    String format = item.get("format") == null ? "" : item.get("format").toString();
                    files.put(key, new CloudFile(key, item.get("secure_url").toString(), bytes, format, category,
                            parseCloudinaryTime(item.get("created_at"))));
                }
            }
            Object next = page.get("next_cursor");
            cursor = next == null ? null : next.toString();
        } while (cursor != null);
    }

    private static LocalDateTime parseCloudinaryTime(Object value) {
        try {
            return LocalDateTime.ofInstant(java.time.Instant.parse(value.toString()), ZoneId.systemDefault());
        } catch (RuntimeException exception) {
            return LocalDateTime.now();
        }
    }

    /** True when the file behind the URL is still kept (Cloudinary files are trusted to the registry). */
    private boolean isStored(String mediaUrl) {
        return cloudinaryAsset(mediaUrl).isPresent() || resolve(mediaUrl).filter(Files::exists).isPresent();
    }

    private static String copyAndHash(InputStream in, Path destination) throws IOException {
        MessageDigest digest = sha256();
        try (DigestInputStream digestIn = new DigestInputStream(in, digest)) {
            Files.copy(digestIn, destination, StandardCopyOption.REPLACE_EXISTING);
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    public String hash(Path file) throws IOException {
        MessageDigest digest = sha256();
        try (InputStream in = new DigestInputStream(Files.newInputStream(file), digest)) {
            in.transferTo(java.io.OutputStream.nullOutputStream());
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    private static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    /** Disk path of a media URL served by this app; empty for foreign URLs or path traversal. */
    public Optional<Path> resolve(String mediaUrl) {
        if (mediaUrl == null) return Optional.empty();
        for (String category : List.of(MediaFile.DEMO_VIDEO, MediaFile.ANATOMY_IMAGE)) {
            String prefix = prefixFor(category);
            if (mediaUrl.startsWith(prefix)) {
                Path directory = directoryFor(category);
                Path file = directory.resolve(mediaUrl.substring(prefix.length())).normalize();
                return file.startsWith(directory) && !file.equals(directory) ? Optional.of(file) : Optional.empty();
            }
        }
        return Optional.empty();
    }

    /** Removes the file from Cloudinary or disk. True when it is gone (also when it was already missing). */
    public boolean deleteFile(String mediaUrl) {
        Optional<CloudinaryAsset> asset = cloudinaryAsset(mediaUrl);
        if (asset.isPresent()) {
            try {
                Map<?, ?> result = cloudinary.uploader().destroy(asset.get().publicId(),
                        ObjectUtils.asMap("resource_type", asset.get().resourceType(), "invalidate", true));
                Object outcome = result.get("result");
                return "ok".equals(outcome) || "not found".equals(outcome);
            } catch (Exception exception) {
                logger.warn("Could not remove Cloudinary file {}", mediaUrl, exception);
                return false;
            }
        }
        Optional<Path> file = resolve(mediaUrl);
        if (file.isEmpty()) return true;
        try {
            Files.deleteIfExists(file.get());
            return true;
        } catch (IOException exception) {
            logger.warn("Could not remove media file {}", file.get(), exception);
            return false;
        }
    }

    /** Every video and anatomy image currently on disk (the incoming folder is skipped). */
    public List<StoredFile> listStoredFiles() {
        List<StoredFile> result = new ArrayList<>();
        for (String category : List.of(MediaFile.DEMO_VIDEO, MediaFile.ANATOMY_IMAGE)) {
            Path directory = directoryFor(category);
            if (!Files.isDirectory(directory)) continue;
            try (Stream<Path> files = Files.list(directory)) {
                files.filter(Files::isRegularFile)
                        .forEach(path -> result.add(new StoredFile(prefixFor(category) + path.getFileName(), path, category)));
            } catch (IOException exception) {
                logger.warn("Could not list media directory {}", directory, exception);
            }
        }
        return result;
    }

    public static LocalDateTime lastModified(Path file) {
        try {
            return LocalDateTime.ofInstant(Files.getLastModifiedTime(file).toInstant(), ZoneId.systemDefault());
        } catch (IOException exception) {
            return LocalDateTime.now();
        }
    }

    private Path directoryFor(String category) {
        return MediaFile.ANATOMY_IMAGE.equals(category) ? anatomyImageDirectory : storageDirectory;
    }

    private static String prefixFor(String category) {
        return MediaFile.ANATOMY_IMAGE.equals(category) ? ANATOMY_PREFIX : VIDEO_PREFIX;
    }

    private static String getExtension(String originalName) {
        int extensionIndex = originalName == null ? -1 : originalName.lastIndexOf('.');
        return extensionIndex < 0 ? "" : originalName.substring(extensionIndex + 1).toLowerCase(Locale.ROOT);
    }

    private static void deleteQuietly(Path file) {
        try {
            Files.deleteIfExists(file);
        } catch (IOException exception) {
            logger.warn("Could not remove temporary upload {}", file, exception);
        }
    }

    public Path getStorageDirectory() {
        return storageDirectory;
    }

    public Path getAnatomyImageDirectory() {
        return anatomyImageDirectory;
    }
}
