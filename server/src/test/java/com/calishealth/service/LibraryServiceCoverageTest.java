package com.calishealth.service;

import com.calishealth.dtos.LibraryDtos.CreateMemberExerciseRequest;
import com.calishealth.dtos.LibraryDtos.ExerciseListItem;
import com.calishealth.dtos.LibraryDtos.FitnessLevelOption;
import com.calishealth.dtos.LibraryDtos.LibrarySummaryResponse;
import com.calishealth.dtos.LibraryDtos.PagedExerciseListResponse;
import com.calishealth.dtos.LibraryOverviewDTO;
import com.calishealth.models.Exercise;
import com.calishealth.models.ExerciseMuscleGroup;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.MuscleGroup;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho {@link LibraryService}: các nhánh còn thiếu coverage
 * (đếm số liệu, lọc danh sách, phân trang, mapping entity -> DTO, seed data).
 */
class LibraryServiceCoverageTest {

    private ExerciseRepository exercises;
    private WorkoutRepository workouts;
    private UserRepository users;
    private ExerciseMuscleGroupCatalog muscleGroups;
    private FitnessLevelRepository levels;
    private SystemNotificationService notifications;
    private ContentNameGuardService nameGuard;
    private LibraryService service;

    private static final String EMAIL = "member@calishealth.vn";

    @BeforeEach
    void setUp() {
        exercises = mock(ExerciseRepository.class);
        workouts = mock(WorkoutRepository.class);
        users = mock(UserRepository.class);
        muscleGroups = mock(ExerciseMuscleGroupCatalog.class);
        levels = mock(FitnessLevelRepository.class);
        notifications = mock(SystemNotificationService.class);
        nameGuard = mock(ContentNameGuardService.class);
        service = new LibraryService(
                exercises, workouts, users, muscleGroups, levels, notifications, nameGuard);
    }

    // ------------------------------------------------------------------ helpers

    private static FitnessLevel level(String name, int min, int max, String status) {
        FitnessLevel lv = new FitnessLevel();
        lv.setId((long) min);
        lv.setName(name);
        lv.setScoreMin(min);
        lv.setScoreMax(max);
        lv.setStatus(status);
        return lv;
    }

    private static Exercise systemExercise(String name, String type, String mg, String levelName,
                                          String code, String moderation, boolean active) {
        Exercise e = new Exercise();
        e.setId((long) name.length());
        e.setCode(code);
        e.setName(name);
        e.setType(type);
        e.setSource("SYSTEM");
        e.setModerationStatus(moderation);
        e.setActive(active);
        e.setCategory("REPS");
        e.setLevel(levelName);
        e.setMuscleGroup(mg);
        e.setDefaultSets(3);
        e.setDefaultReps(12);
        e.setInstructions("Huong dan thuc hien");
        return e;
    }

    private static User member(long id) {
        User u = new User();
        u.setId(id);
        u.setEmail(EMAIL);
        u.setRole(UserRole.MEMBER);
        return u;
    }

    // ------------------------------------------------------------ getExerciseCounts

    @Test
    @DisplayName("getExerciseCounts: tra ve so luong theo 3 nhom")
    void getExerciseCountsReturnsAllGroups() {
        when(exercises.countAcceptedSystemExercisesByType("HEALTH")).thenReturn(10L);
        when(exercises.countAcceptedSystemExercisesByType("SKILL")).thenReturn(4L);
        when(exercises.countPublishedCommunityMemberExercises()).thenReturn(2L);

        var counts = service.getExerciseCounts(EMAIL);

        assertThat(counts.healthCount()).isEqualTo(10L);
        assertThat(counts.skillCount()).isEqualTo(4L);
        assertThat(counts.memberCount()).isEqualTo(2L);
    }

    // ------------------------------------------------------------- getFitnessLevels

    @Test
    @DisplayName("getFitnessLevels: sap xep theo scoreMin tang dan")
    void getFitnessLevelsSortedByScoreMin() {
        when(levels.findAll()).thenReturn(List.of(
                level("Advanced", 60, 100, "ACTIVE"),
                level("Beginner", 0, 30, "ACTIVE"),
                level("Intermediate", 30, 60, "INACTIVE")));

        List<FitnessLevelOption> result = service.getFitnessLevels();

        assertThat(result).hasSize(3);
        assertThat(result.get(0).name()).isEqualTo("Beginner");
        assertThat(result.get(1).name()).isEqualTo("Intermediate");
        assertThat(result.get(2).name()).isEqualTo("Advanced");
        assertThat(result.get(2).scoreMax()).isEqualTo(100);
        assertThat(result.get(2).status()).isEqualTo("ACTIVE");
    }

