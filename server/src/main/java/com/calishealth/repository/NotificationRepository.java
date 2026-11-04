package com.calishealth.repository;

import com.calishealth.models.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findAllByOrderByCreatedAtDesc();

    List<Notification> findAllByCreatedByIsNotNullOrderByCreatedAtDesc();

    List<Notification> findAllByTypeOrderByCreatedAtDesc(String type);

    List<Notification> findAllByTypeAndCreatedByIsNotNullOrderByCreatedAtDesc(String type);

    List<Notification> findAllByStatusOrderByCreatedAtDesc(String status);

    long countByCreatedByIsNotNull();

    long countByTypeAndCreatedByIsNotNull(String type);

    List<Notification> findAllByIdInAndCreatedByIsNotNull(Collection<Long> ids);

    boolean existsByIdAndCreatedByIsNotNull(Long id);

    java.util.Optional<Notification> findByIdAndCreatedByIsNotNull(Long id);

    @Query("""
            select n from Notification n
            where n.status = :status
              and (
                    (:role = 'MEMBER' and n.targetAudience in ('MEMBER', 'ALL_MEMBERS', 'SYSTEM_WIDE', 'ALL_USERS', 'GLOBAL', 'ALL_ROLES'))
                    or (:role = 'CONTENT_MANAGER' and n.targetAudience in ('CONTENT_MANAGER', 'SYSTEM_WIDE', 'ALL_USERS', 'GLOBAL', 'ALL_ROLES'))
                    or (:role = 'ADMIN' and n.targetAudience in ('SYSTEM_WIDE', 'ALL_USERS', 'GLOBAL', 'ALL_ROLES'))
                    or (:role <> 'ADMIN' and n.targetAudience = 'SPECIFIC_USER' and n.userId = :userId)
              )
            order by n.createdAt desc
            """)
    List<Notification> findVisibleToUserByStatusAudienceOrderByCreatedAtDesc(
            @Param("userId") Long userId,
            @Param("role") String role,
            @Param("status") String status
    );

    long countByType(String type);

    @Modifying
    @Query("delete from Notification n where n.id in :ids")
    int deleteAllByIdIn(@Param("ids") Collection<Long> ids);
}
