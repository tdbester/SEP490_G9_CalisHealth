package com.calishealth.service;

import com.calishealth.dtos.CreateNotificationRequestDto;
import com.calishealth.dtos.NotificationListResponseDto;
import com.calishealth.dtos.NotificationResponseDto;
import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.models.Notification;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.NotificationRepository;
import com.calishealth.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.EnabledIfDockerAvailable;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Integration test thật cho {@link AdminNotificationService}.
 *
 * <p>Yêu cầu cốt lõi:
 * <ul>
 *   <li>Chạy MySQL thật bằng Testcontainers (không dùng H2 / in-memory).</li>
 *   <li>Flyway chạy toàn bộ migration thật nên schema khớp production.</li>
 *   <li>Không mock repository — mọi lời gọi đi qua JPA + SQL thật.</li>
 *   <li>Kiểm chứng dữ liệu đã được ghi xuống DB bằng {@link JdbcTemplate}
 *       (đọc thẳng qua JDBC, không đi qua persistence context của Hibernate).</li>
 *   <li>Kiểm tra transaction rollback khi service ném exception giữa chừng.</li>
 * </ul>
 *
 * <p>Yêu cầu môi trường: máy phải có Docker đang chạy
 * (Testcontainers không tự cài Docker). Nếu máy không có Docker, toàn bộ class
 * được {@link EnabledIfDockerAvailable} bỏ qua (skip) thay vì làm build đỏ —
 * như vậy CI hay máy dev không cài Docker vẫn chạy được các test còn lại.
 */
@Testcontainers
@EnabledIfDockerAvailable
@SpringBootTest
@DisplayName("AdminNotificationService - integration test voi MySQL that")
class AdminNotificationServiceIntegrationTest {

