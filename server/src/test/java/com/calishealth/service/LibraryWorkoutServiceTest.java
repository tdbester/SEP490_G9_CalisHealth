package com.calishealth.service;

import com.calishealth.dtos.CreateUpdateWorkoutRequestDTO;
import com.calishealth.dtos.WorkoutFilterRequestDTO;
import com.calishealth.dtos.WorkoutItemDTO;
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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LibraryWorkoutServiceTest {
    @Mock private WorkoutRepository workouts;
    @Mock private ExerciseRepository exercises;
    @Mock private UserRepository users;
    @Mock private FitnessLevelRepository fitnessLevels;
    @InjectMocks private LibraryWorkoutService service;

    /** Level do Content Manager cấu hình động, nên test dựng sẵn các level trong fitness_levels. */
    private void mockFitnessLevels() {
        FitnessLevel beginner = new FitnessLevel();
        beginner.setId(1L);
        beginner.setName("Beginner");
        beginner.setScoreMin(0);
        beginner.setScoreMax(1);
        FitnessLevel advanced = new FitnessLevel();
        advanced.setId(3L);
        advanced.setName("Advanced");
        advanced.setScoreMin(2);
        advanced.setScoreMax(3);
        List<FitnessLevel> levels = List.of(beginner, advanced);
        lenient().when(fitnessLevels.findAll()).thenReturn(levels);
        lenient().when(fitnessLevels.findByNameIgnoreCase(anyString())).thenAnswer(invocation -> {
            String requested = invocation.getArgument(0, String.class);
            return levels.stream()
                    .filter(level -> level.getName().equalsIgnoreCase(requested))
                    .findFirst();
        });
    }

    @Test
    void createWorkoutCalculatesLevelSetsAndDuration() {
        User member = new User();
        member.setId(4L);
        member.setEmail("member@example.test");
        when(users.findByEmail(member.getEmail())).thenReturn(Optional.of(member));
        mockFitnessLevels();

        Exercise beginner = new Exercise();
        beginner.setId(10L);
        beginner.setLevel("Beginner");
        Exercise advanced = new Exercise();
        advanced.setId(20L);
        advanced.setLevel("Advanced");
        when(exercises.findAll(any(org.springframework.data.jpa.domain.Specification.class)))
                .thenReturn(List.of(beginner, advanced));
        when(workouts.saveAndFlush(any(WorkoutEntry.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        CreateUpdateWorkoutRequestDTO request = new CreateUpdateWorkoutRequestDTO(
                "Test workout",
                "Details",
                null,
                "SKILL",
                false,
                List.of(
                        new WorkoutItemDTO(10L, 0, 100, 101, null, "REPS", 120),
                        new WorkoutItemDTO(20L, 1, 2, null, 3601, "SECONDS", 60)));

        var response = service.createWorkout(member.getEmail(), request);

        assertEquals(102, response.totalSets());
        assertEquals(825, response.estimatedDuration());
        // Level được đưa về đúng tên trong bảng fitness_levels.
        assertEquals("Advanced", response.level());

        ArgumentCaptor<WorkoutEntry> workoutCaptor = ArgumentCaptor.forClass(WorkoutEntry.class);
        verify(workouts, times(2)).saveAndFlush(workoutCaptor.capture());
        WorkoutEntry saved = workoutCaptor.getValue();
        assertEquals(102, saved.getTotalSets());
        assertEquals(825, saved.getEstimatedDuration());
        assertEquals("Advanced", saved.getLevel());
        assertEquals("SKILL", saved.getType());
        assertEquals(member, saved.getCreatedBy());
        assertEquals(member.getId(), saved.getAuthorId());
        assertEquals(2, saved.getExercises().size());
        assertEquals(100, saved.getExercises().get(0).getSets());
        assertEquals(101, saved.getExercises().get(0).getReps());
        assertNull(saved.getExercises().get(0).getDurationSeconds());
        assertEquals(2, saved.getExercises().get(1).getSets());
        assertNull(saved.getExercises().get(1).getReps());
        assertEquals(3601, saved.getExercises().get(1).getDurationSeconds());
    }

    @Test
    void allowsAddingTheSameExerciseMoreThanOnce() {
        User member = new User();
        member.setId(4L);
        member.setEmail("member@example.test");
        when(users.findByEmail(member.getEmail())).thenReturn(Optional.of(member));
        mockFitnessLevels();

        Exercise exercise = new Exercise();
        exercise.setId(10L);
        exercise.setLevel("Beginner");
        when(exercises.findAll(any(org.springframework.data.jpa.domain.Specification.class)))
                .thenReturn(List.of(exercise));
        when(workouts.saveAndFlush(any(WorkoutEntry.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.createWorkout(member.getEmail(), new CreateUpdateWorkoutRequestDTO(
                "Repeated exercise workout",
                null,
                "ADVANCED",
                "NONE",
                false,
                List.of(
                        new WorkoutItemDTO(10L, 0, 3, 10, null, "REPS", 30),
                        new WorkoutItemDTO(10L, 1, 2, 8, null, "REPS", 30))));

        assertEquals(5, response.totalSets());
        assertEquals("Advanced", response.level());
        ArgumentCaptor<WorkoutEntry> workoutCaptor = ArgumentCaptor.forClass(WorkoutEntry.class);
        verify(workouts, times(2)).saveAndFlush(workoutCaptor.capture());
        assertEquals(2, workoutCaptor.getValue().getExercises().size());
        assertEquals("Advanced", workoutCaptor.getValue().getLevel());
        assertNull(workoutCaptor.getValue().getType());
        assertEquals(10L, workoutCaptor.getValue().getExercises().get(0).getExercise().getId());
        assertEquals(10L, workoutCaptor.getValue().getExercises().get(1).getExercise().getId());
    }

    @Test
    void communityWorkoutDetailHidesUnsharedWorkouts() {
        User member = new User();
        member.setId(4L);
        member.setEmail("member@example.test");
        when(users.findByEmail(member.getEmail())).thenReturn(Optional.of(member));

        WorkoutEntry workout = new WorkoutEntry();
        workout.setId(7L);
        workout.setSharedWithCommunity(false);
        when(workouts.findById(7L)).thenReturn(Optional.of(workout));

        assertThrows(
                ResourceNotFoundException.class,
                () -> service.getCommunityWorkoutDetail(member.getEmail(), 7L));
    }

    @Test
    void systemWorkoutListReturnsPagedWorkoutData() {
        User member = new User();
        member.setId(4L);
        member.setEmail("member@example.test");
        when(users.findByEmail(member.getEmail())).thenReturn(Optional.of(member));

        WorkoutEntry workout = new WorkoutEntry();
        workout.setId(12L);
        workout.setName("Health circuit");
        workout.setType("HEALTH");
        workout.setSystem(true);
        workout.setTemplateStatus("PUBLISHED");
        workout.setModerationStatus("ACTIVE");
        workout.setLevel("Beginner");
        workout.setTotalSets(9);
        workout.setEstimatedDuration(12);
        Exercise exercise = new Exercise();
        exercise.setMuscleGroup("Chest");
        WorkoutExerciseItem item = new WorkoutExerciseItem();
        item.setExercise(exercise);
        workout.setExercises(List.of(item));
        when(workouts.findAll(
                any(org.springframework.data.jpa.domain.Specification.class),
                any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(workout), PageRequest.of(0, 6), 1));

        var response = service.getSystemWorkouts(member.getEmail(), "health", new WorkoutFilterRequestDTO());

        assertEquals(1, response.totalElements());
        assertEquals(1, response.content().size());
        assertEquals("Health circuit", response.content().get(0).title());
        assertEquals(9, response.content().get(0).totalSets());
        assertEquals(12, response.content().get(0).estimatedDuration());
        assertEquals("Chest", response.content().get(0).muscleGroup());
    }
}
