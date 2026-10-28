package com.calishealth.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;
import com.calishealth.exception.RequestValidationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class ExerciseVideoStorageService {
    private static final Logger logger = LoggerFactory.getLogger(ExerciseVideoStorageService.class);
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
        validateVideoFile(file, true);
        String originalName = file.getOriginalFilename();
        int extensionIndex = originalName == null ? -1 : originalName.lastIndexOf('.');
        String extension = originalName.substring(extensionIndex + 1).toLowerCase(Locale.ROOT);

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

    public void validateVideoFile(MultipartFile file, boolean required) {
        if (file == null || file.isEmpty()) {
            if (required) {
                throw new RequestValidationException("videoFile", "Vui lòng chọn video bài tập");
            }
            return;
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new RequestValidationException("videoFile", "Video không được vượt quá 50 MB");
        }

        String originalName = file.getOriginalFilename();
        int extensionIndex = originalName == null ? -1 : originalName.lastIndexOf('.');
        String extension = extensionIndex < 0
                ? ""
                : originalName.substring(extensionIndex + 1).toLowerCase(Locale.ROOT);
        if (!ALLOWED_TYPES.contains(extension)) {
            throw new RequestValidationException("videoFile", "Video phải có định dạng MP4, MOV hoặc WebM");
        }

        String contentType = file.getContentType();
        if (contentType != null && !contentType.isBlank()
                && !contentType.toLowerCase(Locale.ROOT).startsWith("video/")) {
            throw new RequestValidationException("videoFile", "Tệp tải lên phải là video");
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
            logger.warn("Could not remove unused exercise media file {}", file, exception);
        }
    }

    public Path getStorageDirectory() {
        return storageDirectory;
    }

    public Path getAnatomyImageDirectory() {
        return anatomyImageDirectory;
    }
}
