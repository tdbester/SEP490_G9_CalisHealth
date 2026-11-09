package com.calishealth.service;

import com.calishealth.models.MediaFile;
import com.calishealth.models.StorageSettings;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
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
    private final CloudinaryFolderService folders;
    private final CloudinaryOptimizationService optimization;

    /** A file found on disk by {@link #listStoredFiles()}. */
    public record StoredFile(String url, Path path, String category) {}

    public ExerciseVideoStorageService(
            @Value("${app.storage.exercise-video-dir:${user.home}/calishealth/uploads/exercise-videos}") String storageDirectory,
            @Value("${app.storage.exercise-anatomy-dir:${user.home}/calishealth/uploads/exercise-anatomy}") String anatomyImageDirectory,
            @Value("${app.cloudinary.cloud-name:}") String cloudName,
            MediaRegistryService registry,
            CloudinaryFolderService folders,
            CloudinaryOptimizationService optimization,
            Cloudinary cloudinary
    ) {
        this.storageDirectory = Path.of(storageDirectory).toAbsolutePath().normalize();
        this.anatomyImageDirectory = Path.of(anatomyImageDirectory).toAbsolutePath().normalize();
        this.registry = registry;
        this.cloudinary = cloudinary;
        this.cloudName = cloudName == null ? "" : cloudName.trim();
        this.folders = folders;
        this.optimization = optimization;
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
            CloudUpload upload;
            String source = uploader != null && uploader.getRole() == UserRole.MEMBER
                    ? MediaFile.SOURCE_MEMBER : MediaFile.SOURCE_SYSTEM;
            try {
                upload = uploadFile(temp, category, source);
            } catch (IOException | RuntimeException exception) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not upload the file to cloud storage", exception);
            } finally {
                deleteQuietly(temp);
            }
            String url = upload.url();
            try {
                checkVideoDuration(url, upload.durationSeconds(), category);
                // The size of the file that is really stored, not the size of the upload: the
                // transformation shrinks it, and the registry has to count what the account pays for.
                long storedBytes = upload.bytes() == null ? file.getSize() : upload.bytes();
                // The codec rule can change the format (a MOV ends up as a MP4), so the registry
                // gets the format of the file that is really on the CDN.
                String storedFormat = upload.format() == null ? extension : upload.format();
                registry.register(url, file.getOriginalFilename(), storedBytes, category, storedFormat, hash, uploader,
                        LocalDateTime.now(), upload.durationSeconds());
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

    /** The uploaded file: its URL and, for videos, how long it is. */
    private record CloudUpload(String url, Integer durationSeconds, Long bytes, String format) {}

    /**
     * Uploads the file and reads its length from the answer of Cloudinary. The length is what the
     * admin limit ({@code demo_max_seconds}) is checked against, so the server decides and not only
     * the browser.
     *
     * <p>The file is shrunk before it is stored: Cloudinary applies the transformation of
     * {@link CloudinaryOptimizationService} and keeps the small version, so the account does not
     * pay for the big one. The URL stays the plain one, because the transformation is stored with
     * the asset and the CDN serves the small file already.
     */
    private CloudUpload uploadFile(Path file, String category, String source) throws IOException {
        boolean video = !MediaFile.ANATOMY_IMAGE.equals(category);
        Map<String, Object> options = new HashMap<>(ObjectUtils.asMap(
                "folder", folders.forCategory(category, source),
                "public_id", UUID.randomUUID().toString(),
                "resource_type", video ? "video" : "image",
                "overwrite", false));
        String transformation = optimization.transformationFor(video);
        if (!transformation.isBlank()) options.put("transformation", transformation);
        String format = optimization.formatFor(video);
        if (!format.isBlank()) options.put("format", format);
        // Videos go up in chunks so files above Cloudinary's single-request limit still work.
        Map<?, ?> result = video
                ? cloudinary.uploader().uploadLarge(file.toFile(), options)
                : cloudinary.uploader().upload(file.toFile(), options);
        Object url = result.get("secure_url");
        if (url == null) throw new IOException("Cloudinary did not return a URL");
        Object bytes = result.get("bytes");
        Object storedFormat = result.get("format");
        return new CloudUpload(url.toString(), durationOf(result),
                bytes instanceof Number number ? number.longValue() : null,
                storedFormat == null ? null : storedFormat.toString());
    }

    /** The length of an uploaded video in whole seconds; null when Cloudinary did not report it. */
    private static Integer durationOf(Map<?, ?> result) {
        Object duration = result.get("duration");
        if (duration instanceof Number number) return number.intValue();
        return null;
    }

    /**
     * Rejects a video that is longer than the admin allows and removes it from Cloudinary again, so
     * a rejected upload does not cost storage.
     */
    private void checkVideoDuration(String url, Integer durationSeconds, String category) {
        if (durationSeconds == null) return;
        int maxSeconds = registry.settings().getDemoMaxSeconds();
        if (durationSeconds <= maxSeconds) return;
        deleteFile(url);
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Video is too long: it is " + durationSeconds + " seconds, the limit is " + maxSeconds + " seconds");
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

    /**
     * Moves a file of this app to another folder of the Cloudinary account.
     *
     * <p>Cloudinary renames the public id when a file moves, so the URL changes. The caller gets the
     * new URL and has to save it, otherwise the exercise keeps a dead link.
     *
     * @param mediaUrl the current URL of the file
     * @param targetFolder the folder to move it to, e.g. the trash folder
     * @return the new URL, or empty when the file is not on Cloudinary or the move failed
     */
    public Optional<String> moveToFolder(String mediaUrl, String targetFolder) {
        Optional<CloudinaryAsset> asset = cloudinaryAsset(mediaUrl);
        if (asset.isEmpty() || targetFolder == null || targetFolder.isBlank()) return Optional.empty();
        try {
            Map<?, ?> result = cloudinary.uploader().rename(
                    asset.get().publicId(),
                    targetFolder + "/" + UUID.randomUUID(),
                    ObjectUtils.asMap("resource_type", asset.get().resourceType(), "overwrite", false));
            Object url = result.get("secure_url");
            if (url == null) return Optional.empty();
            return Optional.of(url.toString());
        } catch (Exception exception) {
            logger.warn("Could not move Cloudinary file {} to {}", mediaUrl, targetFolder, exception);
            return Optional.empty();
        }
    }

    /**
     * Moves a file that sits in the trash folder back to the folder it came from. The trash folder
     * keeps the name of the original folder, so the way back is known.
     *
     * @return the new URL, or empty when the file is not on Cloudinary or the move failed
     */
    public Optional<String> restoreFromTrash(String mediaUrl) {
        Optional<String> currentFolder = folderOf(mediaUrl);
        if (currentFolder.isEmpty()) return Optional.empty();
        String folder = currentFolder.get();
        String trashPrefix = folders.trash() + "/";
        if (!folder.startsWith(trashPrefix)) return Optional.of(mediaUrl);
        String original = folders.of(folder.substring(trashPrefix.length()));
        return moveToFolder(mediaUrl, original);
    }

    /**
     * The trash folder for a file that sits in the given folder. The name of the original folder is
     * kept inside the trash folder, so the admin still sees what the file was and the file can go
     * back to where it came from.
     *
     * @param currentFolder the folder the file is in now, e.g. "calishealth/exercise-demos"
     */
    public String trashFolderFor(String currentFolder) {
        String prefix = folders.root() + "/";
        String sub = currentFolder != null && currentFolder.startsWith(prefix)
                ? currentFolder.substring(prefix.length())
                : currentFolder;
        if (sub == null || sub.isBlank()) return folders.trash();
        return folders.of("trash/" + sub);
    }

    /**
     * The trash folder for a file of the given category, when the current folder is not known.
     *
     * @param category DEMO_VIDEO | ANATOMY_IMAGE | PROFILE_AVATAR
     */
    public String trashFolderForCategory(String category) {
        String original = folders.forCategory(category);
        String prefix = folders.root() + "/";
        String sub = original.startsWith(prefix) ? original.substring(prefix.length()) : original;
        return folders.of("trash/" + sub);
    }

    /**
     * The folder a file of this app currently lives in; empty when the file is not on Cloudinary or
     * sits in a folder the app does not manage.
     */
    public Optional<String> folderOf(String mediaUrl) {
        Optional<CloudinaryAsset> asset = cloudinaryAsset(mediaUrl);
        if (asset.isEmpty()) return Optional.empty();
        return folderOfPublicId(asset.get().publicId());
    }

    /** The folder of a file of this app, given its URL and the category it was registered with. */
    public String folderFor(String mediaUrl, String category) {
        return folderOf(mediaUrl).orElseGet(() -> folders.forCategory(category));
    }

    /** A file found in the app's Cloudinary folders by {@link #listCloudinaryFiles()}. */
    public record CloudFile(String key, String url, long sizeBytes, String format, String category,
                            LocalDateTime uploadedAt, Integer durationSeconds) {}

    /**
     * Every file in the app's Cloudinary folders, by key (see {@link #cloudinaryKey}). Empty when
     * Cloudinary is off or the listing failed, so callers never mistake an outage for missing files.
     *
     * <p>The whole tree below the app's root folder is scanned, so a file that was moved to the trash
     * folder is still found and is not mistaken for a deleted file.
     */
    public Optional<Map<String, CloudFile>> listCloudinaryFiles() {
        if (!cloudinaryEnabled()) return Optional.empty();
        Map<String, CloudFile> files = new HashMap<>();
        try {
            collectCloudinaryFiles("video", folders.root() + "/", files);
            collectCloudinaryFiles("image", folders.root() + "/", files);
            return Optional.of(files);
        } catch (Exception exception) {
            logger.warn("Could not list Cloudinary files", exception);
            return Optional.empty();
        }
    }

    private void collectCloudinaryFiles(String resourceType, String prefix,
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
                    String publicId = item.get("public_id").toString();
                    String key = resourceType + "/" + publicId;
                    long bytes = item.get("bytes") instanceof Number number ? number.longValue() : 0;
                    String format = item.get("format") == null ? "" : item.get("format").toString();
                    Integer duration = item.get("duration") instanceof Number seconds ? seconds.intValue() : null;
                    files.put(key, new CloudFile(key, item.get("secure_url").toString(), bytes, format,
                            categoryOfFolder(publicId), parseCloudinaryTime(item.get("created_at")), duration));
                }
            }
            Object next = page.get("next_cursor");
            cursor = next == null ? null : next.toString();
        } while (cursor != null);
    }

    /**
     * The category a file belongs to, read from the folder it sits in. A file in the trash folder
     * keeps the category of the media it came from, because the trash folder holds a copy of the
     * original folder name.
     */
    private String categoryOfFolder(String publicId) {
        String folder = folderOfPublicId(publicId).orElse("");
        if (folder.isBlank()) return MediaFile.DEMO_VIDEO;
        // The trash folder mirrors the folder the file came from: "calishealth/trash/exercise-demos".
        String sub = folder.startsWith(folders.root() + "/")
                ? folder.substring(folders.root().length() + 1)
                : folder;
        if (sub.startsWith("trash/")) sub = sub.substring("trash/".length());
        // The member folder has its own sub folders, so look at the last part of the path.
        if (sub.endsWith("exercise-anatomy")) return MediaFile.ANATOMY_IMAGE;
        if (sub.endsWith("profile-avatars")) return MediaFile.PROFILE_AVATAR;
        return MediaFile.DEMO_VIDEO;
    }

    /** The folder of a public id: everything before the last slash. */
    private Optional<String> folderOfPublicId(String publicId) {
        if (publicId == null) return Optional.empty();
        int slash = publicId.lastIndexOf('/');
        if (slash <= 0) return Optional.empty();
        return Optional.of(publicId.substring(0, slash));
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
        if (file.isEmpty()) return true;        try {
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
