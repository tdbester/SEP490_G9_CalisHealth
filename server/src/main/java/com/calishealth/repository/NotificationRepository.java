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

    List<Notification> findAllByTypeOrderByCreatedAtDesc(String type);

    long countByType(String type);

    @Modifying
    @Query("delete from Notification n where n.id in :ids")
    int deleteAllByIdIn(@Param("ids") Collection<Long> ids);
}