    @Test
    @DisplayName("getFitnessLevels: danh sach rong -> list rong")
    void getFitnessLevelsEmpty() {
        when(levels.findAll()).thenReturn(List.of());
        assertThat(service.getFitnessLevels()).isEmpty();
    }

    // ----------------------------------------------------------------- getSummary

    @Test
    @DisplayName("getSummary: workout FLEX tinh vao ca Health va Skill")
    void getSummaryCountsFlexInBothTabs() {
        when(exercises.countAcceptedSystemExercisesByType(anyString())).thenReturn(1L);
        when(exercises.countPublishedCommunityMemberExercises()).thenReturn(0L);
        when(workouts.countSystemWorkoutsByTypes(any())).thenReturn(5L);
        when(workouts.countBySourceAndTemplateStatusAndModerationStatusAndSharedWithCommunityTrue(
                "CUSTOM", "PUBLISHED", "ACTIVE")).thenReturn(3L);

        LibrarySummaryResponse summary = service.getSummary(EMAIL);

        assertThat(summary.exercise().healthCount()).isEqualTo(1L);
        assertThat(summary.workout().healthCount()).isEqualTo(5L);
        assertThat(summary.workout().skillCount()).isEqualTo(5L);
        assertThat(summary.workout().customCount()).isEqualTo(3L);
    }

    // ---------------------------------------------------------------- getOverview

    @Test
    @DisplayName("getOverview: guest -> kiem duong moi nhan 0")
    void getOverviewGuestReturnsZeroes() {
        when(exercises.countAcceptedSystemExercisesByType(anyString())).thenReturn(7L);
        when(workouts.countSystemWorkoutsByTypes(any())).thenReturn(2L);

        LibraryOverviewDTO overview = service.getOverview(null);

        assertThat(overview.memberExercisesCount()).isEqualTo(0L);
        assertThat(overview.customWorkoutsCount()).isEqualTo(0L);
        assertThat(overview.healthExercisesCount()).isEqualTo(7L);
        verify(exercises, never()).countAcceptedMemberExercisesByAuthorId(anyLong());
    }

    @Test
    @DisplayName("getOverview: email rong -> guest")
    void getOverviewBlankEmailTreatedAsGuest() {
        when(exercises.countAcceptedSystemExercisesByType(anyString())).thenReturn(0L);
        when(workouts.countSystemWorkoutsByTypes(any())).thenReturn(0L);

        LibraryOverviewDTO overview = service.getOverview("   ");

        assertThat(overview.memberExercisesCount()).isEqualTo(0L);
        verify(users, never()).findByEmail(anyString());
    }

