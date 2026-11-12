package com.calishealth.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Reads and creates the folders of the Cloudinary account that this app writes into.
 *
 * <p>Cloudinary creates a folder on its own the first time a file is uploaded into it, so this
 * service is only a convenience: it lets the admin see the whole structure in the Media Library
 * before any file exists, and it repairs a folder that was deleted by hand.
 *
 * <p>The free plan of Cloudinary allows only a few hundred Admin API calls per hour, and the
 * Storage screen asks for these numbers on every visit. The answer is therefore cached for a few
 * minutes, and the whole tree is read with as few calls as possible.
 */
@Service
public class CloudinarySetupService {
    private static final Logger logger = LoggerFactory.getLogger(CloudinarySetupService.class);
    /** The Admin API is rate-limited, so the folders are reused for a short while. */
    private static final Duration CACHE_TTL = Duration.ofMinutes(10);

    private final Cloudinary cloudinary;
    private final String cloudName;
    private final CloudinaryFolderService folders;

    /** What is known about the folders of the account. */
    private record Snapshot(Set<String> paths, Map<String, Integer> fileCounts,
                            Map<String, Long> folderBytes, LocalDateTime readAt, boolean readOk) {}

    private volatile Snapshot cached;

    public CloudinarySetupService(
            @Value("${app.cloudinary.cloud-name:}") String cloudName,
            CloudinaryFolderService folders,
            Cloudinary cloudinary) {
        this.cloudName = cloudName == null ? "" : cloudName.trim();
        this.folders = folders;
        this.cloudinary = cloudinary;
    }

    /** The name of a folder in the Cloudinary console, used as the key of the report. */
    public record FolderStatus(String path, boolean exists, int files, long bytes) {}

    /** The result of the setup: which folder was created and which one already existed. */
    public record SetupResult(List<FolderStatus> folders, List<String> created, List<String> existing,
                              List<String> failed) {}

    /**
     * Creates every folder the app needs. A folder that already exists is left alone.
     *
     * @return what happened to each folder
     */
    public SetupResult setupFolders() {
        List<FolderStatus> statuses = new ArrayList<>();
        List<String> created = new ArrayList<>();
        List<String> existing = new ArrayList<>();
        List<String> failed = new ArrayList<>();
        Snapshot snapshot = readFolders();
        for (String path : targetFolders()) {
            if (!snapshot.readOk() || snapshot.paths().contains(path)) {
                existing.add(path);
                statuses.add(new FolderStatus(path, true,
                        snapshot.fileCounts().getOrDefault(path, 0),
                        snapshot.folderBytes().getOrDefault(path, 0L)));
                continue;
            }
            try {
                createFolder(path);
                created.add(path);
                statuses.add(new FolderStatus(path, true, 0, 0));
            } catch (Exception exception) {
                logger.warn("Could not create Cloudinary folder {}", path, exception);
                failed.add(path);
                statuses.add(new FolderStatus(path, false, 0, 0));
            }
        }
        // The tree changed, so the next read has to see the new folders.
        cached = null;
        return new SetupResult(statuses, created, existing, failed);
    }

    /** The folders the app writes into, in the order they should appear in the console. */
    public List<String> targetFolders() {
        return new ArrayList<>(folderLabels().keySet());
    }

    /**
     * The folders the app writes into, with a short label that says what each one holds. The label
     * is a key for the client to translate.
     */
    public Map<String, String> folderLabels() {
        Map<String, String> labels = new LinkedHashMap<>();
        labels.put(folders.exerciseDemos(), "systemDemo");
        labels.put(folders.exerciseAnatomy(), "systemAnatomy");
        labels.put(folders.profileAvatars(), "avatars");
        labels.put(folders.of("member-exercises/exercise-demos"), "memberDemo");
        labels.put(folders.of("member-exercises/exercise-anatomy"), "memberAnatomy");
        labels.put(folders.trash(), "trash");
        return labels;
    }

    /** True when the folder exists in the account. */
    public boolean folderExists(String path) {
        if (path == null || path.isBlank()) return false;
        return readFolders().paths().contains(path);
    }

    /** The number of files in a folder, on every resource type. */
    public int fileCount(String path) {
        return readFolders().fileCounts().getOrDefault(path, 0);
    }

    /** The size of a folder in bytes, on every resource type. */
    public long folderBytes(String path) {
        return readFolders().folderBytes().getOrDefault(path, 0L);
    }

