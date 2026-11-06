package com.calishealth.repository;

import com.calishealth.models.NotificationRead;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface NotificationReadRepository extends JpaRepository<NotificationRead, Long> {
    List<NotificationRead> findAllByUserIdAndNotificationIdIn(Long userId, Collection<Long> notificationIds);

    boolean existsByUserIdAndNotificationId(Long userId, Long notificationId);
}
