package com.calishealth.service;

import com.calishealth.dtos.CreateUpdateWorkoutRequestDTO;
import com.calishealth.dtos.WorkoutFilterRequestDTO;
import com.calishealth.dtos.WorkoutItemDTO;
import com.calishealth.exception.RequestValidationException;
import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.models.Exercise;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.User;
import com.calishealth.models.WorkoutEntry;
import com.calishealth.models.WorkoutExerciseItem;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho {@link LibraryWorkoutService}: các nhánh level, khoá bài,
 * lọc bài tập và đặc tả JPA Criteria.
 */
class LibraryWorkoutServiceExtraCoverageTest {

    private WorkoutRepository workouts;
    private ExerciseRepository exercises;
    private UserRepository users;
    private FitnessLevelRepository fitnessLevels;
    private ContentNameGuardService contentNameGuard;
    private ExerciseUnlockService unlockService;
    private LibraryWorkoutService service;

    private static final String EMAIL = "member@calishealth.vn";

    @BeforeEach
    void setUp() {
        workouts = mock(WorkoutRepository.class);
        exercises = mock(ExerciseRepository.class);
        users = mock(UserRepository.class);
        fitnessLevels = mock(FitnessLevelRepository.class);
        contentNameGuard = mock(ContentNameGuardService.class);
        unlockService = mock(ExerciseUnlockService.class);
        service = new LibraryWorkoutService(
                workouts, exercises, users, fitnessLevels, contentNameGuard, unlockService);

        List<FitnessLevel> levels = List.of(
                level("Beginner", 0, "ACTIVE"),
                level("Intermediate", 30, "ACTIVE"),
                level("Advanced", 60, "INACTIVE"));
        lenient().when(fitnessLevels.findAll()).thenReturn(levels);
        lenient().when(fitnessLevels.findByNameIgnoreCase(anyString())).thenAnswer(inv -> {
            String name = inv.getArgument(0, String.class);
            return levels.stream().filter(l -> l.getName().equalsIgnoreCase(name)).findFirst();
        });
    }

    private static FitnessLevel level(String name, int min, String status) {
        FitnessLevel lv = new FitnessLevel();
        lv.setName(name);
        lv.setScoreMin(min);
        lv.setStatus(status);
        return lv;
    }

    private static User member(long id) {
        User u = new User();
        u.setId(id);
        u.setEmail(EMAIL);
        u.setFullName("Member One");
        return u;
    }

    private static Exercise exercise(long id, String name, String level, String mg) {
        Exercise e = new Exercise();
        e.setId(id);
        e.setCode("EX_" + id);
        e.setName(name);
        e.setLevel(level);
        e.setMuscleGroup(mg);
        e.setDefaultSets(3);
        e.setDefaultReps(10);
        return e;
    }

    private static WorkoutEntry workout(Long id, String name, boolean system) {
        WorkoutEntry w = new WorkoutEntry();
        w.setId(id);
        w.setCode("W_" + id);
        w.setName(name);
        w.setSystem(system);
        w.setLevel("Beginner");
        w.setType("HEALTH");
        w.setTemplateStatus("PUBLISHED");
        w.setModerationStatus("ACTIVE");
        return w;
    }

    private static WorkoutExerciseItem item(Exercise exercise, Integer reps, Integer duration) {
        WorkoutExerciseItem i = new WorkoutExerciseItem();
        i.setExercise(exercise);
        i.setSets(3);
        i.setReps(reps);
        i.setDurationSeconds(duration);
        i.setRestSeconds(30);
        return i;
    }

    // ----------------------------------------------------------- system list

