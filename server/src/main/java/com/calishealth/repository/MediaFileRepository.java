package com.calishealth.repository;

import com.calishealth.models.MediaFile;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Registry of managed media (category IS NOT NULL). "On disk" = every status except PURGED,
 * so trashed files still count toward the used storage until they are purged.
 */
public interface MediaFileRepository extends JpaRepository<MediaFile, Long>, JpaSpecificationExecutor<MediaFile> {

    Optional<MediaFile> findFirstByFileUrlAndStatusNotOrderByIdDesc(String fileUrl, String status);

    Optional<MediaFile> findFirstByContentHashAndCategoryAndStatusNotOrderByIdDesc(String contentHash, String category, String status);

    List<MediaFile> findAllByCategoryIsNotNullAndStatusNot(String status);

    List<MediaFile> findAllByStatus(String status);

    @Query("select coalesce(sum(m.sizeBytes), 0L) from MediaFile m where m.category is not null and m.status <> 'PURGED'")
    long sumBytesOnDisk();

    /** What counts toward a member's quota: files on disk that are not in the trash. */
    @Query("select coalesce(sum(m.sizeBytes), 0L) from MediaFile m where m.uploadedBy.id = :userId "
            + "and m.category is not null and m.status in ('ACTIVE', 'ORPHANED', 'REJECTED')")
    long sumMemberBytes(@Param("userId") Long userId);

    @Query("select count(m) from MediaFile m where m.uploadedBy.id = :userId and m.category is not null and m.uploadedAt >= :since")
    long countUploadsSince(@Param("userId") Long userId, @Param("since") LocalDateTime since);

    /** Storage used at a past moment: uploaded before it and not purged yet at that time. */
    @Query("select coalesce(sum(m.sizeBytes), 0L) from MediaFile m where m.category is not null "
            + "and m.uploadedAt <= :at and (m.purgedAt is null or m.purgedAt > :at)")
    long sumBytesOnDiskAt(@Param("at") LocalDateTime at);

    /** ORPHANED / REJECTED files whose grace or retention period ends before {@code until}. */
    @Query("select m from MediaFile m where m.category is not null and m.status in ('ORPHANED', 'REJECTED') and m.deletableAt <= :until")
    List<MediaFile> findExpiredInactive(@Param("until") LocalDateTime until);

    @Query("select m from MediaFile m where m.category = 'FORM_CHECK_VIDEO' and m.status = 'ACTIVE' and m.expiresAt <= :until")
    List<MediaFile> findExpiredFormChecks(@Param("until") LocalDateTime until);

    @Query("select m from MediaFile m where m.status = 'TRASHED' and m.purgeAt <= :until")
    List<MediaFile> findTrashDue(@Param("until") LocalDateTime until);

    /** [status, files, bytes] per status. */
    @Query("select m.status, count(m), coalesce(sum(m.sizeBytes), 0L) from MediaFile m where m.category is not null group by m.status")
    List<Object[]> countByStatus();

    /** [category, files, bytes] for files on disk. */
    @Query("select m.category, count(m), coalesce(sum(m.sizeBytes), 0L) from MediaFile m "
            + "where m.category is not null and m.status <> 'PURGED' group by m.category")
    List<Object[]> usageByCategory();

    /** [source, files, bytes] for files on disk. */
    @Query("select m.source, count(m), coalesce(sum(m.sizeBytes), 0L) from MediaFile m "
            + "where m.category is not null and m.status <> 'PURGED' group by m.source")
    List<Object[]> usageBySource();

    /** [fileType, files] for files on disk. */
    @Query("select m.fileType, count(m) from MediaFile m where m.category is not null and m.status <> 'PURGED' group by m.fileType")
    List<Object[]> countByFileType();

    /** [userId, email, bytes, files] of the members using the most of their quota. */
    @Query("select u.id, u.email, coalesce(sum(m.sizeBytes), 0L), count(m) from MediaFile m join m.uploadedBy u "
            + "where m.source = 'MEMBER' and m.category is not null and m.status in ('ACTIVE', 'ORPHANED', 'REJECTED') "
            + "group by u.id, u.email order by coalesce(sum(m.sizeBytes), 0L) desc")
    List<Object[]> topMembers(Pageable pageable);

    @Query("select count(m), coalesce(sum(m.sizeBytes), 0L) from MediaFile m where m.category is not null "
            + "and m.status in ('ORPHANED', 'REJECTED') and m.deletableAt <= :now")
    List<Object[]> reclaimable(@Param("now") LocalDateTime now);

    @Query("select coalesce(sum(m.sizeBytes), 0L) from MediaFile m where m.status = 'TRASHED' and m.purgeAt <= :until")
    long sumTrashDue(@Param("until") LocalDateTime until);

    @Query("select coalesce(sum(m.sizeBytes), 0L) from MediaFile m where m.category is not null and "
            + "((m.status in ('ORPHANED', 'REJECTED') and m.deletableAt <= :until) "
            + "or (m.category = 'FORM_CHECK_VIDEO' and m.status = 'ACTIVE' and m.expiresAt <= :until))")
    long sumExpiringBy(@Param("until") LocalDateTime until);

    List<MediaFile> findAllByIdIn(Collection<Long> ids);
}