    /**
     * MySQL container dùng chung cho cả class. Khởi động một lần, các test chạy
     * trên cùng database nên dữ liệu seed từ Flyway sẽ có sẵn.
     *
     * <p>Không gọi {@code withCommand(...)}: Testcontainers MySQL đã gắn lệnh
     * {@code mysqld} của image và ghi đè lệnh sẽ khiến container không khởi động
     * được. Cũng không ép collation: MySQL 8 mặc định là
     * {@code utf8mb4_0900_ai_ci}, còn migration V29 so sánh chuỗi giữa bảng tạm
     * (collation mặc định của server) và bảng {@code muscle_groups}
     * ({@code utf8mb4_unicode_ci}) — nếu ép collation khác sẽ lỗi
     * "Illegal mix of collations".
     */
    @Container
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
            .withDatabaseName("calishealth")
            .withUsername("test")
            .withPassword("test");

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.datasource.driver-class-name", MYSQL::getDriverClassName);
        // Flyway vẫn chạy để dựng schema giống production.
        registry.add("spring.flyway.enabled", () -> "true");
        // Job hẹn giờ (maintenance reminder, storage snapshot) không cần chạy khi test.
        registry.add("spring.task.scheduling.enabled", () -> "false");
        registry.add("maintenance.reminder-poll-ms", () -> "3600000");
        registry.add("app.storage.usage-cron", () -> "0 0 0 1 1 ?");
        registry.add("app.storage.cleanup-cron", () -> "0 0 0 1 1 ?");
        // Không dùng dịch vụ ngoài trong test.
        registry.add("app.cloudinary.cloud-name", () -> "");
        registry.add("app.cloudinary.api-key", () -> "");
        registry.add("app.cloudinary.api-secret", () -> "");
    }

    @Autowired
    private AdminNotificationService service;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private TransactionTemplate transactionTemplate;

    private User admin;

    @BeforeEach
    void setUp() {
        admin = userRepository.findByEmail("admin@calishealth.com")
                .orElseGet(() -> {
                    User created = new User();
                    created.setEmail("admin@calishealth.com");
                    created.setPassword("Test@123");
                    created.setFullName("Integration Admin");
                    created.setRole(UserRole.ADMIN);
                    created.setEnabled(true);
                    return userRepository.save(created);
                });
    }

    // ---------------------------------------------------------------------
    // createNotification
    // ---------------------------------------------------------------------

    @Nested
    @DisplayName("createNotification")
    class CreateNotification {

        @Test
        @DisplayName("ghi thong bao xuong database that va gan id auto-increment")
        void persistsNotificationToDatabase() {
            NotificationResponseDto response = service.createNotification(
                    new CreateNotificationRequestDto(
                            "Integration notice",
                            "Written by the integration test.",
                            "ANNOUNCEMENT",
                            "PUBLISHED",
                            "CONTENT_MANAGER"),
                    admin.getEmail());

            assertThat(response.id()).isNotNull().isPositive();
            assertThat(response.status()).isEqualTo("PUBLISHED");
            assertThat(response.targetAudience()).isEqualTo("CONTENT_MANAGER");

            // Doc thang qua JDBC de chung minh du lieu da xuong bang `notifications`.
            var rows = jdbcTemplate.queryForList(
                    "SELECT title, message, type, status, target_audience, created_by "
                            + "FROM notifications WHERE id = ?",
                    response.id());

            assertThat(rows).hasSize(1);
            assertThat(rows.get(0).get("title")).isEqualTo("Integration notice");
            assertThat(rows.get(0).get("message")).isEqualTo("Written by the integration test.");
            assertThat(rows.get(0).get("type")).isEqualTo("ANNOUNCEMENT");
            assertThat(rows.get(0).get("status")).isEqualTo("PUBLISHED");
            assertThat(rows.get(0).get("target_audience")).isEqualTo("CONTENT_MANAGER");
            assertThat(((Number) rows.get(0).get("created_by")).longValue())
                    .isEqualTo(admin.getId());
        }

        @Test
        @DisplayName("trim title/message va chuan hoa audience alias")
        void trimsFieldsAndNormalizesAudienceAliases() {
            NotificationResponseDto response = service.createNotification(
                    new CreateNotificationRequestDto(
                            "   Padded title   ",
                            "   Padded body   ",
                            "UPDATE",
                            "PUBLISHED",
                            "ALL_MEMBERS"),
                    admin.getEmail());

            assertThat(response.title()).isEqualTo("Padded title");
            assertThat(response.message()).isEqualTo("Padded body");
            // ALL_MEMBERS -> MEMBER
            assertThat(response.targetAudience()).isEqualTo("MEMBER");

            var stored = jdbcTemplate.queryForObject(
                    "SELECT title, message, target_audience FROM notifications WHERE id = ?",
                    (rs, rowNum) -> rs.getString("title") + "|" + rs.getString("message")
                            + "|" + rs.getString("target_audience"),
                    response.id());

            assertThat(stored).isEqualTo("Padded title|Padded body|MEMBER");
        }

        @Test
        @DisplayName("audience rong -> MEMBER; GLOBAL -> SYSTEM_WIDE")
        void fallsBackToMemberAndMapsGlobalAlias() {
            NotificationResponseDto blank = service.createNotification(
                    new CreateNotificationRequestDto("Blank", "Blank", "UPDATE", "PUBLISHED", "   "),
                    admin.getEmail());
            assertThat(blank.targetAudience()).isEqualTo("MEMBER");

            NotificationResponseDto global = service.createNotification(
                    new CreateNotificationRequestDto("Global", "Global", "UPDATE", "PUBLISHED", "GLOBAL"),
                    admin.getEmail());
            assertThat(global.targetAudience()).isEqualTo("SYSTEM_WIDE");

            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM notifications WHERE target_audience = 'MEMBER' AND title = 'Blank'",
                    Integer.class)).isPositive();
        }

        @Test
        @DisplayName("luon phat hanh PUBLISHED ke du request muon DRAFT")
        void alwaysPublishesRegardlessOfRequestedStatus() {
            NotificationResponseDto response = service.createNotification(
                    new CreateNotificationRequestDto("Draft request", "Body", "UPDATE", "DRAFT"),
                    admin.getEmail());

            assertThat(response.status()).isEqualTo("PUBLISHED");
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT status FROM notifications WHERE id = ?", String.class, response.id()))
                    .isEqualTo("PUBLISHED");
        }

        @Test
        @DisplayName("admin khong ton tai -> ResourceNotFoundException va khong ghi dong nao")
        void rejectsUnknownAdminWithoutWritingAnything() {
            long before = countNotifications();

            assertThatThrownBy(() -> service.createNotification(
                    new CreateNotificationRequestDto("Ghost", "Ghost", "UPDATE", "PUBLISHED"),
                    "ghost-not-exists@example.com"))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Authenticated admin user was not found");

            assertThat(countNotifications()).isEqualTo(before);
        }

        @Test
        @DisplayName("timestamp created_at/updated_at duoc gan tu database")
        void stampsCreatedAndUpdatedAt() {
            NotificationResponseDto response = service.createNotification(
                    new CreateNotificationRequestDto("Stamped", "Stamped", "UPDATE", "PUBLISHED"),
                    admin.getEmail());

            assertThat(response.createdAt()).isNotNull();

            var row = jdbcTemplate.queryForMap(
                    "SELECT created_at, updated_at FROM notifications WHERE id = ?", response.id());

            assertThat(row.get("created_at")).isNotNull();
            assertThat(row.get("updated_at")).isNotNull();
        }
    }

    // ---------------------------------------------------------------------
    // getNotification / getNotifications
    // ---------------------------------------------------------------------

    @Nested
    @DisplayName("getNotification")
    class GetOne {

        @Test
        @DisplayName("doc duoc thong bao vua tao")
        void readsPersistedNotification() {
            NotificationResponseDto created = service.createNotification(
                    new CreateNotificationRequestDto("Read me", "Read me body", "UPDATE", "PUBLISHED"),
                    admin.getEmail());

            NotificationResponseDto loaded = service.getNotification(created.id());

            assertThat(loaded.id()).isEqualTo(created.id());
            assertThat(loaded.title()).isEqualTo("Read me");
            assertThat(loaded.message()).isEqualTo("Read me body");
            assertThat(loaded.type()).isEqualTo("UPDATE");
            assertThat(loaded.status()).isEqualTo("PUBLISHED");
            assertThat(loaded.createdAt()).isNotNull();
        }

        @Test
        @DisplayName("id khong ton tai -> ResourceNotFoundException")
        void throwsNotFoundForMissingId() {
            long missingId = 9_999_999L;

            assertThatThrownBy(() -> service.getNotification(missingId))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Notification not found: " + missingId);
        }
    }

    @Nested
    @DisplayName("getNotifications")
    class GetList {

        @Test
        @DisplayName("type=null hoac ALL -> tra ve tat ca + bo dem dung")
        void listsAllWithCounts() {
            NotificationResponseDto announcement = service.createNotification(
                    new CreateNotificationRequestDto("Count announcement", "Body", "ANNOUNCEMENT", "PUBLISHED"),
                    admin.getEmail());
            NotificationResponseDto update = service.createNotification(
                    new CreateNotificationRequestDto("Count update", "Body", "UPDATE", "PUBLISHED"),
                    admin.getEmail());

            NotificationListResponseDto response = service.getNotifications(null);

            assertThat(response.notifications())
                    .extracting(NotificationResponseDto::id)
                    .contains(announcement.id(), update.id());

            // Dem lai truc tiep tu DB de so voi gia tri service tra ve.
            long announcementCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM notifications WHERE type = 'ANNOUNCEMENT'", Long.class);
            long updateCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM notifications WHERE type = 'UPDATE'", Long.class);
            long maintenanceCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM notifications WHERE type = 'MAINTENANCE'", Long.class);

            assertThat(response.counts().announcementCount()).isEqualTo(announcementCount);
            assertThat(response.counts().updateCount()).isEqualTo(updateCount);
            assertThat(response.counts().maintenanceCount()).isEqualTo(maintenanceCount);
            assertThat(response.counts().allCount())
                    .isEqualTo(announcementCount + updateCount + maintenanceCount);
        }

        @Test
        @DisplayName("loc theo type, bo qua hoa thuong va khoang trang")
        void filtersByTypeIgnoringCaseAndWhitespace() {
            service.createNotification(
                    new CreateNotificationRequestDto("Filtered", "Body", "MAINTENANCE", "PUBLISHED"),
                    admin.getEmail());

            NotificationListResponseDto response = service.getNotifications("  maintenance  ");

            assertThat(response.notifications())
                    .isNotEmpty()
                    .allMatch(item -> "MAINTENANCE".equals(item.type()));
        }

        @Test
        @DisplayName("type khong ho tro -> 400 BAD_REQUEST")
        void rejectsUnsupportedType() {
            assertThatThrownBy(() -> service.getNotifications("SPAM"))
                    .isInstanceOf(ResponseStatusException.class)
                    .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode().value())
                            .isEqualTo(400));
        }

        @Test
        @DisplayName("mọi thông bao trong DB deu PUBLISHED (V71 bo trang thai DRAFT)")
        void hasNoDraftRowsLeft() {
            // V71 chuyen moi dong DRAFT sang PUBLISHED -> module khong con vong doi doi nhap.
            NotificationListResponseDto response = service.getNotifications("ANNOUNCEMENT");

            assertThat(response.notifications())
                    .isNotEmpty()
                    .allMatch(item -> "PUBLISHED".equals(item.status()));
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM notifications WHERE status = 'DRAFT'", Integer.class)).isZero();
        }
    }

    // ---------------------------------------------------------------------
    // deleteNotification / deleteNotifications
    // ---------------------------------------------------------------------

    @Nested
    @DisplayName("deleteNotification")
    class DeleteOne {

        @Test
        @DisplayName("xoa that va bien dong khoi database")
        void deletesRowFromDatabase() {
            NotificationResponseDto created = service.createNotification(
                    new CreateNotificationRequestDto("Delete me", "Body", "UPDATE", "PUBLISHED"),
                    admin.getEmail());

            assertThat(notificationRepository.existsById(created.id())).isTrue();

            service.deleteNotification(created.id());

            assertThat(notificationRepository.existsById(created.id())).isFalse();
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM notifications WHERE id = ?", Integer.class, created.id()))
                    .isZero();
        }

        @Test
        @DisplayName("id khong ton tai -> ResourceNotFoundException")
        void throwsNotFoundForMissingId() {
            long missingId = 9_999_999L;

            assertThatThrownBy(() -> service.deleteNotification(missingId))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Notification not found: " + missingId);
        }
    }

    @Nested
    @DisplayName("deleteNotifications")
    class DeleteBatch {

        @Test
        @DisplayName("xoa nhieu dong trong mot lan goi")
        void deletesAllRequestedRows() {
            NotificationResponseDto first = service.createNotification(
                    new CreateNotificationRequestDto("Batch 1", "Body", "UPDATE", "PUBLISHED"),
                    admin.getEmail());
            NotificationResponseDto second = service.createNotification(
                    new CreateNotificationRequestDto("Batch 2", "Body", "UPDATE", "PUBLISHED"),
                    admin.getEmail());

            service.deleteNotifications(List.of(first.id(), second.id()));

            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM notifications WHERE id IN (?, ?)",
                    Integer.class, first.id(), second.id())).isZero();
        }

        @Test
        @DisplayName("id trung lap trong request van xoa mot lan")
        void deduplicatesIds() {
            NotificationResponseDto created = service.createNotification(
                    new CreateNotificationRequestDto("Dedup", "Body", "UPDATE", "PUBLISHED"),
                    admin.getEmail());

            service.deleteNotifications(List.of(created.id(), created.id()));

            assertThat(notificationRepository.existsById(created.id())).isFalse();
        }

        @Test
        @DisplayName("mot id khong ton tai -> ResourceNotFoundException va KHONG xoa dong nao (rollback)")
        void rollsBackWholeBatchWhenOneIdIsMissing() {
            NotificationResponseDto existing = service.createNotification(
                    new CreateNotificationRequestDto("Keep me", "Body", "UPDATE", "PUBLISHED"),
                    admin.getEmail());
            long missingId = 9_999_999L;

            assertThatThrownBy(() -> service.deleteNotifications(List.of(existing.id(), missingId)))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("One or more notifications were not found");

            // Khong duoc xoa gi: dong ton tai van phai con trong DB.
            assertThat(notificationRepository.existsById(existing.id())).isTrue();
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM notifications WHERE id = ?", Integer.class, existing.id()))
                    .isEqualTo(1);
        }

        @Test
        @DisplayName("danh sach rong -> khong lam gi")
        void handlesEmptyIdList() {
            long before = countNotifications();

            service.deleteNotifications(List.of());

            assertThat(countNotifications()).isEqualTo(before);
        }
    }

    // ---------------------------------------------------------------------
    // Transaction / rollback
    // ---------------------------------------------------------------------

    @Nested
    @DisplayName("Transaction rollback")
    class TransactionRollback {

        @Test
        @DisplayName("rollback khi tao thong bao that bai giua chung (title vuot qua do dai)")
        void rollsBackCreateWhenDatabaseRejectsRow() {
            long before = countNotifications();
            String tooLongTitle = "x".repeat(300);

            // MySQL cat title vuot qua VARCHAR(255) -> DataIntegrityViolationException.
            assertThatThrownBy(() -> service.createNotification(
                    new CreateNotificationRequestDto(tooLongTitle, "Body", "UPDATE", "PUBLISHED"),
                    admin.getEmail()))
                    .isInstanceOf(DataIntegrityViolationException.class);

            // Khong co dong nao duoc ghi lai.
            assertThat(countNotifications()).isEqualTo(before);
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM notifications WHERE title = ?", Integer.class, tooLongTitle))
                    .isZero();
        }

        @Test
        @DisplayName("rollback khi xoa batch that bai -> dong khong bi xoa")
        void rollsBackBatchDeleteWhenOneIdMissing() {
            NotificationResponseDto keep = service.createNotification(
                    new CreateNotificationRequestDto("Rollback keep", "Body", "UPDATE", "PUBLISHED"),
                    admin.getEmail());

            assertThatThrownBy(() -> service.deleteNotifications(List.of(keep.id(), 9_999_999L)))
                    .isInstanceOf(ResourceNotFoundException.class);

            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM notifications WHERE id = ?", Integer.class, keep.id()))
                    .isEqualTo(1);
        }

        @Test
        @DisplayName("service co chay trong transaction that (rollback chi khi nem exception)")
        void serviceMethodRunsInsideRealTransaction() {
            NotificationResponseDto created = transactionTemplate.execute(status -> {
                NotificationResponseDto response = service.createNotification(
                        new CreateNotificationRequestDto("Inside tx", "Body", "UPDATE", "PUBLISHED"),
                        admin.getEmail());
                // Con lai trong transaction -> chua commit, transactionTemplate se rollback.
                status.setRollbackOnly();
                return response;
            });

            assertThat(created).isNotNull();
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM notifications WHERE id = ?", Integer.class, created.id()))
                    .isZero();
        }

        @Test
        @DisplayName("du lieu commit khi transaction ket thuc thanh cong")
        void commitsDataOnSuccessfulTransaction() {
            NotificationResponseDto created = transactionTemplate.execute(status ->
                    service.createNotification(
                            new CreateNotificationRequestDto("Committed", "Body", "UPDATE", "PUBLISHED"),
                            admin.getEmail()));

            assertThat(created).isNotNull();
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM notifications WHERE id = ?", Integer.class, created.id()))
                    .isEqualTo(1);
        }
    }

    // ---------------------------------------------------------------------
    // Constraint / data integrity
    // ---------------------------------------------------------------------

    @Nested
    @DisplayName("Rang buoc du lieu")
    class DataIntegrity {

        @Test
        @DisplayName("created_by phai tro toi mot user that")
        void createdByReferencesRealUser() {
            NotificationResponseDto created = service.createNotification(
                    new CreateNotificationRequestDto("FK check", "Body", "UPDATE", "PUBLISHED"),
                    admin.getEmail());

            Long creatorId = jdbcTemplate.queryForObject(
                    "SELECT created_by FROM notifications WHERE id = ?", Long.class, created.id());

            assertThat(creatorId).isEqualTo(admin.getId());
            assertThat(userRepository.findById(creatorId)).isPresent();
        }

        @Test
        @DisplayName("xoa user khong lam mat thong bao da tao (created_by -> NULL)")
        void deletingAdminKeepsNotificationRow() {
            NotificationResponseDto created = service.createNotification(
                    new CreateNotificationRequestDto("Survivor", "Body", "UPDATE", "PUBLISHED"),
                    admin.getEmail());

            User temp = new User();
            temp.setEmail("temp-admin-notification-it@example.com");
            temp.setPassword("Test@123");
            temp.setFullName("Temp Admin");
            temp.setRole(UserRole.ADMIN);
            temp.setEnabled(true);
            User saved = userRepository.save(temp);

            // Tạo notification với created_by = temp user rồi xoá user đó.
            jdbcTemplate.update("UPDATE notifications SET created_by = ? WHERE id = ?",
                    saved.getId(), created.id());
            userRepository.delete(saved);
            userRepository.flush();
            entityManager.clear();

            Long creatorId = jdbcTemplate.queryForObject(
                    "SELECT created_by FROM notifications WHERE id = ?", Long.class, created.id());

            assertThat(creatorId).isNull();
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM notifications WHERE id = ?", Integer.class, created.id()))
                    .isEqualTo(1);
        }

        @Test
        @DisplayName("doc lai du lieu tu DB sau khi service tao -> khong phai du lieu trong RAM")
        void readsBackFromDatabaseNotFromMemory() {
            NotificationResponseDto created = service.createNotification(
                    new CreateNotificationRequestDto("Persisted", "Persisted body", "UPDATE", "PUBLISHED"),
                    admin.getEmail());

            // Xoa moi trong context de buoc Hibernate doc lai tu database.
            entityManager.clear();

            Notification reloaded = notificationRepository.findById(created.id()).orElseThrow();

            assertThat(reloaded.getTitle()).isEqualTo("Persisted");
            assertThat(reloaded.getMessage()).isEqualTo("Persisted body");
            assertThat(reloaded.getType()).isEqualTo("UPDATE");
            assertThat(reloaded.getStatus()).isEqualTo("PUBLISHED");
            assertThat(reloaded.getTargetAudience()).isEqualTo("MEMBER");
            assertThat(reloaded.getCreatedBy()).isEqualTo(admin.getId());
            assertThat(reloaded.getCreatedAt()).isNotNull();
        }
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    private long countNotifications() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM notifications", Long.class);
        return count == null ? 0L : count;
    }
}
