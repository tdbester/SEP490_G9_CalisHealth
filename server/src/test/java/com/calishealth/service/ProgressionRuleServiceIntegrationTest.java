package com.calishealth.service;

import com.calishealth.dtos.ProgressionRuleDtos.ExerciseRef;
import com.calishealth.dtos.ProgressionRuleDtos.RuleDetail;
import com.calishealth.dtos.ProgressionRuleDtos.RuleEvaluation;
import com.calishealth.dtos.ProgressionRuleDtos.RuleList;
import com.calishealth.dtos.ProgressionRuleDtos.RuleTree;
import com.calishealth.dtos.ProgressionRuleDtos.SaveRuleRequest;
import com.calishealth.dtos.ProgressionRuleDtos.SetResultInput;
import com.calishealth.dtos.ProgressionRuleDtos.SubmitExerciseResultRequest;
import com.calishealth.dtos.ProgressionRuleDtos.UpdateRuleRequest;
import com.calishealth.models.Exercise;
import com.calishealth.models.MemberProfile;
import com.calishealth.models.ProgressionRule;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.MemberSkillProgressRepository;
import com.calishealth.repository.ProgressionRuleRepository;
import com.calishealth.repository.SessionExerciseResultRepository;
import com.calishealth.repository.SessionSetResultRepository;
import com.calishealth.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.EnabledIfDockerAvailable;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Integration test that cho {@link ProgressionRuleService}.
 *
 * <p>Cac yeu cau co loi:
 * <ul>
 *   <li>MySQL that chay bang Testcontainers (khong dung H2 / in-memory).</li>
 *   <li>Flyway chay toan bo migration that nen schema khop production.</li>
 *   <li>Khong mock repository - moi loi goi di qua JPA + SQL that.</li>
 *   <li>Kiem chung du lieu da ghi xuong DB bang {@link JdbcTemplate}
 *       (doc thang qua JDBC, khong di qua persistence context cua Hibernate).</li>
 *   <li>Kiem tra transaction rollback khi service nem exception giua chung.</li>
 * </ul>
 *
 * <p>Yeu cau moi truong: may phai co Docker dang chay (Testcontainers khong tu cai
 * Docker). Neu may khong co Docker, toan bo class duoc {@link EnabledIfDockerAvailable}
 * bo qua (skip) thay vi lam build do - nho vay CI hay may dev khong cai Docker van
 * chay duoc cac test con lai.
 */
@Testcontainers
@EnabledIfDockerAvailable
@SpringBootTest
@DisplayName("ProgressionRuleService - integration test voi MySQL that")
class ProgressionRuleServiceIntegrationTest {

    /**
     * MySQL container dung chung cho ca class. Khoi dong mot lan, cac test chay
     * tren cung database nen du lieu seed tu Flyway se co san.
     *
     * <p>Khong goi {@code withCommand(...)}: Testcontainers MySQL da gan lenh
     * {@code mysqld} cua image va ghi de lenh se khien container khong khoi dong
     * duoc. Cung khong ep collation: MySQL 8 mac dinh la
     * {@code utf8mb4_0900_ai_ci}, con migration V29 so sanh chuoi giua bang tam
     * (collation mac dinh cua server) va bang {@code muscle_groups}
     * ({@code utf8mb4_unicode_ci}) - neu ep collation khac se loi
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
        // Flyway van chay de dung schema giong production.
        registry.add("spring.flyway.enabled", () -> "true");
        // Job hen gio (leaderboard, maintenance reminder, storage snapshot) khong can chay khi test.
        registry.add("spring.task.scheduling.enabled", () -> "false");
        registry.add("maintenance.reminder-poll-ms", () -> "3600000");
        registry.add("app.storage.usage-cron", () -> "0 0 0 1 1 ?");
        registry.add("app.storage.cleanup-cron", () -> "0 0 0 1 1 ?");
        // Khong dung dich vu ngoai trong test.
        registry.add("app.cloudinary.cloud-name", () -> "");
        registry.add("app.cloudinary.api-key", () -> "");
        registry.add("app.cloudinary.api-secret", () -> "");
    }

    @Autowired
    private ProgressionRuleService service;

    @Autowired
    private ProgressionRuleRepository ruleRepository;

    @Autowired
    private ExerciseRepository exerciseRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MemberProfileRepository profileRepository;

    @Autowired
    private MemberSkillProgressRepository skillProgressRepository;

    @Autowired
    private SessionExerciseResultRepository exerciseResultRepository;

    @Autowired
    private SessionSetResultRepository setResultRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private TransactionTemplate transactionTemplate;

    /** Dem so test da chay - dung de tao email khong trung cho moi test. */
    private static final AtomicLong COUNTER = new AtomicLong();

    /** Bai tap fixture do test tao: bai goc (khong tien kien). */
    private Exercise rootExercise;
    /** Bai tap fixture: bai con cua {@link #rootExercise}. */
    private Exercise childExercise;
    /** Bai tap fixture thu hai de tao cay nhieu nhanh. */
    private Exercise secondChildExercise;
    /** Bai tap fixture do bang giay (HOLD). */
    private Exercise holdExercise;

    /** Member rieng cho tung test de cac dong tien do khong lan nhau. */
    private User member;
    private MemberProfile memberProfile;

    @BeforeEach
    void setUp() {
        rootExercise = fixtureExercise("IT_ROOT_REPS", "IT Root Reps", "REPS");
        childExercise = fixtureExercise("IT_CHILD_REPS", "IT Child Reps", "REPS");
        secondChildExercise = fixtureExercise("IT_CHILD2_REPS", "IT Child2 Reps", "REPS");
        holdExercise = fixtureExercise("IT_HOLD", "IT Hold", "HOLD");

        String email = "it-progression-" + COUNTER.incrementAndGet() + "-" + System.nanoTime()
                + "@example.test";
        User created = new User();
        created.setEmail(email);
        created.setPassword("Test@123");
        created.setFullName("Progression Integration Member");
        created.setRole(UserRole.MEMBER);
        created.setEnabled(true);
        member = userRepository.save(created);

        MemberProfile profile = new MemberProfile();
        profile.setUser(member);
        memberProfile = profileRepository.save(profile);
    }

    /**
     * Tao bai tap rieng cho test.
     *
     * <p>Khong dung bai tap cua seed data: seed da co san cac cap
     * {@code prerequisite -> exercise}, dung lai se gay loi 409 "rule for this pair
     * of exercises already exists" va lam nhieu test khac nhau anh huong lan nhau.
     */
    private Exercise fixtureExercise(String code, String name, String category) {
        return exerciseRepository.findByCode(code).orElseGet(() -> {
            Exercise exercise = new Exercise();
            exercise.setCode(code);
            exercise.setName(name);
            exercise.setType("HEALTH");
            exercise.setCategory(category);
            exercise.setSource("SYSTEM");
            exercise.setModerationStatus("ACTIVE");
            exercise.setActive(true);
            exercise.setShareWithCommunity(false);
            return exerciseRepository.save(exercise);
        });
    }

