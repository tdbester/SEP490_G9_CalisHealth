package com.calishealth.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Stores the profile photo of an account. The photo goes to Cloudinary in the app's avatar folder
 * (or to the server disk when Cloudinary is not configured) and is served from
 * {@code /media/profile-avatars/**} in the local case.
 *
 * <p>Same rules as the exercise images: a size cap, an extension allow list and a file name that
 * may never escape the storage directory.
 */
@Service
public class ProfileAvatarStorageService {
    private static final Logger logger = LoggerFactory.getLogger(ProfileAvatarStorageService.class);
    private static final long MAX_FILE_SIZE = 5L * 1024 * 1024;
    private static final Set<String> ALLOWED_TYPES = Set.of("jpg", "jpeg", "png", "webp");
    private static final Map<String, String> EXTENSIONS_BY_CONTENT_TYPE = Map.of(
            "image/jpeg", "jpg",
            "image/png", "png",
            "image/webp", "webp");
    public static final String URL_PREFIX = "/media/profile-avatars/";

    private final Path storageDirectory;
    private final Cloudinary cloudinary;
    private final String cloudName;
    private final CloudinaryFolderService folders;

    public ProfileAvatarStorageService(
            @Value("${app.storage.profile-avatar-dir:${user.home}/calishealth/uploads/profile-avatars}") String storageDirectory,
            @Value("${app.cloudinary.cloud-name:}") String cloudName,
            CloudinaryFolderService folders,
            Cloudinary cloudinary) {
        this.storageDirectory = Path.of(storageDirectory).toAbsolutePath().normalize();
        this.cloudName = cloudName == null ? "" : cloudName.trim();
        this.folders = folders;
        this.cloudinary = cloudinary;
    }

    public Path getStorageDirectory() {
        return storageDirectory;
    }

    /** The size of a stored photo in bytes; 0 when the file is gone or the URL is not ours. */
    public long sizeOf(String avatarUrl) {
        Optional<Path> file = resolve(avatarUrl);
        if (file.isPresent()) {
            try {
                return Files.size(file.get());
            } catch (IOException exception) {
                logger.warn("Could not read the size of profile photo {}", file, exception);
                return 0;
            }
        }
        // A photo on Cloudinary: ask the account how big it is, so the registry counts it.
        if (cloudinaryEnabled() && avatarUrl != null && avatarUrl.contains("/upload/")) {
            return cloudSizeOf(avatarUrl);
        }
        return 0;
    }

    /** The size of a file on Cloudinary in bytes; 0 when it cannot be read. */
    private long cloudSizeOf(String url) {
        String publicId = publicIdOf(url);
        if (publicId.isEmpty()) return 0;
        try {
            Map<?, ?> result = cloudinary.api().resource(publicId, ObjectUtils.asMap("resource_type", "image"));
            Object bytes = result.get("bytes");
            if (bytes instanceof Number number) return number.longValue();
        } catch (Exception exception) {
            logger.warn("Could not read the size of cloud photo {}", url, exception);
        }
        return 0;
    }

    /** The disk path of a stored photo; empty for a foreign URL or a path traversal. */
    public Optional<Path> resolve(String avatarUrl) {
        if (avatarUrl == null || !avatarUrl.startsWith(URL_PREFIX)) return Optional.empty();
        Path file = storageDirectory.resolve(avatarUrl.substring(URL_PREFIX.length())).normalize();
        return file.startsWith(storageDirectory) ? Optional.of(file) : Optional.empty();
    }

    /** Saves the image and returns the public URL to store on the account. */
    public String store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose an image to upload");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Photo must be 5 MB or smaller");
        }

        String contentType = file.getContentType();
        String extension = extension(file.getOriginalFilename());
        if (extension.isBlank() && contentType != null) {
            extension = EXTENSIONS_BY_CONTENT_TYPE.getOrDefault(contentType.toLowerCase(Locale.ROOT), "");
        }
        if (!ALLOWED_TYPES.contains(extension)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Photo must be a JPG, PNG, or WebP image");
        }
        if (contentType != null && !contentType.isBlank()
                && !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The uploaded file must be an image");
        }

        if (cloudinaryEnabled()) {
            try {
                return uploadToCloudinary(file, extension);
            } catch (IOException | RuntimeException exception) {
                logger.warn("Could not upload the profile photo to cloud storage", exception);
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "Could not upload the photo to cloud storage", exception);
            }
        }

        String fileName = UUID.randomUUID() + "." + extension;
        Path destination = storageDirectory.resolve(fileName).normalize();
        if (!destination.startsWith(storageDirectory)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid photo filename");
        }
        try {
            Files.createDirectories(storageDirectory);
            Files.copy(file.getInputStream(), destination, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not save the photo", exception);
        }
        return URL_PREFIX + fileName;
    }

    /** Uploads the photo into the app's avatar folder and returns its HTTPS URL. */
    private String uploadToCloudinary(MultipartFile file, String extension) throws IOException {
        Map<?, ?> options = ObjectUtils.asMap(
                "folder", folders.profileAvatars(),
                "public_id", UUID.randomUUID().toString(),
                "filename", "avatar." + extension,
                "resource_type", "image",
                "overwrite", false);
        Map<?, ?> result = cloudinary.uploader().upload(file.getBytes(), options);
        Object url = result.get("secure_url");
        if (url == null) throw new IOException("Cloudinary did not return a URL");
        return url.toString();
    }

    /** Removes a previously stored photo. Anything outside our own prefix is ignored. */
    public void delete(String avatarUrl) {
        if (avatarUrl == null) return;
        if (avatarUrl.startsWith(URL_PREFIX)) {
            Path file = storageDirectory.resolve(avatarUrl.substring(URL_PREFIX.length())).normalize();
            if (!file.startsWith(storageDirectory)) return;
            try {
                Files.deleteIfExists(file);
            } catch (IOException exception) {
                logger.warn("Could not remove unused profile photo {}", file, exception);
            }
            return;
        }
        // A photo on Cloudinary is removed through the media storage, which knows how to find it.
        if (cloudinaryEnabled() && avatarUrl.contains("/upload/")) {
            try {
                cloudinary.uploader().destroy(publicIdOf(avatarUrl), ObjectUtils.asMap("resource_type", "image", "invalidate", true));
            } catch (Exception exception) {
                logger.warn("Could not remove profile photo {} from cloud storage", avatarUrl, exception);
            }
        }
    }

    /** The public id of a Cloudinary URL, e.g. "calishealth/profile-avatars/abc". */
    private String publicIdOf(String url) {
        String marker = "://res.cloudinary.com/" + cloudName + "/";
        int start = url.indexOf(marker);
        if (start < 0) return "";
        String[] parts = url.substring(start + marker.length()).split("/", 3);
        if (parts.length < 3 || !"upload".equals(parts[1])) return "";
        String publicId = parts[2].replaceFirst("^v\\d+/", "");
        int dot = publicId.lastIndexOf('.');
        if (dot > publicId.lastIndexOf('/')) publicId = publicId.substring(0, dot);
        return publicId;
    }

    private boolean cloudinaryEnabled() {
        return !cloudName.isEmpty();
    }

    private static String extension(String originalName) {
        int dot = originalName == null ? -1 : originalName.lastIndexOf('.');
        return dot < 0 ? "" : originalName.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}