    /**
     * Reads the folders of the account and the files in them, with as few Admin API calls as
     * possible: the whole tree of folders in one call per level, and the files of every folder in
     * one call per resource type.
     */
    private Snapshot readFolders() {
        Snapshot local = cached;
        if (local != null && local.readAt() != null && local.readAt().plus(CACHE_TTL).isAfter(LocalDateTime.now())) {
            return local;
        }
        Set<String> paths = new LinkedHashSet<>();
        try {
            collectFolderPaths(folders.root(), paths);
        } catch (Exception exception) {
            logger.warn("Could not read the Cloudinary folders: {}", exception.getMessage());
            // The free plan allows only a few hundred Admin API calls per hour. When the limit is
            // reached the numbers of the last read are shown instead of empty ones.
            return local == null ? emptySnapshot() : local;
        }
        Map<String, Integer> counts = new HashMap<>();
        Map<String, Long> bytes = new HashMap<>();
        for (String resourceType : List.of("image", "video")) {
            try {
                collectFiles(resourceType, paths, counts, bytes);
            } catch (Exception exception) {
                logger.warn("Could not read the Cloudinary files of type {}: {}", resourceType, exception.getMessage());
            }
        }
        Snapshot fresh = new Snapshot(paths, counts, bytes, LocalDateTime.now(), true);
        cached = fresh;
        return fresh;
    }

    private static Snapshot emptySnapshot() {
        return new Snapshot(new LinkedHashSet<>(), Map.of(), Map.of(), null, false);
    }

    /** Walks the folder tree of the account and collects the full path of every folder. */
    private void collectFolderPaths(String parent, Set<String> paths) throws Exception {
        Map<String, Object> options = new HashMap<>(Map.of("max_results", 500));
        Map<?, ?> result = cloudinary.api().subFolders(parent, options);
        if (!(result.get("folders") instanceof List<?> list)) return;
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> folder)) continue;
            String path = folder.get("path") == null ? "" : folder.get("path").toString();
            if (path.isBlank()) continue;
            paths.add(path);
            // A sub folder of the app's own folders belongs to the tree as well.
            if (path.startsWith(folders.root() + "/")) {
                collectFolderPaths(path, paths);
            }
        }
    }

    /** Counts the files of every folder of the tree, in one call per resource type. */
    private void collectFiles(String resourceType, Set<String> paths,
                              Map<String, Integer> counts, Map<String, Long> bytes) throws Exception {
        Map<String, Object> options = new HashMap<>(Map.of(
                "type", "upload", "resource_type", resourceType, "prefix", folders.root() + "/", "max_results", 500));
        Map<?, ?> result = cloudinary.api().resources(options);
        if (!(result.get("resources") instanceof List<?> resources)) return;
        for (Object item : resources) {
            if (!(item instanceof Map<?, ?> resource)) continue;
            String publicId = resource.get("public_id") == null ? "" : resource.get("public_id").toString();
            long size = resource.get("bytes") instanceof Number number ? number.longValue() : 0;
            // The file belongs to the folder it sits in, and to every folder above it.
            for (String folder : foldersOf(publicId, paths)) {
                counts.merge(folder, 1, Integer::sum);
                bytes.merge(folder, size, Long::sum);
            }
        }
    }

    /** The folders of the tree a file belongs to: its own folder and every parent folder. */
    private List<String> foldersOf(String publicId, Set<String> paths) {
        List<String> result = new ArrayList<>();
        int slash = publicId.lastIndexOf('/');
        if (slash <= 0) return result;
        String folder = publicId.substring(0, slash);
        while (!folder.isBlank()) {
            if (paths.contains(folder)) result.add(folder);
            int parentSlash = folder.lastIndexOf('/');
            if (parentSlash <= 0) break;
            folder = folder.substring(0, parentSlash);
        }
        return result;
    }

    /** Creates a folder in the account. Cloudinary makes it when the first file is uploaded. */
    private void createFolder(String path) {
        try {
            // The path goes in the URL of the call, not in the body.
            cloudinary.api().createFolder(path, ObjectUtils.asMap());
        } catch (Exception exception) {
            logger.warn("Could not create Cloudinary folder {}", path, exception);
        }
    }

    /** True when the app has a Cloudinary account to work with. */
    public boolean enabled() {
        return !cloudName.isEmpty();
    }
}