    // =====================================================================
    // Quan ly rule: create / update / delete
    // =====================================================================

    @Nested
    @DisplayName("Quan ly rule")
    class RuleManagement {

        @Test
        @DisplayName("create: ghi rule xuong database that")
        void createPersistsRuleToDatabase() {
            RuleDetail detail = service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 3, 12, null,
                    new BigDecimal("80"), "ACTIVE"));

            assertThat(detail.rule().id()).isNotNull().isPositive();
            assertThat(detail.rule().status()).isEqualTo("ACTIVE");
            assertThat(detail.rule().measureType()).isEqualTo("REPS");
            assertThat(detail.rule().requiredSets()).isEqualTo(3);
            assertThat(detail.rule().requiredReps()).isEqualTo(12);
            assertThat(detail.rule().requiredSeconds()).isNull();
            assertThat(detail.rule().exercise().code()).isEqualTo(childExercise.getCode());
            assertThat(detail.rule().prerequisite().code()).isEqualTo(rootExercise.getCode());

            // Doc thang qua JDBC de chung minh du lieu da xuong bang `progression_rules`.
            var rows = jdbcTemplate.queryForList(
                    "SELECT rule_name, relationship, measure_type, required_sets, required_reps, "
                            + "required_seconds, min_accuracy, status, exercise_id, prerequisite_exercise_id "
                            + "FROM progression_rules WHERE id = ?",
                    detail.rule().id());

            assertThat(rows).hasSize(1);
            assertThat(rows.get(0).get("measure_type")).isEqualTo("REPS");
            assertThat(((Number) rows.get(0).get("required_sets")).intValue()).isEqualTo(3);
            assertThat(((Number) rows.get(0).get("required_reps")).intValue()).isEqualTo(12);
            assertThat(rows.get(0).get("required_seconds")).isNull();
            assertThat(rows.get(0).get("relationship")).isEqualTo("PREREQUISITE");
            assertThat(((BigDecimal) rows.get(0).get("min_accuracy")))
                    .isEqualByComparingTo(new BigDecimal("80"));
            assertThat(((Number) rows.get(0).get("exercise_id")).longValue())
                    .isEqualTo(childExercise.getId());
            assertThat(((Number) rows.get(0).get("prerequisite_exercise_id")).longValue())
                    .isEqualTo(rootExercise.getId());

