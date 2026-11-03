package com.calishealth.service;

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
import java.util.Set;
import java.util.UUID;

/**
 * Stores the profile photo of an account under {@code app.storage.profile-avatar-dir} and serves it
 * from {@code /media/profile-avatars/**}. Same rules as the exercise images: a size cap, an
 * extension allow list and a normalised path that may never escape the storage directory.
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

    public ProfileAvatarStorageService(
            @Value("${app.storage.profile-avatar-dir:${user.home}/calishealth/uploads/profile-avatars}") String storageDirectory) {
        this.storageDirectory = Path.of(storageDirectory).toAbsolutePath().normalize();
    }

    public Path getStorageDirectory() {
        return storageDirectory;
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

    /** Removes a previously stored photo. Anything outside our own prefix is ignored. */
    public void delete(String avatarUrl) {
        if (avatarUrl == null || !avatarUrl.startsWith(URL_PREFIX)) return;
        Path file = storageDirectory.resolve(avatarUrl.substring(URL_PREFIX.length())).normalize();
        if (!file.startsWith(storageDirectory)) return;
        try {
            Files.deleteIfExists(file);
        } catch (IOException exception) {
            logger.warn("Could not remove unused profile photo {}", file, exception);
        }
    }

    private static String extension(String originalName) {
        int dot = originalName == null ? -1 : originalName.lastIndexOf('.');
        return dot < 0 ? "" : originalName.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}
