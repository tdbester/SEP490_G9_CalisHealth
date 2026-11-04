package com.calishealth.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Daily auto-cleanup (03:00 server time by default, see the "Upload limits" tab).
 * On startup the registry is reconciled with the disk, so files uploaded before V25 show up too.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StorageCleanupJob {
    public static final String RUN_AT = "03:00";

    private final MediaCleanupService cleanup;

    @Scheduled(cron = "${app.storage.cleanup-cron:0 0 3 * * *}")
    public void runDaily() {
        try {
            MediaCleanupService.CleanupRun run = cleanup.runDaily();
            log.info("Media auto-cleanup: {} file(s) moved to trash, {} purged, {} bytes freed",
                    run.trashed(), run.purged(), run.freedBytes());
        } catch (RuntimeException exception) {
            log.error("Media auto-cleanup failed", exception);
        }
    }

    @EventListener(ApplicationReadyEvent.class)
    public void reconcileOnStartup() {
        try {
            cleanup.reconcile();
        } catch (RuntimeException exception) {
            log.warn("Could not reconcile media files on startup: {}", exception.getMessage());
        }
    }
}