            service.delete(detail.rule().id());
        }

        @Test
        @DisplayName("create: bai HOLD duoc do bang giay, required_reps luon null")
        void createStoresHoldMeasureWithSeconds() {
            RuleDetail detail = service.create(new SaveRuleRequest(
                    childExercise.getCode(), holdExercise.getCode(), 2, null, 30,
                    new BigDecimal("85"), "ACTIVE"));

            assertThat(detail.rule().measureType()).isEqualTo("HOLD");
            assertThat(detail.rule().requiredSeconds()).isEqualTo(30);
            assertThat(detail.rule().requiredReps()).isNull();

            assertThat(jdbcTemplate.queryForObject(
                    "SELECT required_seconds FROM progression_rules WHERE id = ?",
                    Integer.class, detail.rule().id())).isEqualTo(30);
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT required_reps FROM progression_rules WHERE id = ?",
                    Integer.class, detail.rule().id())).isNull();

            service.delete(detail.rule().id());
        }

        @Test
        @DisplayName("create: cap bai da ton tai -> 409")
        void createRejectsDuplicatePair() {
            RuleDetail first = service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 3, 12, null,
                    new BigDecimal("80"), "ACTIVE"));

            try {
                assertThatThrownBy(() -> service.create(new SaveRuleRequest(
                        childExercise.getCode(), rootExercise.getCode(), 3, 12, null,
                        new BigDecimal("80"), "ACTIVE")))
                        .isInstanceOf(ResponseStatusException.class)
                        .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                                .isEqualTo(HttpStatus.CONFLICT));
            } finally {
                service.delete(first.rule().id());
            }
        }

        @Test
        @DisplayName("create: bai tap la prerequisite cua chinh no -> 400")
        void createRejectsSelfPrerequisite() {
            assertThatThrownBy(() -> service.create(new SaveRuleRequest(
                    rootExercise.getCode(), rootExercise.getCode(), 3, 12, null,
                    new BigDecimal("80"), "ACTIVE")))
                    .isInstanceOf(ResponseStatusException.class)
                    .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                            .isEqualTo(HttpStatus.BAD_REQUEST));
        }

        @Test
        @DisplayName("create: tao vong lap phu thuoc -> 400")
        void createRejectsDependencyLoop() {
            // root -> child, sau do child -> root se tao vong lap.
            RuleDetail first = service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 3, 12, null,
                    new BigDecimal("80"), "ACTIVE"));

            try {
                assertThatThrownBy(() -> service.create(new SaveRuleRequest(
                        rootExercise.getCode(), childExercise.getCode(), 3, 12, null,
                        new BigDecimal("80"), "ACTIVE")))
                        .isInstanceOf(ResponseStatusException.class)
                        .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                                .isEqualTo(HttpStatus.BAD_REQUEST))
                        .hasMessageContaining("loop");
            } finally {
                service.delete(first.rule().id());
            }
        }

        @Test
        @DisplayName("create: bai tap khong ton tai -> 404")
        void createRejectsUnknownExercise() {
            assertThatThrownBy(() -> service.create(new SaveRuleRequest(
                    "EX_NOT_EXIST", rootExercise.getCode(), 3, 12, null,
                    new BigDecimal("80"), "ACTIVE")))
                    .isInstanceOf(ResponseStatusException.class)
                    .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                            .isEqualTo(HttpStatus.NOT_FOUND));
        }

        @Test
        @DisplayName("create: so set ngoai khoang 1..20 -> 400")
        void createRejectsInvalidSetCount() {
            assertThatThrownBy(() -> service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 25, 12, null,
                    new BigDecimal("80"), "ACTIVE")))
                    .isInstanceOf(ResponseStatusException.class)
                    .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                            .isEqualTo(HttpStatus.BAD_REQUEST));
        }

        @Test
        @DisplayName("create: nguong % clean ngoai khoang 1..100 -> 400")
        void createRejectsInvalidAccuracy() {
            assertThatThrownBy(() -> service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 3, 12, null,
                    new BigDecimal("0"), "ACTIVE")))
                    .isInstanceOf(ResponseStatusException.class)
                    .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                            .isEqualTo(HttpStatus.BAD_REQUEST));
        }

        @Test
        @DisplayName("create: trang thai khong hop le -> 400")
        void createRejectsInvalidStatus() {
            assertThatThrownBy(() -> service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 3, 12, null,
                    new BigDecimal("80"), "PENDING")))
                    .isInstanceOf(ResponseStatusException.class)
                    .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                            .isEqualTo(HttpStatus.BAD_REQUEST));
        }

        @Test
        @DisplayName("create: bai HOLD thieu so giay -> 400")
        void createRejectsMissingSecondsForHoldExercise() {
            assertThatThrownBy(() -> service.create(new SaveRuleRequest(
                    childExercise.getCode(), holdExercise.getCode(), 3, null, null,
                    new BigDecimal("80"), "ACTIVE")))
                    .isInstanceOf(ResponseStatusException.class)
                    .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                            .isEqualTo(HttpStatus.BAD_REQUEST));
        }

        @Test
        @DisplayName("update: doi nguong thi ghi xuong database")
        void updatePersistsNewThresholds() {
            RuleDetail created = service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 3, 12, null,
                    new BigDecimal("80"), "ACTIVE"));

            try {
                RuleDetail updated = service.update(created.rule().id(),
                        new UpdateRuleRequest(5, 25, null, new BigDecimal("90"), "INACTIVE"));

                assertThat(updated.rule().requiredSets()).isEqualTo(5);
                assertThat(updated.rule().requiredReps()).isEqualTo(25);
                assertThat(updated.rule().status()).isEqualTo("INACTIVE");

                // Xoa moi trong context de buoc Hibernate doc lai tu database.
                entityManager.clear();

                var row = jdbcTemplate.queryForMap(
                        "SELECT required_sets, required_reps, min_accuracy, status "
                                + "FROM progression_rules WHERE id = ?",
                        created.rule().id());

                assertThat(((Number) row.get("required_sets")).intValue()).isEqualTo(5);
                assertThat(((Number) row.get("required_reps")).intValue()).isEqualTo(25);
                assertThat(((BigDecimal) row.get("min_accuracy"))).isEqualByComparingTo(new BigDecimal("90"));
                assertThat(row.get("status")).isEqualTo("INACTIVE");
            } finally {
                service.delete(created.rule().id());
            }
        }

        @Test
        @DisplayName("update: rule khong ton tai -> 404")
        void updateRejectsUnknownRule() {
            assertThatThrownBy(() -> service.update(9_999_999L,
                    new UpdateRuleRequest(5, 25, null, new BigDecimal("90"), "ACTIVE")))
                    .isInstanceOf(ResponseStatusException.class)
                    .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                            .isEqualTo(HttpStatus.NOT_FOUND));
        }

        @Test
        @DisplayName("update: so set khong hop le -> 400 va du lieu trong DB khong doi")
        void updateRejectsInvalidSetCountWithoutTouchingDatabase() {
            RuleDetail created = service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 3, 12, null,
                    new BigDecimal("80"), "ACTIVE"));

            try {
                assertThatThrownBy(() -> service.update(created.rule().id(),
                        new UpdateRuleRequest(0, 12, null, new BigDecimal("80"), "ACTIVE")))
                        .isInstanceOf(ResponseStatusException.class)
                        .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                                .isEqualTo(HttpStatus.BAD_REQUEST));

                // Du lieu cu trong DB phai giu nguyen.
                entityManager.clear();
                var row = jdbcTemplate.queryForMap(
                        "SELECT required_sets, required_reps FROM progression_rules WHERE id = ?",
                        created.rule().id());
                assertThat(((Number) row.get("required_sets")).intValue()).isEqualTo(3);
                assertThat(((Number) row.get("required_reps")).intValue()).isEqualTo(12);
            } finally {
                service.delete(created.rule().id());
            }
        }

        @Test
        @DisplayName("updateStatus: doi trang thai rule thi ghi xuong database")
        void updateStatusPersistsToDatabase() {
            RuleDetail created = service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 3, 12, null,
                    new BigDecimal("80"), "ACTIVE"));

            try {
                service.updateStatus(created.rule().id(), "inactive");

                assertThat(jdbcTemplate.queryForObject(
                        "SELECT status FROM progression_rules WHERE id = ?",
                        String.class, created.rule().id())).isEqualTo("INACTIVE");
            } finally {
                service.delete(created.rule().id());
            }
        }

        @Test
        @DisplayName("updateStatus: trang thai khong hop le -> 400")
        void updateStatusRejectsInvalidStatus() {
            RuleDetail created = service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 3, 12, null,
                    new BigDecimal("80"), "ACTIVE"));

            try {
                assertThatThrownBy(() -> service.updateStatus(created.rule().id(), "PENDING"))
                        .isInstanceOf(ResponseStatusException.class)
                        .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                                .isEqualTo(HttpStatus.BAD_REQUEST));
            } finally {
                service.delete(created.rule().id());
            }
        }

        @Test
        @DisplayName("delete: xoa rule that va bien khoi database")
        void deleteRemovesRowFromDatabase() {
            RuleDetail created = service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 3, 12, null,
                    new BigDecimal("80"), "ACTIVE"));
            Long ruleId = created.rule().id();

            assertThat(ruleRepository.existsById(ruleId)).isTrue();

            service.delete(ruleId);

            assertThat(ruleRepository.existsById(ruleId)).isFalse();
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM progression_rules WHERE id = ?", Integer.class, ruleId)).isZero();
        }

        @Test
        @DisplayName("delete: rule khong ton tai -> 404")
        void deleteRejectsUnknownRule() {
            assertThatThrownBy(() -> service.delete(9_999_999L))
                    .isInstanceOf(ResponseStatusException.class)
                    .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                            .isEqualTo(HttpStatus.NOT_FOUND));
        }
    }

    // =====================================================================
    // list / tree / detail
    // =====================================================================

    @Nested
    @DisplayName("Doc du lieu rule")
    class RuleReading {

        @Test
        @DisplayName("list: dem rule active/inactive khop voi database")
        void listCountsMatchDatabase() {
            RuleList list = service.list();

            long activeInDb = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM progression_rules WHERE status = 'ACTIVE'", Long.class);
            long inactiveInDb = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM progression_rules WHERE status <> 'ACTIVE'", Long.class);

            assertThat(list.rules()).hasSize((int) (activeInDb + inactiveInDb));
            assertThat(list.activeCount()).isEqualTo(activeInDb);
            assertThat(list.inactiveCount()).isEqualTo(inactiveInDb);
        }

        @Test
        @DisplayName("list: chi bai SYSTEM active moi nam trong danh sach chon")
        void listOnlyOffersSelectableExercises() {
            RuleList list = service.list();

            assertThat(list.availableExercises()).isNotEmpty();
            assertThat(list.availableExercises())
                    .allMatch(ref -> exerciseRepository.findByCode(ref.code())
                            .map(exercise -> "SYSTEM".equalsIgnoreCase(exercise.getSource())
                                    && exercise.isActive()
                                    && ("ACTIVE".equalsIgnoreCase(exercise.getModerationStatus())
                                        || exercise.getModerationStatus() == null))
                            .orElse(false));
        }

        @Test
        @DisplayName("list: bai cua member khong nam trong danh sach chon")
        void listExcludesMemberExercises() {
            // Bai fixture cua test la bai SYSTEM -> duoc chon.
            // Tao them mot bai CUSTOM de chung minh bi loai.
            Exercise custom = new Exercise();
            custom.setCode("IT_CUSTOM_" + COUNTER.incrementAndGet());
            custom.setName("IT Custom Exercise");
            custom.setType("HEALTH");
            custom.setCategory("REPS");
            custom.setSource("CUSTOM");
            custom.setModerationStatus("ACTIVE");
            custom.setActive(true);
            custom.setShareWithCommunity(false);
            exerciseRepository.save(custom);

            RuleList list = service.list();

            assertThat(list.availableExercises())
                    .extracting(ExerciseRef::code)
                    .doesNotContain(custom.getCode());
        }

        @Test
        @DisplayName("tree: node va canh lay tu rule that")
        void treeBuiltFromPersistedRules() {
            RuleTree tree = service.tree();

            long ruleCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM progression_rules", Long.class);

            assertThat(tree.edges()).hasSize((int) ruleCount);
            assertThat(tree.nodes()).isNotEmpty();

            // Moi canh tro ve hai node co trong danh sach node.
            var nodeCodes = tree.nodes().stream().map(node -> node.code()).toList();
            assertThat(tree.edges())
                    .allMatch(edge -> nodeCodes.contains(edge.prerequisiteCode())
                            && nodeCodes.contains(edge.exerciseCode()));
        }

        @Test
        @DisplayName("detail: dem so member da mo khoa bai dich")
        void detailCountsUnlockedMembers() {
            ProgressionRule rule = ruleRepository.findAll().stream()
                    .filter(r -> "ACTIVE".equals(r.getStatus()))
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException("No seeded ACTIVE rule found"));

            RuleDetail detail = service.detail(rule.getId());

            long unlockedInDb = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM member_skill_progress "
                            + "WHERE exercise_id = ? AND status = 'UNLOCKED'",
                    Long.class, rule.getExercise().getId());

            assertThat(detail.unlockedMembers()).isEqualTo(unlockedInDb);
        }

        @Test
        @DisplayName("detail: rule khong ton tai -> 404")
        void detailRejectsUnknownRule() {
            assertThatThrownBy(() -> service.detail(9_999_999L))
                    .isInstanceOf(ResponseStatusException.class)
                    .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                            .isEqualTo(HttpStatus.NOT_FOUND));
        }
    }

    // =====================================================================
    // submitResult - ghi buoi tap that vao database
    // =====================================================================

    @Nested
    @DisplayName("submitResult")
    class SubmitResult {

        @Test
        @DisplayName("ghi buoi tap, ket qua bai va ket qua tung set xuong database")
        void persistsSessionAndSetResults() {
            long sessionsBefore = countRows("workout_sessions");
            long resultsBefore = countRows("session_exercise_results");
            long setsBefore = countRows("session_set_results");

            var response = service.submitResult(member.getEmail(),
                    new SubmitExerciseResultRequest(
                            rootExercise.getCode(),
                            List.of(new SetResultInput(12, 12, 0, 0),
                                    new SetResultInput(12, 11, 0, 0),
                                    new SetResultInput(12, 12, 0, 0)),
                            "LIBRARY"));

            assertThat(response.sessionId()).isNotNull().isPositive();
            assertThat(response.exercise().code()).isEqualTo(rootExercise.getCode());
            // 35/36 = 97.222...%
            assertThat(response.cleanRate()).isEqualByComparingTo(new BigDecimal("97.222"));

            // Buoi tap.
            var session = jdbcTemplate.queryForMap(
                    "SELECT member_profile_id, workout_name, status, active_seconds, total_reps, source "
                            + "FROM workout_sessions WHERE id = ?",
                    response.sessionId());

            assertThat(((Number) session.get("member_profile_id")).longValue())
                    .isEqualTo(memberProfile.getId());
            assertThat(session.get("workout_name")).isEqualTo(rootExercise.getName());
            assertThat(session.get("status")).isEqualTo("COMPLETED");
            assertThat(session.get("source")).isEqualTo("LIBRARY");
            assertThat(((Number) session.get("total_reps")).intValue()).isEqualTo(36);

            // Ket qua bai tap.
            var result = jdbcTemplate.queryForMap(
                    "SELECT exercise_id, sets_completed, valid_reps, invalid_reps, accuracy, active_seconds "
                            + "FROM session_exercise_results WHERE workout_session_id = ?",
                    response.sessionId());

            assertThat(((Number) result.get("exercise_id")).longValue())
                    .isEqualTo(rootExercise.getId());
            assertThat(((Number) result.get("sets_completed")).intValue()).isEqualTo(3);
            assertThat(((Number) result.get("valid_reps")).intValue()).isEqualTo(35);
            assertThat(((Number) result.get("invalid_reps")).intValue()).isEqualTo(1);
            assertThat((BigDecimal) result.get("accuracy")).isEqualByComparingTo(new BigDecimal("97.222"));

            // Ket qua tung set.
            var sets = jdbcTemplate.queryForList(
                    "SELECT set_number, total_reps, clean_reps FROM session_set_results "
                            + "WHERE session_exercise_result_id = ("
                            + "  SELECT id FROM session_exercise_results WHERE workout_session_id = ?)",
                    response.sessionId());

            assertThat(sets).hasSize(3);
            assertThat(((Number) sets.get(0).get("set_number")).intValue()).isEqualTo(1);
            assertThat(((Number) sets.get(0).get("clean_reps")).intValue()).isEqualTo(12);
            assertThat(((Number) sets.get(1).get("clean_reps")).intValue()).isEqualTo(11);
            assertThat(((Number) sets.get(2).get("set_number")).intValue()).isEqualTo(3);

            assertThat(countRows("workout_sessions")).isEqualTo(sessionsBefore + 1);
            assertThat(countRows("session_exercise_results")).isEqualTo(resultsBefore + 1);
            assertThat(countRows("session_set_results")).isEqualTo(setsBefore + 3);
        }

        @Test
        @DisplayName("luu tien do tot nhat vao member_skill_progress")
        void recordsBestProgressInDatabase() {
            service.submitResult(member.getEmail(),
                    new SubmitExerciseResultRequest(
                            rootExercise.getCode(),
                            List.of(new SetResultInput(10, 9, 0, 0),
                                    new SetResultInput(15, 14, 0, 0)),
                            "LIBRARY"));

            var progress = jdbcTemplate.queryForMap(
                    "SELECT status, best_reps, best_accuracy FROM member_skill_progress "
                            + "WHERE member_profile_id = ? AND exercise_id = ?",
                    memberProfile.getId(), rootExercise.getId());

            assertThat(progress.get("status")).isEqualTo("IN_PROGRESS");
            // Set tot nhat = 14 rep sach (khong phai tong 23).
            assertThat(((Number) progress.get("best_reps")).intValue()).isEqualTo(14);
            // 23/25 = 92%
            assertThat((BigDecimal) progress.get("best_accuracy"))
                    .isEqualByComparingTo(new BigDecimal("92.000"));
        }

        @Test
        @DisplayName("rule dat -> mo khoa bai dich va ghi UNLOCKED vao database")
        void passingRuleUnlocksTargetInDatabase() {
            RuleDetail created = service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 2, 10, null,
                    new BigDecimal("80"), "ACTIVE"));
            Long ruleId = created.rule().id();

            try {
                var response = service.submitResult(member.getEmail(),
                        new SubmitExerciseResultRequest(
                                rootExercise.getCode(),
                                List.of(new SetResultInput(12, 12, 0, 0),
                                        new SetResultInput(12, 12, 0, 0)),
                                "LIBRARY"));

                RuleEvaluation evaluation = response.evaluations().stream()
                        .filter(item -> ruleId.equals(item.ruleId()))
                        .findFirst()
                        .orElseThrow();

                assertThat(evaluation.passed()).isTrue();
                assertThat(evaluation.qualifyingSets()).isEqualTo(2);
                assertThat(evaluation.unlocks().code()).isEqualTo(childExercise.getCode());

                // Bai dich da mo khoa -> danh sach "mo khoa moi" co chua no.
                assertThat(response.newlyUnlocked())
                        .extracting(ExerciseRef::code)
                        .contains(childExercise.getCode());

                // Trang thai trong DB phai la UNLOCKED.
                assertThat(jdbcTemplate.queryForObject(
                        "SELECT status FROM member_skill_progress "
                                + "WHERE member_profile_id = ? AND exercise_id = ?",
                        String.class, memberProfile.getId(), childExercise.getId()))
                        .isEqualTo("UNLOCKED");
            } finally {
                service.delete(ruleId);
            }
        }

        @Test
        @DisplayName("rule khong dat -> khong mo khoa bai dich")
        void failingRuleDoesNotUnlock() {
            RuleDetail created = service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 3, 10, null,
                    new BigDecimal("80"), "ACTIVE"));
            Long ruleId = created.rule().id();

            try {
                var response = service.submitResult(member.getEmail(),
                        new SubmitExerciseResultRequest(
                                rootExercise.getCode(),
                                List.of(new SetResultInput(12, 12, 0, 0),
                                        new SetResultInput(12, 12, 0, 0)),
                                "LIBRARY"));

                RuleEvaluation evaluation = response.evaluations().stream()
                        .filter(item -> ruleId.equals(item.ruleId()))
                        .findFirst()
                        .orElseThrow();

                assertThat(evaluation.passed()).isFalse();
                assertThat(evaluation.qualifyingSets()).isEqualTo(2);
                assertThat(response.newlyUnlocked())
                        .extracting(ExerciseRef::code)
                        .doesNotContain(childExercise.getCode());

                assertThat(jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM member_skill_progress "
                                + "WHERE member_profile_id = ? AND exercise_id = ? AND status = 'UNLOCKED'",
                        Integer.class, memberProfile.getId(), childExercise.getId())).isZero();
            } finally {
                service.delete(ruleId);
            }
        }

        @Test
        @DisplayName("rule INACTIVE khong duoc danh gia")
        void inactiveRuleIsNotEvaluated() {
            RuleDetail created = service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 1, 10, null,
                    new BigDecimal("80"), "INACTIVE"));
            Long ruleId = created.rule().id();

            try {
                var response = service.submitResult(member.getEmail(),
                        new SubmitExerciseResultRequest(
                                rootExercise.getCode(),
                                List.of(new SetResultInput(12, 12, 0, 0)),
                                "LIBRARY"));

                assertThat(response.evaluations())
                        .noneMatch(evaluation -> ruleId.equals(evaluation.ruleId()));
            } finally {
                service.delete(ruleId);
            }
        }

        @Test
        @DisplayName("nguong % clean khong dat -> rule that bai")
        void accuracyBelowThresholdFailsRule() {
            RuleDetail created = service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 1, 10, null,
                    new BigDecimal("95"), "ACTIVE"));
            Long ruleId = created.rule().id();

            try {
                var response = service.submitResult(member.getEmail(),
                        new SubmitExerciseResultRequest(
                                rootExercise.getCode(),
                                List.of(new SetResultInput(10, 10, 0, 0),
                                        new SetResultInput(10, 5, 0, 0)),
                                "LIBRARY"));

                RuleEvaluation evaluation = response.evaluations().stream()
                        .filter(item -> ruleId.equals(item.ruleId()))
                        .findFirst()
                        .orElseThrow();

                assertThat(evaluation.passed()).isFalse();
                assertThat(evaluation.qualifyingSets()).isEqualTo(1);
                assertThat(evaluation.cleanRate()).isEqualByComparingTo(new BigDecimal("75.000"));
            } finally {
                service.delete(ruleId);
            }
        }

        @Test
        @DisplayName("bai HOLD duoc cham bang giay, khong phai so rep")
        void holdExerciseIsMeasuredInSeconds() {
            RuleDetail created = service.create(new SaveRuleRequest(
                    childExercise.getCode(), holdExercise.getCode(), 1, null, 30,
                    new BigDecimal("80"), "ACTIVE"));
            Long ruleId = created.rule().id();

            try {
                var response = service.submitResult(member.getEmail(),
                        new SubmitExerciseResultRequest(
                                holdExercise.getCode(),
                                // Giữ 40s nhung chi 20s dung tu the -> KHONG dat 30s.
                                List.of(new SetResultInput(0, 0, 40, 20)),
                                "LIBRARY"));

                RuleEvaluation evaluation = response.evaluations().stream()
                        .filter(item -> ruleId.equals(item.ruleId()))
                        .findFirst()
                        .orElseThrow();

                assertThat(evaluation.passed()).isFalse();
                assertThat(evaluation.qualifyingSets()).isEqualTo(0);
                assertThat(evaluation.cleanRate()).isEqualByComparingTo(new BigDecimal("50.000"));
            } finally {
                service.delete(ruleId);
            }
        }

        @Test
        @DisplayName("nguong HOLD dat -> mo khoa bai dich")
        void holdRulePassesOnCleanSeconds() {
            RuleDetail created = service.create(new SaveRuleRequest(
                    childExercise.getCode(), holdExercise.getCode(), 1, null, 30,
                    new BigDecimal("80"), "ACTIVE"));
            Long ruleId = created.rule().id();

            try {
                var response = service.submitResult(member.getEmail(),
                        new SubmitExerciseResultRequest(
                                holdExercise.getCode(),
                                // Giữ 40s, 32s dung tu the -> dat 30s.
                                List.of(new SetResultInput(0, 0, 40, 32)),
                                "LIBRARY"));

                RuleEvaluation evaluation = response.evaluations().stream()
                        .filter(item -> ruleId.equals(item.ruleId()))
                        .findFirst()
                        .orElseThrow();

                assertThat(evaluation.passed()).isTrue();
                assertThat(evaluation.qualifyingSets()).isEqualTo(1);
            } finally {
                service.delete(ruleId);
            }
        }

        @Test
        @DisplayName("source rong -> mac dinh LIBRARY")
        void blankSourceDefaultsToLibrary() {
            var response = service.submitResult(member.getEmail(),
                    new SubmitExerciseResultRequest(
                            rootExercise.getCode(),
                            List.of(new SetResultInput(10, 10, 0, 0)),
                            null));

            assertThat(jdbcTemplate.queryForObject(
                    "SELECT source FROM workout_sessions WHERE id = ?",
                    String.class, response.sessionId())).isEqualTo("LIBRARY");
        }

        @Test
        @DisplayName("source DAILY_PLAN duoc ghi dung vao database")
        void dailyPlanSourceIsPersisted() {
            var response = service.submitResult(member.getEmail(),
                    new SubmitExerciseResultRequest(
                            rootExercise.getCode(),
                            List.of(new SetResultInput(10, 10, 0, 0)),
                            "DAILY_PLAN"));

            assertThat(jdbcTemplate.queryForObject(
                    "SELECT source FROM workout_sessions WHERE id = ?",
                    String.class, response.sessionId())).isEqualTo("DAILY_PLAN");
        }

        @Test
        @DisplayName("bai tap khong ton tai -> 404")
        void rejectsUnknownExercise() {
            assertThatThrownBy(() -> service.submitResult(member.getEmail(),
                    new SubmitExerciseResultRequest(
                            "EX_NOT_EXIST",
                            List.of(new SetResultInput(10, 10, 0, 0)),
                            null)))
                    .isInstanceOf(ResponseStatusException.class)
                    .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                            .isEqualTo(HttpStatus.NOT_FOUND));
        }

        @Test
        @DisplayName("tai khoan khong ton tai -> 401")
        void rejectsUnknownAccount() {
            assertThatThrownBy(() -> service.submitResult("khong-ton-tai@example.test",
                    new SubmitExerciseResultRequest(
                            rootExercise.getCode(),
                            List.of(new SetResultInput(10, 10, 0, 0)),
                            null)))
                    .isInstanceOf(ResponseStatusException.class)
                    .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                            .isEqualTo(HttpStatus.UNAUTHORIZED));
        }

        @Test
        @DisplayName("tai khoan khong phai MEMBER -> 403")
        void rejectsNonMemberRole() {
            User admin = userRepository.findByEmail("admin@calishealth.com")
                    .orElseThrow(() -> new IllegalStateException("Seed admin account is missing"));

            assertThatThrownBy(() -> service.submitResult(admin.getEmail(),
                    new SubmitExerciseResultRequest(
                            rootExercise.getCode(),
                            List.of(new SetResultInput(10, 10, 0, 0)),
                            null)))
                    .isInstanceOf(ResponseStatusException.class)
                    .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                            .isEqualTo(HttpStatus.FORBIDDEN));
        }

        @Test
        @DisplayName("so rep sach vuot so rep -> 400")
        void rejectsCleanRepsAboveTotal() {
            assertThatThrownBy(() -> service.submitResult(member.getEmail(),
                    new SubmitExerciseResultRequest(
                            rootExercise.getCode(),
                            List.of(new SetResultInput(5, 10, 0, 0)),
                            null)))
                    .isInstanceOf(ResponseStatusException.class)
                    .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                            .isEqualTo(HttpStatus.BAD_REQUEST));
        }

        @Test
        @DisplayName("so giay sach vuot so giay -> 400")
        void rejectsCleanSecondsAboveTotal() {
            assertThatThrownBy(() -> service.submitResult(member.getEmail(),
                    new SubmitExerciseResultRequest(
                            holdExercise.getCode(),
                            List.of(new SetResultInput(0, 0, 10, 20)),
                            null)))
                    .isInstanceOf(ResponseStatusException.class)
                    .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                            .isEqualTo(HttpStatus.BAD_REQUEST));
        }

        @Test
        @DisplayName("khong ghi nhan rep nao -> 400")
        void rejectsEmptySamples() {
            assertThatThrownBy(() -> service.submitResult(member.getEmail(),
                    new SubmitExerciseResultRequest(
                            rootExercise.getCode(),
                            List.of(new SetResultInput(0, 0, 0, 0)),
                            null)))
                    .isInstanceOf(ResponseStatusException.class)
                    .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                            .isEqualTo(HttpStatus.BAD_REQUEST));
        }

        @Test
        @DisplayName("bai dang khoa trong cay progression -> 403")
        void rejectsLockedExercise() {
            // childExercise co tien kien la rootExercise -> sau khi tao rule, no bi khoa.
            RuleDetail created = service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 1, 10, null,
                    new BigDecimal("80"), "ACTIVE"));
            Long ruleId = created.rule().id();

            try {
                assertThatThrownBy(() -> service.submitResult(member.getEmail(),
                        new SubmitExerciseResultRequest(
                                childExercise.getCode(),
                                List.of(new SetResultInput(12, 12, 0, 0)),
                                "LIBRARY")))
                        .isInstanceOf(ResponseStatusException.class)
                        .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                                .isEqualTo(HttpStatus.FORBIDDEN));
            } finally {
                service.delete(ruleId);
            }
        }

        @Test
        @DisplayName("luong DAILY_PLAN khong bi chan du bai dang khoa")
        void dailyPlanIsNotBlockedByLock() {
            RuleDetail created = service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 1, 10, null,
                    new BigDecimal("80"), "ACTIVE"));
            Long ruleId = created.rule().id();

            try {
                var response = service.submitResult(member.getEmail(),
                        new SubmitExerciseResultRequest(
                                childExercise.getCode(),
                                List.of(new SetResultInput(12, 12, 0, 0)),
                                "DAILY_PLAN"));

                assertThat(response.exercise().code()).isEqualTo(childExercise.getCode());
            } finally {
                service.delete(ruleId);
            }
        }
    }

    // =====================================================================
    // Transaction / rollback
    // =====================================================================

    @Nested
    @DisplayName("Transaction rollback")
    class TransactionRollback {

        @Test
        @DisplayName("rollback khi buoi tap khong ghi duoc -> khong con buoi tap nao trong DB")
        void rollsBackSessionWhenResultCannotBeStored() {
            long sessionsBefore = countRows("workout_sessions");
            long resultsBefore = countRows("session_exercise_results");

            // `accuracy` > 100 bi CHECK constraint `ck_session_exercise_results_accuracy`
            // cua MySQL chan. insertSession() dung JDBC nen buoi tap da duoc insert truoc,
            // con session_exercise_results moi bi chan -> ca transaction phai rollback.
            //
            // MySQL bao loi CHECK constraint voi SQLState HY000 nen Spring chuyen thanh
            // `UncategorizedSQLException` (khong phai `DataIntegrityViolationException`
            // nhu voi loi NOT NULL / khoa ngoai), nen tao kiem tra theo `DataAccessException`.
            assertThatThrownBy(() -> transactionTemplate.execute(status -> {
                service.submitResult(member.getEmail(),
                        new SubmitExerciseResultRequest(
                                rootExercise.getCode(),
                                List.of(new SetResultInput(10, 10, 0, 0)),
                                "LIBRARY"));
                // Ghi mot dong khong hop le de chong minh rollback xoa het thay doi.
                jdbcTemplate.update(
                        "INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, "
                                + "accuracy, active_seconds, sort_order, workout_session_id, exercise_id) "
                                + "VALUES (1, 1, 0, 999.0, 0, 0, 1, ?)", rootExercise.getId());
                return null;
            }))
                    .isInstanceOf(DataAccessException.class);

            assertThat(countRows("workout_sessions")).isEqualTo(sessionsBefore);
            assertThat(countRows("session_exercise_results")).isEqualTo(resultsBefore);
        }

        @Test
        @DisplayName("rollback khi tao rule that bai -> du lieu cu khong bi doi")
        void rollsBackCreateWhenThresholdsAreInvalid() {
            RuleDetail created = service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 3, 12, null,
                    new BigDecimal("80"), "ACTIVE"));
            Long ruleId = created.rule().id();

            try {
                // required_sets = 0 vi pham CHECK ck_progression_rules_sets.
                assertThatThrownBy(() -> service.update(ruleId,
                        new UpdateRuleRequest(0, 12, null, new BigDecimal("80"), "ACTIVE")))
                        .isInstanceOf(ResponseStatusException.class);

                entityManager.clear();
                assertThat(jdbcTemplate.queryForObject(
                        "SELECT required_sets FROM progression_rules WHERE id = ?",
                        Integer.class, ruleId)).isEqualTo(3);
            } finally {
                service.delete(ruleId);
            }
        }

        @Test
        @DisplayName("service chay trong transaction that (rollback chi khi nem exception)")
        void serviceMethodRunsInsideRealTransaction() {
            var created = transactionTemplate.execute(status -> {
                var response = service.create(new SaveRuleRequest(
                        childExercise.getCode(), rootExercise.getCode(), 3, 12, null,
                        new BigDecimal("80"), "ACTIVE"));
                // Con lai trong transaction -> chua commit, transactionTemplate se rollback.
                status.setRollbackOnly();
                return response;
            });

            assertThat(created).isNotNull();
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM progression_rules WHERE id = ?",
                    Integer.class, created.rule().id())).isZero();
        }

        @Test
        @DisplayName("du lieu commit khi transaction ket thuc thanh cong")
        void commitsDataOnSuccessfulTransaction() {
            var created = transactionTemplate.execute(status ->
                    service.create(new SaveRuleRequest(
                            childExercise.getCode(), rootExercise.getCode(), 3, 12, null,
                            new BigDecimal("80"), "ACTIVE")));

            assertThat(created).isNotNull();
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM progression_rules WHERE id = ?",
                    Integer.class, created.rule().id())).isEqualTo(1);

            service.delete(created.rule().id());
        }

        @Test
        @DisplayName("rollback xoa ca buoi tap khi co loi sau khi ghi ket qua")
        void rollsBackWholeWorkoutWhenSetResultFails() {
            long sessionsBefore = countRows("workout_sessions");
            long setsBefore = countRows("session_set_results");

            assertThatThrownBy(() -> transactionTemplate.execute(status -> {
                var response = service.submitResult(member.getEmail(),
                        new SubmitExerciseResultRequest(
                                rootExercise.getCode(),
                                List.of(new SetResultInput(10, 10, 0, 0)),
                                "LIBRARY"));
                // Xoa session vua tao -> FK tu `session_exercise_results` khong cho phep.
                jdbcTemplate.update("DELETE FROM workout_sessions WHERE id = ?", response.sessionId());
                return null;
            }))
                    .isInstanceOf(DataAccessException.class);

            // Ca buoi tap phai bien mat, khong con trong DB.
            assertThat(countRows("workout_sessions")).isEqualTo(sessionsBefore);
            assertThat(countRows("session_set_results")).isEqualTo(setsBefore);
        }
    }

    // =====================================================================
    // Rang buoc du lieu
    // =====================================================================

    @Nested
    @DisplayName("Rang buoc du lieu")
    class DataIntegrity {

        @Test
        @DisplayName("rule phai tro toi hai bai tap that")
        void ruleReferencesRealExercises() {
            RuleDetail created = service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 3, 12, null,
                    new BigDecimal("80"), "ACTIVE"));

            try {
                Long exerciseId = jdbcTemplate.queryForObject(
                        "SELECT exercise_id FROM progression_rules WHERE id = ?",
                        Long.class, created.rule().id());
                Long prerequisiteId = jdbcTemplate.queryForObject(
                        "SELECT prerequisite_exercise_id FROM progression_rules WHERE id = ?",
                        Long.class, created.rule().id());

                assertThat(exerciseRepository.findById(exerciseId)).isPresent();
                assertThat(exerciseRepository.findById(prerequisiteId)).isPresent();
            } finally {
                service.delete(created.rule().id());
            }
        }

        @Test
        @DisplayName("doc lai du lieu tu DB sau khi service tao -> khong phai du lieu trong RAM")
        void readsBackFromDatabaseNotFromMemory() {
            RuleDetail created = service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 3, 12, null,
                    new BigDecimal("80"), "ACTIVE"));

            try {
                // Xoa moi trong context de buoc Hibernate doc lai tu database.
                entityManager.clear();

                ProgressionRule reloaded = ruleRepository.findById(created.rule().id()).orElseThrow();

                assertThat(reloaded.getRuleName())
                        .isEqualTo(childExercise.getName() + " progression " + rootExercise.getName());
                assertThat(reloaded.getRelationship()).isEqualTo("PREREQUISITE");
                assertThat(reloaded.getMeasureType()).isEqualTo("REPS");
                assertThat(reloaded.getRequiredSets()).isEqualTo(3);
                assertThat(reloaded.getRequiredReps()).isEqualTo(12);
                assertThat(reloaded.getRequiredSeconds()).isNull();
                assertThat(reloaded.getMinAccuracy()).isEqualByComparingTo(new BigDecimal("80.000"));
                assertThat(reloaded.getStatus()).isEqualTo("ACTIVE");
                assertThat(reloaded.getUpdatedAt()).isNotNull();
            } finally {
                service.delete(created.rule().id());
            }
        }

        @Test
        @DisplayName("mo khoa bai dich gan 1 dong member_skill_progress cho member")
        void unlockWritesExactlyOneProgressRow() {
            RuleDetail created = service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 1, 10, null,
                    new BigDecimal("80"), "ACTIVE"));
            Long ruleId = created.rule().id();

            try {
                service.submitResult(member.getEmail(),
                        new SubmitExerciseResultRequest(
                                rootExercise.getCode(),
                                List.of(new SetResultInput(12, 12, 0, 0)),
                                "LIBRARY"));

                Long rowCount = jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM member_skill_progress "
                                + "WHERE member_profile_id = ? AND exercise_id = ?",
                        Long.class, memberProfile.getId(), childExercise.getId());

                // UNIQUE KEY (member_profile_id, exercise_id) -> chi duoc co 1 dong.
                assertThat(rowCount).isEqualTo(1L);
            } finally {
                service.delete(ruleId);
            }
        }

        @Test
        @DisplayName("tieng do toi da mo khoa khong bi ghi de khi submit lai")
        void unlockedProgressIsNotOverwritten() {
            RuleDetail created = service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 1, 10, null,
                    new BigDecimal("80"), "ACTIVE"));
            Long ruleId = created.rule().id();

            try {
                service.submitResult(member.getEmail(),
                        new SubmitExerciseResultRequest(
                                rootExercise.getCode(),
                                List.of(new SetResultInput(12, 12, 0, 0)),
                                "LIBRARY"));

                Long firstUnlockedAt = jdbcTemplate.queryForObject(
                        "SELECT UNIX_TIMESTAMP(unlocked_at) * 1000 FROM member_skill_progress "
                                + "WHERE member_profile_id = ? AND exercise_id = ? AND status = 'UNLOCKED'",
                        Long.class, memberProfile.getId(), childExercise.getId());

                assertThat(firstUnlockedAt).isNotNull();

                // Submit lai: `unlock()` tra false vi status da la UNLOCKED,
                // va `recordBest()` khong ghi de trang thai.
                service.submitResult(member.getEmail(),
                        new SubmitExerciseResultRequest(
                                rootExercise.getCode(),
                                List.of(new SetResultInput(12, 12, 0, 0)),
                                "LIBRARY"));

                Long secondUnlockedAt = jdbcTemplate.queryForObject(
                        "SELECT UNIX_TIMESTAMP(unlocked_at) * 1000 FROM member_skill_progress "
                                + "WHERE member_profile_id = ? AND exercise_id = ? AND status = 'UNLOCKED'",
                        Long.class, memberProfile.getId(), childExercise.getId());

                assertThat(secondUnlockedAt).isEqualTo(firstUnlockedAt);
            } finally {
                service.delete(ruleId);
            }
        }

        @Test
        @DisplayName("buoi tap luon tro toi member profile that")
        void sessionReferencesRealMemberProfile() {
            var response = service.submitResult(member.getEmail(),
                    new SubmitExerciseResultRequest(
                            rootExercise.getCode(),
                            List.of(new SetResultInput(10, 10, 0, 0)),
                            "LIBRARY"));

            Long profileId = jdbcTemplate.queryForObject(
                    "SELECT member_profile_id FROM workout_sessions WHERE id = ?",
                    Long.class, response.sessionId());

            assertThat(profileId).isEqualTo(memberProfile.getId());
            assertThat(profileRepository.findById(profileId)).isPresent();
        }

        @Test
        @DisplayName("nguong % clean duoc luu voi scale 3 chinh xac")
        void minAccuracyIsStoredWithScaleThree() {
            RuleDetail created = service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 3, 12, null,
                    new BigDecimal("82.5"), "ACTIVE"));

            try {
                BigDecimal stored = jdbcTemplate.queryForObject(
                        "SELECT min_accuracy FROM progression_rules WHERE id = ?",
                        BigDecimal.class, created.rule().id());

                assertThat(stored).isEqualByComparingTo(new BigDecimal("82.500"));
                assertThat(stored.scale()).isEqualTo(3);
            } finally {
                service.delete(created.rule().id());
            }
        }

        @Test
        @DisplayName("xoa rule khong lam mat tien do cua member")
        void deletingRuleKeepsMemberProgress() {
            RuleDetail created = service.create(new SaveRuleRequest(
                    childExercise.getCode(), rootExercise.getCode(), 1, 10, null,
                    new BigDecimal("80"), "ACTIVE"));
            Long ruleId = created.rule().id();

            try {
                service.submitResult(member.getEmail(),
                        new SubmitExerciseResultRequest(
                                rootExercise.getCode(),
                                List.of(new SetResultInput(12, 12, 0, 0)),
                                "LIBRARY"));

                assertThat(jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM member_skill_progress "
                                + "WHERE member_profile_id = ? AND exercise_id = ? AND status = 'UNLOCKED'",
                        Integer.class, memberProfile.getId(), childExercise.getId())).isEqualTo(1);
            } finally {
                service.delete(ruleId);
            }

            // Xoa rule khong duoc xoa tien do cua member.
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM member_skill_progress "
                            + "WHERE member_profile_id = ? AND exercise_id = ? AND status = 'UNLOCKED'",
                    Integer.class, memberProfile.getId(), childExercise.getId())).isEqualTo(1);
        }
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    private long countRows(String table) {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Long.class);
        return count == null ? 0L : count;
    }
}
