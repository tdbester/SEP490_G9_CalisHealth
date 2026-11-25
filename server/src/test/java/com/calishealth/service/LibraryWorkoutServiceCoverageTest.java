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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho {@link LibraryWorkoutService}: duyet xoa workout, phan trang,
 * khoa bai tap, va cac nhanh validate con thieu.
 */
class LibraryWorkoutServiceCoverageTest {

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
        stubLevels();
    }

    private void stubLevels() {
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

    // ------------------------------------------------------------ getSystemWorkouts

    @Test
    @DisplayName("getSystemWorkouts: type khong hop le -> 400")
    void getSystemWorkoutsRejectsInvalidType() {
        assertThatThrownBy(() -> service.getSystemWorkouts(null, "YOGA", new WorkoutFilterRequestDTO()))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("getSystemWorkouts: filter khong hop le -> 400")
    void getSystemWorkoutsRejectsInvalidFilter() {
        assertThatThrownBy(() -> service.getSystemWorkouts(null, "HEALTH", null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("getSystemWorkouts: level khong ton tai -> 400")
    void getSystemWorkoutsRejectsUnknownLevel() {
        WorkoutFilterRequestDTO filter = new WorkoutFilterRequestDTO();
        filter.setLevel("NoSuchLevel");

        assertThatThrownBy(() -> service.getSystemWorkouts(null, "HEALTH", filter))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("getSystemWorkouts: member -> danh dau workout bi khoa")
    void getSystemWorkoutsMarksLockedForMember() {
        User u = member(4L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        Exercise ex = exercise(10L, "Push-up", "Beginner", "Chest");
        WorkoutEntry w = workout(12L, "Health circuit", true);
        w.setExercises(List.of(item(ex, 10, null)));
        when(workouts.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(w)));
        when(unlockService.statesByExercise(4L)).thenReturn(Map.of(10L, ExerciseUnlockService.STATE_LOCKED));

        var result = service.getSystemWorkouts(EMAIL, "HEALTH", new WorkoutFilterRequestDTO());

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).locked()).isTrue();
    }

    @Test
    @DisplayName("getSystemWorkouts: guest -> khong khoa")
    void getSystemWorkoutsGuestHasNoLock() {
        Exercise ex = exercise(10L, "Push-up", "Beginner", "Chest");
        WorkoutEntry w = workout(12L, "Health circuit", true);
        w.setExercises(List.of(item(ex, 10, null)));
        when(workouts.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(w)));

        var result = service.getSystemWorkouts(null, "SKILL", new WorkoutFilterRequestDTO());

        assertThat(result.content().get(0).locked()).isFalse();
        verify(unlockService, never()).statesByExercise(any());
    }

    // ------------------------------------------------------- getSystemWorkoutDetail

    @Test
    @DisplayName("getSystemWorkoutDetail: guest -> 404")
    void getSystemWorkoutDetailRequiresMember() {
        assertThatThrownBy(() -> service.getSystemWorkoutDetail(null, 12L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("getSystemWorkoutDetail: khong tim thay -> 404")
    void getSystemWorkoutDetailNotFound() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        when(workouts.findById(12L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getSystemWorkoutDetail(EMAIL, 12L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("getSystemWorkoutDetail: bai dang khoa -> locked = true")
    void getSystemWorkoutDetailReportsLockedExercises() {
        User u = member(4L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        Exercise ex = exercise(10L, "Push-up", "Beginner", "Chest");
        WorkoutEntry w = workout(12L, "Health circuit", true);
        w.setExercises(List.of(item(ex, 10, null)));
        when(workouts.findById(12L)).thenReturn(Optional.of(w));
        when(unlockService.lockedExerciseIds(eq(List.of(10L)), eq(4L))).thenReturn(Set.of(10L));

        var result = service.getSystemWorkoutDetail(EMAIL, 12L);

        assertThat(result.locked()).isTrue();
        assertThat(result.lockedExerciseNames()).containsExactly("Push-up");
    }

    @Test
    @DisplayName("getSystemWorkoutDetail: bai dung giay -> countBy SECONDS")
    void getSystemWorkoutDetailMapsHoldItem() {
        User u = member(4L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        Exercise ex = exercise(10L, "Plank", "Beginner", "Core");
        WorkoutEntry w = workout(12L, "Core circuit", true);
        w.setExercises(List.of(item(ex, null, 45)));
        when(workouts.findById(12L)).thenReturn(Optional.of(w));
        when(unlockService.lockedExerciseIds(any(), any())).thenReturn(Set.of());

        var result = service.getSystemWorkoutDetail(EMAIL, 12L);

        assertThat(result.locked()).isFalse();
        assertThat(result.exercises().get(0).countBy()).isEqualTo("SECONDS");
        assertThat(result.exercises().get(0).category()).isEqualTo("HOLD");
    }

    // ------------------------------------------------------------- getWorkoutDetail

    @Test
    @DisplayName("getWorkoutDetail: workout khong phai cua member -> 404")
    void getWorkoutDetailRejectsForeignWorkout() {
        User u = member(4L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        WorkoutEntry w = workout(12L, "Mine", false);
        w.setCreatedBy(member(99L));
        when(workouts.findById(12L)).thenReturn(Optional.of(w));

        assertThatThrownBy(() -> service.getWorkoutDetail(EMAIL, 12L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("getWorkoutDetail: workout cua member -> tra ve chi tiet")
    void getWorkoutDetailReturnsOwnedWorkout() {
        User u = member(4L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        Exercise ex = exercise(10L, "Push-up", "Beginner", "Chest");
        WorkoutEntry w = workout(12L, "Mine", false);
        w.setCreatedBy(u);
        w.setExercises(List.of(item(ex, 10, null)));
        when(workouts.findById(12L)).thenReturn(Optional.of(w));

        var result = service.getWorkoutDetail(EMAIL, 12L);

        assertThat(result.title()).isEqualTo("Mine");
        assertThat(result.totalExercises()).isEqualTo(1);
        assertThat(result.exercises().get(0).exerciseTitle()).isEqualTo("Push-up");
        assertThat(result.locked()).isFalse();
    }

    // ------------------------------------------------------ getCommunityWorkoutDetail

    @Test
    @DisplayName("getCommunityWorkoutDetail: workout chua duyet -> 404")
    void getCommunityWorkoutDetailRejectsInactiveModeration() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        WorkoutEntry w = workout(12L, "Community", false);
        w.setSharedWithCommunity(true);
        w.setModerationStatus("PENDING");
        when(workouts.findById(12L)).thenReturn(Optional.of(w));

        assertThatThrownBy(() -> service.getCommunityWorkoutDetail(EMAIL, 12L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("getCommunityWorkoutDetail: workout da duyet -> tra ve chi tiet")
    void getCommunityWorkoutDetailReturnsSharedWorkout() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        WorkoutEntry w = workout(12L, "Community", false);
        w.setSharedWithCommunity(true);
        w.setModerationStatus("ACTIVE");
        when(workouts.findById(12L)).thenReturn(Optional.of(w));

        var result = service.getCommunityWorkoutDetail(EMAIL, 12L);

        assertThat(result.title()).isEqualTo("Community");
    }

    // ------------------------------------------------------ getCommunityWorkouts / my

    @Test
    @DisplayName("getMyWorkouts: member -> tra ve danh sach")
    void getMyWorkoutsReturnsPage() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        WorkoutEntry w = workout(12L, "Mine", false);
        when(workouts.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(w)));

        var result = service.getMyWorkouts(EMAIL, new WorkoutFilterRequestDTO());

        assertThat(result.content()).hasSize(1);
    }

    @Test
    @DisplayName("getCommunityWorkouts: member -> tra ve danh sach")
    void getCommunityWorkoutsReturnsPage() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        WorkoutEntry w = workout(12L, "Community", false);
        when(workouts.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(w)));

        var result = service.getCommunityWorkouts(EMAIL, new WorkoutFilterRequestDTO());

        assertThat(result.content()).hasSize(1);
    }

    @Test
    @DisplayName("getMyWorkouts: member khong ton tai -> 404")
    void getMyWorkoutsRequiresMember() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getMyWorkouts(EMAIL, new WorkoutFilterRequestDTO()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ---------------------------------------------------------------- createWorkout

    @Test
    @DisplayName("createWorkout: items rong -> 400")
    void createWorkoutRejectsEmptyItems() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));

        assertThatThrownBy(() -> service.createWorkout(EMAIL, new CreateUpdateWorkoutRequestDTO(
                "T", "d", "Beginner", "HEALTH", false, List.of())))
                .isInstanceOf(RequestValidationException.class);
    }

    @Test
    @DisplayName("createWorkout: items chua null -> 400")
    void createWorkoutRejectsNullItem() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));

        assertThatThrownBy(() -> service.createWorkout(EMAIL, new CreateUpdateWorkoutRequestDTO(
                "T", "d", "Beginner", "HEALTH", false, java.util.Arrays.asList((WorkoutItemDTO) null))))
                .isInstanceOf(RequestValidationException.class);
    }

    @Test
    @DisplayName("createWorkout: orderIndex trung -> 400")
    void createWorkoutRejectsDuplicateOrderIndex() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));

        assertThatThrownBy(() -> service.createWorkout(EMAIL, new CreateUpdateWorkoutRequestDTO(
                "T", "d", "Beginner", "HEALTH", false, List.of(
                        new WorkoutItemDTO(10L, 0, 3, 10, null, "REPS", 30),
                        new WorkoutItemDTO(20L, 0, 3, 10, null, "REPS", 30)))))
                .isInstanceOf(RequestValidationException.class);
    }

    @Test
    @DisplayName("createWorkout: sets ngoai khoang -> 400")
    void createWorkoutRejectsInvalidSets() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));

        assertThatThrownBy(() -> service.createWorkout(EMAIL, new CreateUpdateWorkoutRequestDTO(
                "T", "d", "Beginner", "HEALTH", false, List.of(
                        new WorkoutItemDTO(10L, 0, 0, 10, null, "REPS", 30)))))
                .isInstanceOf(RequestValidationException.class);
    }

    @Test
    @DisplayName("createWorkout: rest ngoai khoang -> 400")
    void createWorkoutRejectsInvalidRest() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));

        assertThatThrownBy(() -> service.createWorkout(EMAIL, new CreateUpdateWorkoutRequestDTO(
                "T", "d", "Beginner", "HEALTH", false, List.of(
                        new WorkoutItemDTO(10L, 0, 3, 10, null, "REPS", 5)))))
                .isInstanceOf(RequestValidationException.class);
    }

    @Test
    @DisplayName("createWorkout: countBy REPS nhung thieu reps -> 400")
    void createWorkoutRejectsMissingReps() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));

        assertThatThrownBy(() -> service.createWorkout(EMAIL, new CreateUpdateWorkoutRequestDTO(
                "T", "d", "Beginner", "HEALTH", false, List.of(
                        new WorkoutItemDTO(10L, 0, 3, null, null, "REPS", 30)))))
                .isInstanceOf(RequestValidationException.class);
    }

    @Test
    @DisplayName("createWorkout: countBy SECONDS nhung thieu duration -> 400")
    void createWorkoutRejectsMissingDuration() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));

        assertThatThrownBy(() -> service.createWorkout(EMAIL, new CreateUpdateWorkoutRequestDTO(
                "T", "d", "Beginner", "HEALTH", false, List.of(
                        new WorkoutItemDTO(10L, 0, 3, null, null, "SECONDS", 30)))))
                .isInstanceOf(RequestValidationException.class);
    }

    @Test
    @DisplayName("createWorkout: countBy khong hop le -> 400")
    void createWorkoutRejectsInvalidCountBy() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));

        assertThatThrownBy(() -> service.createWorkout(EMAIL, new CreateUpdateWorkoutRequestDTO(
                "T", "d", "Beginner", "HEALTH", false, List.of(
                        new WorkoutItemDTO(10L, 0, 3, 10, null, "TIMES", 30)))))
                .isInstanceOf(RequestValidationException.class);
    }

    @Test
    @DisplayName("createWorkout: bai tap khong duoc phep -> 400")
    void createWorkoutRejectsUnavailableExercise() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        when(exercises.findAll(any(org.springframework.data.jpa.domain.Specification.class)))
                .thenReturn(List.of());

        assertThatThrownBy(() -> service.createWorkout(EMAIL, new CreateUpdateWorkoutRequestDTO(
                "T", "d", "Beginner", "HEALTH", false, List.of(
                        new WorkoutItemDTO(10L, 0, 3, 10, null, "REPS", 30)))))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("createWorkout: level khong ton tai -> 400")
    void createWorkoutRejectsUnknownLevel() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        when(exercises.findAll(any(org.springframework.data.jpa.domain.Specification.class)))
                .thenReturn(List.of(exercise(10L, "Push-up", "Beginner", "Chest")));

        assertThatThrownBy(() -> service.createWorkout(EMAIL, new CreateUpdateWorkoutRequestDTO(
                "T", "d", "NoSuch", "HEALTH", false, List.of(
                        new WorkoutItemDTO(10L, 0, 3, 10, null, "REPS", 30)))))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("createWorkout: level dang INACTIVE -> 400")
    void createWorkoutRejectsInactiveLevel() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        when(exercises.findAll(any(org.springframework.data.jpa.domain.Specification.class)))
                .thenReturn(List.of(exercise(10L, "Push-up", "Beginner", "Chest")));

        assertThatThrownBy(() -> service.createWorkout(EMAIL, new CreateUpdateWorkoutRequestDTO(
                "T", "d", "Advanced", "HEALTH", false, List.of(
                        new WorkoutItemDTO(10L, 0, 3, 10, null, "REPS", 30)))))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("createWorkout: khong chon level -> lay level thap nhat")
    void createWorkoutFallsBackToLowestLevel() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        when(exercises.findAll(any(org.springframework.data.jpa.domain.Specification.class)))
                .thenReturn(List.of(exercise(10L, "Push-up", "Beginner", "Chest")));
        when(workouts.saveAndFlush(any(WorkoutEntry.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        var result = service.createWorkout(EMAIL, new CreateUpdateWorkoutRequestDTO(
                "T", "d", " ", "HEALTH", false, List.of(
                        new WorkoutItemDTO(10L, 0, 3, 10, null, "REPS", 30))));

        assertThat(result.level()).isEqualTo("Beginner");
    }

    @Test
    @DisplayName("createWorkout: thanh cong -> tao code va luu workout")
    void createWorkoutSucceeds() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        when(exercises.findAll(any(org.springframework.data.jpa.domain.Specification.class)))
                .thenReturn(List.of(exercise(10L, "Push-up", "Beginner", "Chest")));
        when(workouts.saveAndFlush(any(WorkoutEntry.class))).thenAnswer(inv -> {
            WorkoutEntry w = inv.getArgument(0);
            w.setId(77L);
            return w;
        });

        var result = service.createWorkout(EMAIL, new CreateUpdateWorkoutRequestDTO(
                "  My workout  ", " desc ", "Beginner", "health", true, List.of(
                        new WorkoutItemDTO(10L, 0, 3, 10, null, "REPS", 30))));

        assertThat(result.title()).isEqualTo("My workout");
        assertThat(result.type()).isEqualTo("HEALTH");
        assertThat(result.isSharedWithCommunity()).isTrue();
        verify(contentNameGuard).assertWorkoutNameNotUsedByExercise("  My workout  ", null);
    }

    // -------------------------------------------------------------- updateWorkout

    @Test
    @DisplayName("updateWorkout: doi ten sang trung ten bai -> 409")
    void updateWorkoutRejectsDuplicateName() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        WorkoutEntry w = workout(12L, "Old name", false);
        w.setCreatedBy(member(4L));
        when(workouts.findById(12L)).thenReturn(Optional.of(w));
        org.mockito.Mockito.doThrow(new ResponseStatusException(HttpStatus.CONFLICT, "Duplicate"))
                .when(contentNameGuard).assertWorkoutNameNotUsedByExercise(anyString(), any());

        assertThatThrownBy(() -> service.updateWorkout(EMAIL, 12L, new CreateUpdateWorkoutRequestDTO(
                "New name", "d", "Beginner", "HEALTH", false, List.of(
                        new WorkoutItemDTO(10L, 0, 3, 10, null, "REPS", 30)))))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("updateWorkout: giu nguyen ten -> khong kiem tra trung ten")
    void updateWorkoutKeepsSameName() {
        User u = member(4L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        WorkoutEntry w = workout(12L, "Old name", false);
        w.setCreatedBy(u);
        when(workouts.findById(12L)).thenReturn(Optional.of(w));
        when(exercises.findAll(any(org.springframework.data.jpa.domain.Specification.class)))
                .thenReturn(List.of(exercise(10L, "Push-up", "Beginner", "Chest")));
        when(workouts.saveAndFlush(any(WorkoutEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        service.updateWorkout(EMAIL, 12L, new CreateUpdateWorkoutRequestDTO(
                "Old name", "d", "Beginner", "HEALTH", false, List.of(
                        new WorkoutItemDTO(10L, 0, 3, 10, null, "REPS", 30))));

        verify(contentNameGuard, never()).assertWorkoutNameNotUsedByExercise(anyString(), any());
    }

    @Test
    @DisplayName("updateWorkout: doi sang level INACTIVE -> 400")
    void updateWorkoutRejectsInactiveLevel() {
        User u = member(4L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        WorkoutEntry w = workout(12L, "Old name", false);
        w.setCreatedBy(u);
        w.setLevel("Beginner");
        when(workouts.findById(12L)).thenReturn(Optional.of(w));
        when(exercises.findAll(any(org.springframework.data.jpa.domain.Specification.class)))
                .thenReturn(List.of(exercise(10L, "Push-up", "Beginner", "Chest")));

        assertThatThrownBy(() -> service.updateWorkout(EMAIL, 12L, new CreateUpdateWorkoutRequestDTO(
                "Old name", "d", "Advanced", "HEALTH", false, List.of(
                        new WorkoutItemDTO(10L, 0, 3, 10, null, "REPS", 30)))))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    // -------------------------------------------------------------- deleteWorkout

    @Test
    @DisplayName("deleteWorkout: xoa workout cua member")
    void deleteWorkoutDeletesOwnedWorkout() {
        User u = member(4L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        WorkoutEntry w = workout(12L, "Mine", false);
        w.setCreatedBy(u);
        when(workouts.findById(12L)).thenReturn(Optional.of(w));

        service.deleteWorkout(EMAIL, 12L);

        verify(workouts).delete(w);
    }

    @Test
    @DisplayName("deleteWorkout: workout khong ton tai -> 404")
    void deleteWorkoutNotFound() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        when(workouts.findById(12L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deleteWorkout(EMAIL, 12L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ------------------------------------------------------- getAvailableExercises

    @Test
    @DisplayName("getAvailableExercises: tra ve danh sach bai duoc phep")
    void getAvailableExercisesReturnsList() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(4L)));
        when(exercises.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(Sort.class)))
                .thenReturn(List.of(exercise(10L, "Push-up", "Beginner", "Chest")));

        var result = service.getAvailableExercises(EMAIL);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).title()).isEqualTo("Push-up");
        assertThat(result.get(0).targetMuscle()).isEqualTo("Chest");
    }

    @Test
    @DisplayName("getAvailableExercises: member khong ton tai -> 404")
    void getAvailableExercisesRequiresMember() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getAvailableExercises(EMAIL))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
