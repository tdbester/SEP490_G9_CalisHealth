package com.calishealth.controllers;

import com.calishealth.dtos.AdminStorageDtos.*;
import com.calishealth.service.AdminStorageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Admin > Media storage & infrastructure. Protected by SecurityConfig: /api/admin/** requires ROLE_ADMIN. */
@RestController
@RequestMapping("/api/admin/storage")
@RequiredArgsConstructor
public class AdminStorageController {
    private final AdminStorageService service;

    @GetMapping("/overview")
    public Overview overview() {
        return service.overview();
    }

    @GetMapping("/media")
    public MediaPage media(
            @RequestParam(defaultValue = "inactive") String view,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String source,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return service.media(view, status, source, type, sort, page, size);
    }

    /** Soft delete: the files stay on disk until their purge date. */
    @PostMapping("/media/trash")
    public TrashResult trash(Authentication a, @Valid @RequestBody IdsRequest r) {
        return service.trash(a.getName(), r.ids());
    }

    @PostMapping("/media/restore")
    public RestoreResult restore(Authentication a, @Valid @RequestBody IdsRequest r) {
        return service.restore(a.getName(), r.ids());
    }

    @PostMapping("/media/{id}/extend")
    public MediaItem extend(Authentication a, @PathVariable Long id, @Valid @RequestBody ExtendRequest r) {
        return service.extend(a.getName(), id, r.days());
    }

    /** Hard delete of files that are already in the trash. */
    @DeleteMapping("/media")
    public DeleteResult delete(Authentication a, @Valid @RequestBody IdsRequest r) {
        return service.delete(a.getName(), r.ids());
    }

    @DeleteMapping("/trash")
    public DeleteResult emptyTrash(Authentication a) {
        return service.emptyTrash(a.getName());
    }

    @GetMapping("/settings")
    public Settings settings() {
        return service.settings();
    }

    /** Where the quota comes from: the Cloudinary plan, or the local disk when there is no account. */
    @GetMapping("/quota")
    public QuotaInfo quota() {
        return service.quotaInfo();
    }

    /** The folders of the Cloudinary account the app writes into, with their file count and size. */
    @GetMapping("/folders")
    public FolderSetup folders() {
        return service.folders();
    }

    /** Creates the folders of the app that are not in the account yet. */
    @PostMapping("/folders/setup")
    public FolderSetup setupFolders(Authentication a) {
        return service.setupFolders(a.getName());
    }

    /**
     * Reads the usage of the provider right now and stores it as the snapshot of the day.
     * The daily job does this at night; the button lets an admin refresh the numbers without
     * waiting for it.
     */
    @PostMapping("/usage/refresh")
    public Overview refreshUsage(Authentication a) {
        return service.refreshUsage(a.getName());
    }

    @PutMapping("/settings")
    public Settings updateSettings(Authentication a, @Valid @RequestBody UpdateSettingsRequest r) {
        return service.updateSettings(a.getName(), r);
    }
}