    @Test
    @DisplayName("getOverview: user khong con ton tai -> 401")
    void getOverviewUnknownUserRejected() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getOverview(EMAIL))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    @DisplayName("getOverview: Content Manager van xem duoc, phan ca nhan = 0")
    void getOverviewNonMemberRoleHasNoPersonalContent() {
        User admin = member(9L);
        admin.setRole(UserRole.ADMIN);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(admin));
        when(exercises.countAcceptedSystemExercisesByType(anyString())).thenReturn(1L);
        when(workouts.countSystemWorkoutsByTypes(any())).thenReturn(1L);

        LibraryOverviewDTO overview = service.getOverview(EMAIL);

        assertThat(overview.memberExercisesCount()).isEqualTo(0L);
        assertThat(overview.customWorkoutsCount()).isEqualTo(0L);
    }

    @Test
    @DisplayName("getOverview: MEMBER -> dem theo author id")
    void getOverviewMemberCountsPersonalContent() {
        User u = member(42L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        when(exercises.countAcceptedSystemExercisesByType(anyString())).thenReturn(1L);
        when(exercises.countAcceptedMemberExercisesByAuthorId(42L)).thenReturn(6L);
        when(workouts.countSystemWorkoutsByTypes(any())).thenReturn(1L);
        when(workouts.countCustomWorkoutsByAuthorId(42L)).thenReturn(8L);

        LibraryOverviewDTO overview = service.getOverview(EMAIL);

        assertThat(overview.memberExercisesCount()).isEqualTo(6L);
        assertThat(overview.customWorkoutsCount()).isEqualTo(8L);
    }

    // --------------------------------------------------------------- getExercises

    @Test
    @DisplayName("getExercises: filter theo type=member chi tra bai CUSTOM/MEMBER")
    void getExercisesFiltersByMemberType() {
        stubThreeLevels();
        when(exercises.findAll()).thenReturn(List.of(
                systemExercise("Push-up", "HEALTH", "Chest", "Beginner", "EX-001", "ACTIVE", true),
                memberExercise("My Push", 11L)));
        when(exercises.findMemberExercisesByEmail(EMAIL)).thenReturn(List.of(memberExercise("My Push", 11L)));

        PagedExerciseListResponse res = service.getExercises(
                "member", "all", "all", "all", null, null, 1, 50, EMAIL);

        assertThat(res.items()).extracting(ExerciseListItem::name).contains("My Push");
        assertThat(res.items()).extracting(ExerciseListItem::name).doesNotContain("Push-up");
    }

    @Test
    @DisplayName("getExercises: type=health / skill phan loai theo type cua bai SYSTEM")
    void getExercisesFiltersByHealthAndSkill() {
        stubThreeLevels();
        when(exercises.findAll()).thenReturn(List.of(
                systemExercise("Push-up", "HEALTH", "Chest", "Beginner", "EX-001", "ACTIVE", true),
                systemExercise("Handstand", "SKILL", "Shoulders", "Advanced", "SK-001", "ACTIVE", true)));
        when(exercises.findMemberExercisesByEmail(EMAIL)).thenReturn(List.of());

        PagedExerciseListResponse health = service.getExercises(
                "health", "all", "all", "all", null, null, 1, 50, EMAIL);
        assertThat(health.items()).extracting(ExerciseListItem::name).contains("Push-up");

        PagedExerciseListResponse skill = service.getExercises(
                "skill", "all", "all", "all", null, null, 1, 50, EMAIL);
        assertThat(skill.items()).extracting(ExerciseListItem::name).contains("Handstand");
    }

    @Test
    @DisplayName("getExercises: type=skills (so nhieu) hoac type la chuoi -> filter contains")
    void getExercisesHandlesAliasAndContains() {
        stubThreeLevels();
        when(exercises.findAll()).thenReturn(List.of(
                systemExercise("Push-up", "HEALTH", "Chest", "Beginner", "EX-001", "ACTIVE", true),
                systemExercise("Handstand", "SKILL", "Shoulders", "Advanced", "SK-001", "ACTIVE", true)));
        when(exercises.findMemberExercisesByEmail(EMAIL)).thenReturn(List.of());

        PagedExerciseListResponse alias = service.getExercises(
                "skills", "all", "all", "all", null, null, 1, 50, EMAIL);
        assertThat(alias.items()).extracting(ExerciseListItem::name).contains("Handstand");

        PagedExerciseListResponse contains = service.getExercises(
                "HEAL", "all", "all", "all", null, null, 1, 50, EMAIL);
        assertThat(contains.items()).extracting(ExerciseListItem::name).contains("Push-up");
    }

    @Test
    @DisplayName("getExercises: source=system chi tra bai SYSTEM")
    void getExercisesFiltersBySourceSystem() {
        stubThreeLevels();
        when(exercises.findAll()).thenReturn(List.of(
                systemExercise("Push-up", "HEALTH", "Chest", "Beginner", "EX-001", "ACTIVE", true)));
        when(exercises.findMemberExercisesByEmail(EMAIL)).thenReturn(List.of());

        PagedExerciseListResponse res = service.getExercises(
                "all", "system", "all", "all", null, null, 1, 50, EMAIL);

        assertThat(res.items()).extracting(ExerciseListItem::source).containsOnly("SYSTEM");
    }

    @Test
    @DisplayName("getExercises: loc theo level")
    void getExercisesFiltersByLevel() {
        stubThreeLevels();
        when(exercises.findAll()).thenReturn(List.of(
                systemExercise("Push-up", "HEALTH", "Chest", "Beginner", "EX-001", "ACTIVE", true),
                systemExercise("Handstand", "SKILL", "Shoulders", "Advanced", "SK-001", "ACTIVE", true)));
        when(exercises.findMemberExercisesByEmail(EMAIL)).thenReturn(List.of());

        PagedExerciseListResponse res = service.getExercises(
                "all", "all", "beginner", "all", null, null, 1, 50, EMAIL);

        assertThat(res.items()).extracting(ExerciseListItem::name).contains("Push-up");
    }

    @Test
    @DisplayName("getExercises: loc theo nhieu co ban (dung muscles param)")
    void getExercisesFiltersByMuscleGroups() {
        stubThreeLevels();
        when(exercises.findAll()).thenReturn(List.of(
                systemExercise("Push-up", "HEALTH", "Chest", "Beginner", "EX-001", "ACTIVE", true),
                systemExercise("Handstand", "SKILL", "Shoulders", "Advanced", "SK-001", "ACTIVE", true)));
        when(exercises.findMemberExercisesByEmail(EMAIL)).thenReturn(List.of());

        PagedExerciseListResponse res = service.getExercises(
                "all", "all", "all", "all", "Chest,Shoulders", null, 1, 50, EMAIL);

        assertThat(res.items()).extracting(ExerciseListItem::name).contains("Push-up", "Handstand");
    }

    @Test
    @DisplayName("getExercises: muscles chua dau 'all' -> khong loc")
    void getExercisesIgnoresAllMuscleParam() {
        stubThreeLevels();
        when(exercises.findAll()).thenReturn(List.of(
                systemExercise("Push-up", "HEALTH", "Chest", "Beginner", "EX-001", "ACTIVE", true)));
        when(exercises.findMemberExercisesByEmail(EMAIL)).thenReturn(List.of());

        PagedExerciseListResponse res = service.getExercises(
                "all", "all", "all", "all", "all", null, 1, 50, EMAIL);

        assertThat(res.totalItems()).isGreaterThan(0);
    }

    @Test
    @DisplayName("getExercises: tim kiem uu tien theo ten truoc co ban")
    void getExercisesSearchPrioritisesName() {
        stubThreeLevels();
        when(exercises.findAll()).thenReturn(List.of(
                systemExercise("Push-up", "HEALTH", "Chest", "Beginner", "EX-001", "ACTIVE", true),
                systemExercise("Chest press", "HEALTH", "Arms", "Beginner", "EX-002", "ACTIVE", true)));
        when(exercises.findMemberExercisesByEmail(EMAIL)).thenReturn(List.of());

        PagedExerciseListResponse res = service.getExercises(
                "all", "all", "all", "all", null, "chest", 1, 50, EMAIL);

        assertThat(res.items().get(0).name()).isEqualTo("Chest press");
    }

    @Test
    @DisplayName("getExercises: phan trang - trang ngoai pham vi tra ve rong")
    void getExercisesPaginates() {
        stubThreeLevels();
        when(exercises.findAll()).thenReturn(List.of(
                systemExercise("A", "HEALTH", "Chest", "Beginner", "EX-001", "ACTIVE", true),
                systemExercise("B", "HEALTH", "Chest", "Beginner", "EX-002", "ACTIVE", true)));
        when(exercises.findMemberExercisesByEmail(EMAIL)).thenReturn(List.of());

        PagedExerciseListResponse res = service.getExercises(
                "all", "all", "all", "all", null, null, 2, 1, EMAIL);

        assertThat(res.currentPage()).isEqualTo(2);
        assertThat(res.pageSize()).isEqualTo(1);
        assertThat(res.totalPages()).isGreaterThan(0);
    }

    @Test
    @DisplayName("getExercises: page/size <= 0 -> chuan hoa ve 1")
    void getExercisesNormalisesInvalidPaging() {
        stubThreeLevels();
        when(exercises.findAll()).thenReturn(List.of(
                systemExercise("A", "HEALTH", "Chest", "Beginner", "EX-001", "ACTIVE", true)));
        when(exercises.findMemberExercisesByEmail(EMAIL)).thenReturn(List.of());

        PagedExerciseListResponse res = service.getExercises(
                "all", "all", "all", "all", null, null, 0, 0, EMAIL);

        assertThat(res.currentPage()).isEqualTo(1);
        assertThat(res.pageSize()).isEqualTo(1);
        assertThat(res.totalPages()).isGreaterThanOrEqualTo(1);
    }

    @Test
    @DisplayName("getExercises: guest khong thay link video demo")
    void getExercisesStripsVideoForGuest() {
        stubThreeLevels();
        Exercise withVideo = systemExercise("Push-up", "HEALTH", "Chest", "Beginner", "EX-001", "ACTIVE", true);
        withVideo.setDemoVideoUrl("https://cdn/video.mp4");
        when(exercises.findAll()).thenReturn(List.of(withVideo));
        when(exercises.findMemberExercisesByEmail(anyString())).thenReturn(List.of());

        PagedExerciseListResponse res = service.getExercises(
                "all", "all", "all", "all", null, null, 1, 50, null);

        assertThat(res.items()).allSatisfy(item -> assertThat(item.demoVideoUrl()).isNull());
    }

    @Test
    @DisplayName("getExercises: bai khong active / bi tu choi -> loai khoi danh sach")
    void getExercisesExcludesInactiveOrRejected() {
        stubThreeLevels();
        when(exercises.findAll()).thenReturn(List.of(
                systemExercise("Hidden", "HEALTH", "Chest", "Beginner", "EX-003", "REJECTED", true),
                systemExercise("Off", "HEALTH", "Chest", "Beginner", "EX-004", "ACTIVE", false)));
        when(exercises.findMemberExercisesByEmail(anyString())).thenReturn(List.of());

        PagedExerciseListResponse res = service.getExercises(
                "all", "all", "all", "all", null, null, 1, 50, EMAIL);

        assertThat(res.items()).extracting(ExerciseListItem::name)
                .doesNotContain("Hidden", "Off");
    }

    @Test
    @DisplayName("getMemberExercises: uy quyen sang getExercises voi source=member")
    void getMemberExercisesDelegatesToGetExercises() {
        stubThreeLevels();
        when(exercises.findAll()).thenReturn(List.of(
                systemExercise("Push-up", "HEALTH", "Chest", "Beginner", "EX-001", "ACTIVE", true)));
        when(exercises.findMemberExercisesByEmail(EMAIL)).thenReturn(List.of(memberExercise("My Push", 11L)));

        PagedExerciseListResponse res = service.getMemberExercises(
                "all", "all", null, null, 1, 50, EMAIL);

        assertThat(res.items()).extracting(ExerciseListItem::name).contains("My Push");
    }

    // --------------------------------------------------------- getExerciseById

    @Test
    @DisplayName("getExerciseById: id null/blank -> tra ve bai mac dinh")
    void getExerciseByIdReturnsDefaultForBlank() {
        stubThreeLevels();
        ExerciseListItem item = service.getExerciseById(null);
        assertThat(item.id()).isEqualTo(999L);
        assertThat(item.name()).isEqualTo("Diamond push-up");

        ExerciseListItem blank = service.getExerciseById("  ");
        assertThat(blank.id()).isEqualTo(999L);
    }

    @Test
    @DisplayName("getExerciseById: id la so -> tra ve bai he thong da publish")
    void getExerciseByIdReturnsPublishedSystemExercise() {
        stubThreeLevels();
        Exercise accepted = systemExercise("Pull-up", "HEALTH", "Back", "Beginner", "EX-005", "ACTIVE", true);
        accepted.setId(77L);
        MuscleGroup back = new MuscleGroup();
        back.setId(2L);
        back.setName("Back");
        ExerciseMuscleGroup link = new ExerciseMuscleGroup();
        link.setMuscleGroup(back);
        accepted.getMuscleGroups().add(link);
        when(exercises.findAcceptedSystemById(77L)).thenReturn(Optional.of(accepted));

        ExerciseListItem item = service.getExerciseById("77");

        assertThat(item.id()).isEqualTo(77L);
        assertThat(item.name()).isEqualTo("Pull-up");
        assertThat(item.equipment()).isEqualTo("Pull-up bar");
    }

    @Test
    @DisplayName("getExerciseById: id khong ton tai -> tra ve bai mac dinh")
    void getExerciseByIdFallsBackToDefault() {
        stubThreeLevels();
        when(exercises.findAcceptedSystemById(404L)).thenReturn(Optional.empty());

        ExerciseListItem item = service.getExerciseById("404");

        assertThat(item.id()).isEqualTo(999L);
    }

    @Test
    @DisplayName("getExerciseById: slug theo ten -> tra ve bai tu seed")
    void getExerciseByIdResolvesSlug() {
        stubThreeLevels();
        when(exercises.findAcceptedSystemById(anyLong())).thenReturn(Optional.empty());

        ExerciseListItem item = service.getExerciseById("jumping-jacks");

        assertThat(item.name()).isEqualTo("Jumping jacks");
    }

    @Test
    @DisplayName("getExerciseById: khop code -> tra ve bai tu seed")
    void getExerciseByIdResolvesCode() {
        stubThreeLevels();
        when(exercises.findAcceptedSystemById(anyLong())).thenReturn(Optional.empty());

        ExerciseListItem item = service.getExerciseById("EX-002");

        assertThat(item.name()).isEqualTo("Mountain climbers");
    }

    @Test
    @DisplayName("getExerciseById: mapping bai DB - uu tien muscle group, equipment theo ten")
    void getExerciseByIdMapsEntityFields() {
        stubThreeLevels();
        Exercise dip = systemExercise("Parallel dips", "HEALTH", "Arms", "Beginner", "EX-006", "ACTIVE", true);
        dip.setId(88L);
        dip.setDefaultSets(null);
        dip.setDefaultReps(null);
        dip.setInstructions(null);
        dip.setExecutionSteps("Buoc 1: giam nhip");
        MuscleGroup chest = new MuscleGroup();
        chest.setId(1L);
        chest.setName("Chest");
        ExerciseMuscleGroup link = new ExerciseMuscleGroup();
        link.setMuscleGroup(chest);
        dip.getMuscleGroups().add(link);
        when(exercises.findAcceptedSystemById(88L)).thenReturn(Optional.of(dip));

        ExerciseListItem item = service.getExerciseById("88");

        assertThat(item.muscleGroup()).isEqualTo("Chest");
        assertThat(item.sets()).isEqualTo(3);
        assertThat(item.repsOrDuration()).isEqualTo("10 reps");
        assertThat(item.equipment()).isEqualTo("Parallel bars");
        assertThat(item.description()).isEqualTo("Buoc 1: giam nhip");
    }

    @Test
    @DisplayName("getExerciseById: khong co mo ta -> dung mo ta mac dinh")
    void getExerciseByIdUsesFallbackDescription() {
        stubThreeLevels();
        Exercise e = systemExercise("Plain", "HEALTH", "Legs", "Beginner", "EX-007", "ACTIVE", true);
        e.setId(90L);
        e.setInstructions(null);
        e.setExecutionSteps(null);
        when(exercises.findAcceptedSystemById(90L)).thenReturn(Optional.of(e));

        ExerciseListItem item = service.getExerciseById("90");

        assertThat(item.description()).isEqualTo("Standard calisthenics bodyweight exercise.");
    }

    @Test
    @DisplayName("getExerciseById: bai member -> source CUSTOM")
    void getExerciseByIdMemberSourceMapsToCustom() {
        stubThreeLevels();
        Exercise memberEx = memberExercise("My Push", 11L);
        when(exercises.findAcceptedSystemById(11L)).thenReturn(Optional.of(memberEx));

        ExerciseListItem item = service.getExerciseById("11");

        assertThat(item.source()).isEqualTo("CUSTOM");
    }

    // -------------------------------------------------------- createMemberExercise

    @Test
    @DisplayName("createMemberExercise: bai hop le -> luu va gui thong bao cho Content Manager")
    void createMemberExercisePersistsAndNotifies() {
        stubThreeLevels();
        User u = member(5L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        when(levels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", 0, 30, "ACTIVE")));
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> {
            Exercise e = inv.getArgument(0);
            e.setId(321L);
            return e;
        });

        ExerciseListItem item = service.createMemberExercise(
                new CreateMemberExerciseRequest("  My Squat  ", "Legs", "Beginner", "REPS", "  ", 0, "  ", null),
                EMAIL);

        assertThat(item.name()).isEqualTo("My Squat");
        assertThat(item.sets()).isEqualTo(3);
        assertThat(item.repsOrDuration()).isEqualTo("10 reps");
        assertThat(item.equipment()).isEqualTo("Bodyweight");
        assertThat(item.source()).isEqualTo("CUSTOM");
        verify(notifications).notifyContentManagersPendingApproval("My Squat");
        verify(muscleGroups).validate("Legs");
        verify(muscleGroups).assign(any(Exercise.class), eq("Legs"));
    }

    @Test
    @DisplayName("createMemberExercise: reps dang giay -> category HOLD")
    void createMemberExerciseDetectsHoldCategory() {
        stubThreeLevels();
        User u = member(5L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        when(levels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", 0, 30, "ACTIVE")));
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> {
            Exercise e = inv.getArgument(0);
            e.setId(322L);
            return e;
        });

        ExerciseListItem item = service.createMemberExercise(
                new CreateMemberExerciseRequest("Plank Hold", "Core", "Beginner", null, null, 4, "45 sec", "desc"),
                EMAIL);

        assertThat(item.category()).isEqualTo("HOLD");
        assertThat(item.repsOrDuration()).isEqualTo("45 sec");
    }

    @Test
    @DisplayName("createMemberExercise: reps dang phut -> category HOLD")
    void createMemberExerciseDetectsMinutesAsHold() {
        stubThreeLevels();
        User u = member(5L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        when(levels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", 0, 30, "ACTIVE")));
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> {
            Exercise e = inv.getArgument(0);
            e.setId(323L);
            return e;
        });

        ExerciseListItem item = service.createMemberExercise(
                new CreateMemberExerciseRequest("Wall Sit", "Legs", "Beginner", null, null, 3, "2 min", "desc"),
                EMAIL);

        assertThat(item.category()).isEqualTo("HOLD");
    }

    @Test
    @DisplayName("createMemberExercise: khong co ten -> dung ten mac dinh")
    void createMemberExerciseUsesDefaultName() {
        stubThreeLevels();
        User u = member(5L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        when(levels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", 0, 30, "ACTIVE")));
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> {
            Exercise e = inv.getArgument(0);
            e.setId(324L);
            return e;
        });

        ExerciseListItem item = service.createMemberExercise(
                new CreateMemberExerciseRequest(null, "Full body", "Beginner", null, null, 3, "10 reps", null),
                EMAIL);

        assertThat(item.name()).isEqualTo("Untitled Custom Exercise");
    }

    @Test
    @DisplayName("createMemberExercise: user khong ton tai -> 401")
    void createMemberExerciseUnknownUserRejected() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createMemberExercise(
                new CreateMemberExerciseRequest("X", "Chest", "Beginner", null, null, 3, "10 reps", null),
                EMAIL))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    @DisplayName("createMemberExercise: level khong ton tai -> 400")
    void createMemberExerciseUnknownLevelRejected() {
        User u = member(5L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        when(levels.findByNameIgnoreCase("NoSuch")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createMemberExercise(
                new CreateMemberExerciseRequest("X", "Chest", "NoSuch", null, null, 3, "10 reps", null),
                EMAIL))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("createMemberExercise: khong co level nao duoc cau hinh -> 400")
    void createMemberExerciseWithoutConfiguredLevelRejected() {
        User u = member(5L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        when(levels.findAll()).thenReturn(List.of());

        assertThatThrownBy(() -> service.createMemberExercise(
                new CreateMemberExerciseRequest("X", "Chest", null, null, null, 3, "10 reps", null),
                EMAIL))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("createMemberExercise: level dang INACTIVE -> 400")
    void createMemberExerciseInactiveLevelRejected() {
        User u = member(5L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        when(levels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", 0, 30, "INACTIVE")));

        assertThatThrownBy(() -> service.createMemberExercise(
                new CreateMemberExerciseRequest("X", "Chest", "Beginner", null, null, 3, "10 reps", null),
                EMAIL))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    // ------------------------------------------------------------------ helpers

    private void stubThreeLevels() {
        lenient().when(levels.findAll()).thenReturn(List.of(
                level("Beginner", 0, 30, "ACTIVE"),
                level("Intermediate", 30, 60, "ACTIVE"),
                level("Advanced", 60, 100, "ACTIVE")));
    }

    private static Exercise memberExercise(String name, long id) {
        Exercise e = new Exercise();
        e.setId(id);
        e.setCode("CU_" + id);
        e.setName(name);
        e.setType("HEALTH");
        e.setSource("CUSTOM");
        e.setModerationStatus("ACTIVE");
        e.setCategory("REPS");
        e.setLevel("Beginner");
        e.setMuscleGroup("Chest");
        e.setDefaultSets(3);
        e.setDefaultReps(10);
        e.setInstructions("desc");
        return e;
    }
}