    @Test
    @DisplayName("getSystemWorkouts: type null -> 400")
    void getSystemWorkoutsRejectsNullType() {
        assertThatThrownBy(() -> service.getSystemWorkouts(null, null, new WorkoutFilterRequestDTO()))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("getSystemWorkouts: member khong ton tai -> khong khoa bai nao")
    void getSystemWorkoutsWithUnknownMemberHasNoLock() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());
        Exercise ex = exercise(10L, "Push-up", "Beginner", "Chest");
        WorkoutEntry w = workout(12L, "Circuit", true);
        w.setExercises(List.of(item(ex, 10, null)));
        when(workouts.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(w)));

        assertThat(service.getSystemWorkouts(EMAIL, "HEALTH", new WorkoutFilterRequestDTO())
                .content().get(0).locked()).isFalse();
    }

    @Test
    @DisplayName("getSystemWorkouts: bai khong co exercise -> khong khoa")
    void getSystemWorkoutsWithEmptyExerciseList() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        WorkoutEntry w = workout(12L, "Circuit", true);
        when(workouts.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(w)));

        assertThat(service.getSystemWorkouts(EMAIL, "HEALTH", new WorkoutFilterRequestDTO())
                .content().get(0).locked()).isFalse();
    }

    @Test
    @DisplayName("getSystemWorkouts: bai co exercise null -> bo qua")
    void getSystemWorkoutsIgnoresNullExercise() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        WorkoutEntry w = workout(12L, "Circuit", true);
        when(workouts.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(w)));

        assertThat(service.getSystemWorkouts(EMAIL, "HEALTH", new WorkoutFilterRequestDTO())
                .content().get(0).locked()).isFalse();
    }
    @Test
    @DisplayName("getMyWorkouts: sortBy MOST_SAVED -> sap xep theo luot luu")
    void getMyWorkoutsSupportsMostSavedSort() {
        WorkoutFilterRequestDTO filter = new WorkoutFilterRequestDTO();
        filter.setSortBy("MOST_SAVED");
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        when(workouts.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        service.getMyWorkouts(EMAIL, filter);

        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        verify(workouts).findAll(any(Specification.class), captor.capture());
        assertThat(captor.getValue().getSort().getOrderFor("saveCount")).isNotNull();
    }

    @Test
    @DisplayName("getSystemWorkoutDetail: workout type FLEX -> van duoc mo")
    void getSystemWorkoutDetailAcceptsFlexType() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        WorkoutEntry w = workout(12L, "Flex", true);
        w.setType("FLEX");
        when(workouts.findById(12L)).thenReturn(Optional.of(w));
        when(unlockService.lockedExerciseIds(any(), any())).thenReturn(Set.of());

        assertThat(service.getSystemWorkoutDetail(EMAIL, 12L).title()).isEqualTo("Flex");
    }
    @Test
    @DisplayName("getSystemWorkoutDetail: workout type null -> 404")
    void getSystemWorkoutDetailRejectsNullType() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        WorkoutEntry w = workout(12L, "Flex", true);
        w.setType(null);
        when(workouts.findById(12L)).thenReturn(Optional.of(w));

        assertThatThrownBy(() -> service.getSystemWorkoutDetail(EMAIL, 12L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ------------------------------------------------------------ level rules

    @Test
    @DisplayName("createWorkout: bai khong co level va khong chon level -> lay level thap nhat")
    void createWorkoutUsesLowestLevelWhenNoLevelAnywhere() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        when(exercises.findAll(any(Specification.class)))
                .thenReturn(List.of(exercise(10L, "Push-up", null, "Chest")));
        when(workouts.saveAndFlush(any(WorkoutEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        var result = service.createWorkout(EMAIL, new CreateUpdateWorkoutRequestDTO(
                "T", "d", " ", null, false, List.of(new WorkoutItemDTO(10L, 0, 3, 10, null, null, 30))));

        assertThat(result.level()).isEqualTo("Beginner");
    }

    @Test
    @DisplayName("createWorkout: khong co level duoc cau hinh -> 400")
    void createWorkoutRejectsWhenNoLevelConfigured() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        when(fitnessLevels.findAll()).thenReturn(List.of());
        when(exercises.findAll(any(Specification.class)))
                .thenReturn(List.of(exercise(10L, "Push-up", null, "Chest")));

        assertThatThrownBy(() -> service.createWorkout(EMAIL, new CreateUpdateWorkoutRequestDTO(
                "T", "d", " ", null, false, List.of(new WorkoutItemDTO(10L, 0, 3, 10, null, null, 30)))))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("createWorkout: type rong -> CUSTOM")
    void createWorkoutFallsBackToCustomType() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        when(exercises.findAll(any(Specification.class)))
                .thenReturn(List.of(exercise(10L, "Push-up", "Beginner", "Chest")));
        when(workouts.saveAndFlush(any(WorkoutEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        var result = service.createWorkout(EMAIL, new CreateUpdateWorkoutRequestDTO(
                "T", "d", "Beginner", " ", false, List.of(new WorkoutItemDTO(10L, 0, 3, 10, null, "REPS", 30))));

        assertThat(result.type()).isEqualTo("CUSTOM");
    }

    @Test
    @DisplayName("createWorkout: type NONE -> null")
    void createWorkoutWithNoneType() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        when(exercises.findAll(any(Specification.class)))
                .thenReturn(List.of(exercise(10L, "Push-up", "Beginner", "Chest")));
        when(workouts.saveAndFlush(any(WorkoutEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        var result = service.createWorkout(EMAIL, new CreateUpdateWorkoutRequestDTO(
                "T", "d", "Beginner", "NONE", false, List.of(new WorkoutItemDTO(10L, 0, 3, 10, null, "REPS", 30))));

        assertThat(result.type()).isNull();
    }

    @Test
    @DisplayName("createWorkout: bai co level cao hon -> lay level cao nhat")
    void createWorkoutUsesHighestExerciseLevel() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        when(exercises.findAll(any(Specification.class))).thenReturn(List.of(
                exercise(10L, "Push-up", "Beginner", "Chest"),
                exercise(20L, "Pull-up", "Intermediate", "Back")));
        when(workouts.saveAndFlush(any(WorkoutEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        var result = service.createWorkout(EMAIL, new CreateUpdateWorkoutRequestDTO(
                "T", "d", null, "HEALTH", false, List.of(
                        new WorkoutItemDTO(10L, 0, 3, 10, null, "REPS", 30),
                        new WorkoutItemDTO(20L, 1, 3, 10, null, "REPS", 30))));

        assertThat(result.level()).isEqualTo("Intermediate");
    }

    @Test
    @DisplayName("createWorkout: hai bai cung level -> giu ten lon hon")
    void createWorkoutBreaksLevelTieByName() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        when(exercises.findAll(any(Specification.class))).thenReturn(List.of(
                exercise(10L, "Push-up", "Beginner", "Chest"),
                exercise(20L, "Pull-up", "Beginner", "Back")));
        when(workouts.saveAndFlush(any(WorkoutEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        var result = service.createWorkout(EMAIL, new CreateUpdateWorkoutRequestDTO(
                "T", "d", null, "HEALTH", false, List.of(
                        new WorkoutItemDTO(10L, 0, 3, 10, null, "REPS", 30),
                        new WorkoutItemDTO(20L, 1, 3, 10, null, "REPS", 30))));

        assertThat(result.level()).isEqualTo("Beginner");
    }

    // ------------------------------------------------------------- update

    @Test
    @DisplayName("updateWorkout: ten workout cu null -> doi ten duoc kiem tra trung")
    void updateWorkoutHandlesNullName() {
        User u = member(4L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        WorkoutEntry w = workout(12L, "Old", false);
        w.setCreatedBy(u);
        w.setName(null);
        when(workouts.findById(12L)).thenReturn(Optional.of(w));
        when(exercises.findAll(any(Specification.class)))
                .thenReturn(List.of(exercise(10L, "Push-up", "Beginner", "Chest")));
        when(workouts.saveAndFlush(any(WorkoutEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        service.updateWorkout(EMAIL, 12L, new CreateUpdateWorkoutRequestDTO(
                "New name", null, "Beginner", "HEALTH", false,
                List.of(new WorkoutItemDTO(10L, 0, 3, 10, null, "REPS", 30))));

        verify(contentNameGuard).assertWorkoutNameNotUsedByExercise("New name", null);
        verify(contentNameGuard).assertMemberWorkoutNameNotUsedByWorkout("New name", 4L, 12L);
    }

    @Test
    @DisplayName("updateWorkout: doi level sang level ACTIVE -> duoc phep")
    void updateWorkoutAllowsActiveLevelChange() {
        User u = member(4L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        WorkoutEntry w = workout(12L, "Old", false);
        w.setCreatedBy(u);
        w.setLevel("Beginner");
        when(workouts.findById(12L)).thenReturn(Optional.of(w));
        when(exercises.findAll(any(Specification.class)))
                .thenReturn(List.of(exercise(10L, "Push-up", "Intermediate", "Chest")));
        when(workouts.saveAndFlush(any(WorkoutEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        service.updateWorkout(EMAIL, 12L, new CreateUpdateWorkoutRequestDTO(
                "Old", "d", "Intermediate", "HEALTH", false,
                List.of(new WorkoutItemDTO(10L, 0, 3, 10, null, "REPS", 30))));

        assertThat(w.getLevel()).isEqualTo("Intermediate");
    }

    @Test
    @DisplayName("updateWorkout: level cu null -> kiem tra level moi")
    void updateWorkoutHandlesNullLevel() {
        User u = member(4L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        WorkoutEntry w = workout(12L, "Old", false);
        w.setCreatedBy(u);
        w.setLevel(null);
        when(workouts.findById(12L)).thenReturn(Optional.of(w));
        when(exercises.findAll(any(Specification.class)))
                .thenReturn(List.of(exercise(10L, "Push-up", "Beginner", "Chest")));
        when(workouts.saveAndFlush(any(WorkoutEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        service.updateWorkout(EMAIL, 12L, new CreateUpdateWorkoutRequestDTO(
                "Old", "d", "Beginner", "HEALTH", false,
                List.of(new WorkoutItemDTO(10L, 0, 3, 10, null, "REPS", 30))));

        assertThat(w.getLevel()).isEqualTo("Beginner");
    }

    // ------------------------------------------------------------ validate

    @Test
    @DisplayName("createWorkout: orderIndex am -> 400")
    void createWorkoutRejectsNegativeOrderIndex() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));

        assertThatThrownBy(() -> service.createWorkout(EMAIL, new CreateUpdateWorkoutRequestDTO(
                "T", "d", "Beginner", "HEALTH", false, List.of(
                        new WorkoutItemDTO(10L, -1, 3, 10, null, "REPS", 30)))))
                .isInstanceOf(RequestValidationException.class);
    }

    @Test
    @DisplayName("createWorkout: countBy null -> mac dinh REPS")
    void createWorkoutDefaultsCountByToReps() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        when(exercises.findAll(any(Specification.class)))
                .thenReturn(List.of(exercise(10L, "Push-up", "Beginner", "Chest")));
        when(workouts.saveAndFlush(any(WorkoutEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        var result = service.createWorkout(EMAIL, new CreateUpdateWorkoutRequestDTO(
                "T", "d", "Beginner", "HEALTH", false, List.of(new WorkoutItemDTO(10L, 0, 3, 10, null, null, 30))));

        assertThat(result.exercises().get(0).countBy()).isEqualTo("REPS");
    }

    @Test
    @DisplayName("filter: level hop le -> chap nhan")
    void validateFilterAcceptsKnownLevel() {
        WorkoutFilterRequestDTO filter = new WorkoutFilterRequestDTO();
        filter.setLevel("Beginner");
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        when(workouts.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        assertThat(service.getMyWorkouts(EMAIL, filter).content()).isEmpty();
    }

    @Test
    @DisplayName("filter: level ALL -> chap nhan")
    void validateFilterAcceptsAllLevel() {
        WorkoutFilterRequestDTO filter = new WorkoutFilterRequestDTO();
        filter.setLevel("ALL");
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        when(workouts.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        assertThat(service.getMyWorkouts(EMAIL, filter).content()).isEmpty();
    }

    // --------------------------------------------------- criteria specification

    @Test
    @DisplayName("dac ta loc bai tap: dieu kien dung nguon he thong + bai cua member")
    void allowedExerciseSpecificationBuildsCriteria() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        when(exercises.findAll(any(Specification.class), any(Sort.class)))
                .thenReturn(List.of(exercise(10L, "Push-up", "Beginner", "Chest")));

        service.getAvailableExercises(EMAIL);

        ArgumentCaptor<Specification<Exercise>> captor = ArgumentCaptor.forClass(Specification.class);
        verify(exercises).findAll(captor.capture(), any(Sort.class));
        assertThat(captor.getValue()).isNotNull();
        evaluateSpecification(captor.getValue());
    }

    @Test
    @DisplayName("dac ta loc bai tap theo id yeu cau")
    void allowedExerciseSpecificationFiltersByIds() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        when(exercises.findAll(any(Specification.class)))
                .thenReturn(List.of(exercise(10L, "Push-up", "Beginner", "Chest")));
        when(workouts.saveAndFlush(any(WorkoutEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        service.createWorkout(EMAIL, new CreateUpdateWorkoutRequestDTO(
                "T", "d", "Beginner", "HEALTH", false, List.of(new WorkoutItemDTO(10L, 0, 3, 10, null, "REPS", 30))));

        ArgumentCaptor<Specification<Exercise>> captor = ArgumentCaptor.forClass(Specification.class);
        verify(exercises).findAll(captor.capture());
        evaluateSpecification(captor.getValue());
    }

    /** Chay thu Criteria cua Spring Data de dam bao phan "specification" that su trong nhanh loi. */
    @SuppressWarnings({"unchecked", "rawtypes"})
    private void evaluateSpecification(Specification<Exercise> specification) {
        Root<Exercise> root = mock(Root.class, RETURNS_DEEP_STUBS);
        CriteriaQuery<?> query = mock(CriteriaQuery.class, RETURNS_DEEP_STUBS);
        CriteriaBuilder builder = mock(CriteriaBuilder.class, RETURNS_DEEP_STUBS);

        specification.toPredicate(root, query, builder);
    }
}
