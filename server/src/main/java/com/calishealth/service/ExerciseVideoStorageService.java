package com.calishealth.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class ExerciseVideoStorageService {
    private static final long MAX_FILE_SIZE = 50L * 1024 * 1024;
    private static final Set<String> ALLOWED_TYPES = Set.of("mp4", "mov", "webm");
    private static final long MAX_IMAGE_SIZE = 10L * 1024 * 1024;
    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of("jpg", "jpeg", "png", "webp");

    private final Path storageDirectory;
    private final Path anatomyImageDirectory;

    public ExerciseVideoStorageService(
            @Value("${app.storage.exercise-video-dir:${user.home}/calishealth/uploads/exercise-videos}") String storageDirectory,
            @Value("${app.storage.exercise-anatomy-dir:${user.home}/calishealth/uploads/exercise-anatomy}") String anatomyImageDirectory
    ) {
        this.storageDirectory = Path.of(storageDirectory).toAbsolutePath().normalize();
        this.anatomyImageDirectory = Path.of(anatomyImageDirectory).toAbsolutePath().normalize();
    }

    public String store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a video file to upload");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Video must be 50 MB or smaller");
        }

        String originalName = file.getOriginalFilename();
        int extensionIndex = originalName == null ? -1 : originalName.lastIndexOf('.');
        if (extensionIndex < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Video must be an MP4, MOV, or WebM file");
        }

        String extension = originalName.substring(extensionIndex + 1).toLowerCase(Locale.ROOT);
        if (!ALLOWED_TYPES.contains(extension)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Video must be an MP4, MOV, or WebM file");
        }

        String contentType = file.getContentType();
        if (contentType != null && !contentType.isBlank()
                && !contentType.toLowerCase(Locale.ROOT).startsWith("video/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Uploaded file must be a video");
        }

        String fileName = UUID.randomUUID() + "." + extension;
        Path destination = storageDirectory.resolve(fileName).normalize();
        if (!destination.startsWith(storageDirectory)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid video filename");
        }

        try {
            Files.createDirectories(storageDirectory);
            Files.copy(file.getInputStream(), destination, StandardCopyOption.REPLACE_EXISTING);
            return "/media/exercise-demos/" + fileName;
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not save the video file", exception);
        }
    }

    public String storeAnatomyImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose an anatomy image to upload");
        }
        if (file.getSize() > MAX_IMAGE_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Anatomy image must be 10 MB or smaller");
        }

        String extension = getExtension(file.getOriginalFilename());
        if (!ALLOWED_IMAGE_TYPES.contains(extension)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image must be JPG, PNG, or WebP");
        }
        String contentType = file.getContentType();
        if (contentType != null && !contentType.isBlank() && !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Uploaded file must be an image");
        }
        String fileName = UUID.randomUUID() + "." + extension;
        save(file, anatomyImageDirectory.resolve(fileName), anatomyImageDirectory);
        return "/media/exercise-anatomy/" + fileName;
    }

    private String getExtension(String originalName) {
        int extensionIndex = originalName == null ? -1 : originalName.lastIndexOf('.');
        return extensionIndex < 0 ? "" : originalName.substring(extensionIndex + 1).toLowerCase(Locale.ROOT);
    }

    private void save(MultipartFile file, Path destination, Path directory) {
        Path normalizedDestination = destination.normalize();
        if (!normalizedDestination.startsWith(directory)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid upload filename");
        }
        try {
            Files.createDirectories(directory);
            Files.copy(file.getInputStream(), normalizedDestination, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not save uploaded file", exception);
        }
    }

    public void deleteAnatomyImage(String imageUrl) {
        deleteFrom(imageUrl, "/media/exercise-anatomy/", anatomyImageDirectory);
    }

    public void delete(String videoUrl) {
        deleteFrom(videoUrl, "/media/exercise-demos/", storageDirectory);
    }

    private void deleteFrom(String mediaUrl, String mediaPrefix, Path directory) {
        if (mediaUrl == null || !mediaUrl.startsWith(mediaPrefix)) {
            return;
        }
        Path file = directory.resolve(mediaUrl.substring(mediaPrefix.length())).normalize();
        if (!file.startsWith(directory)) {
            return;
        }
        try {
            Files.deleteIfExists(file);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not remove an unused exercise video", exception);
        }
    }

    public Path getStorageDirectory() {
        return storageDirectory;
    }

    public Path getAnatomyImageDirectory() {
        return anatomyImageDirectory;
    }
}
