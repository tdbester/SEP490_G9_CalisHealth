package com.calishealth.service;

import com.calishealth.dtos.CreateUpdateWorkoutRequestDTO;
import com.calishealth.dtos.WorkoutFilterRequestDTO;
import com.calishealth.dtos.WorkoutItemDTO;
import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.models.ExerciseEntry;
import com.calishealth.models.User;
import com.calishealth.models.WorkoutEntry;
import com.calishealth.repository.ExerciseRepository;
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
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LibraryWorkoutServiceTest {
    @Mock private WorkoutRepository workouts;
    @Mock private ExerciseRepository exercises;
    @Mock private UserRepository users;
    @Mock private JdbcTemplate jdbcTemplate;
    @InjectMocks private LibraryWorkoutService service;

    @Test
    void createWorkoutCalculatesLevelSetsAndDuration() {
        User member = new User();
        member.setId(4L);
        member.setEmail("member@example.test");
        when(users.findByEmail(member.getEmail())).thenReturn(Optional.of(member));

        ExerciseEntry beginner = new ExerciseEntry();
        beginner.setId(10L);
        beginner.setLevel(ExerciseEntry.EntryLevel.BEGINNER);
        ExerciseEntry advanced = new ExerciseEntry();
        advanced.setId(20L);
        advanced.setLevel(ExerciseEntry.EntryLevel.ADVANCED);
        when(exercises.findAll(any(org.springframework.data.jpa.domain.Specification.class)))
                .thenReturn(List.of(beginner, advanced));
        when(workouts.saveAndFlush(any(WorkoutEntry.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(jdbcTemplate.update(anyString(), any(), any(), any(), any(), any(), any(), any(), anyInt()))
                .thenReturn(1);

        CreateUpdateWorkoutRequestDTO request = new CreateUpdateWorkoutRequestDTO(
                "Test workout",
                "Details",
                false,
                List.of(
                        new WorkoutItemDTO(10L, 0, 100, 101, null, "REPS", 120),
                        new WorkoutItemDTO(20L, 1, 2, null, 3601, "SECONDS", 60)));

        var response = service.createWorkout(member.getEmail(), request);

        assertEquals(102, response.totalSets());
        assertEquals(825, response.estimatedDuration());
        assertEquals("ADVANCED", response.level());

        ArgumentCaptor<WorkoutEntry> workoutCaptor = ArgumentCaptor.forClass(WorkoutEntry.class);
        verify(workouts, times(2)).saveAndFlush(workoutCaptor.capture());
        WorkoutEntry saved = workoutCaptor.getValue();
        assertEquals(102, saved.getTotalSets());
        assertEquals(825, saved.getEstimatedDuration());
        assertEquals("ADVANCED", saved.getLevel());
        assertEquals(member, saved.getCreatedBy());
        assertEquals(member.getId(), saved.getAuthorId());
    }

    @Test
    void allowsAddingTheSameExerciseMoreThanOnce() {
        User member = new User();
        member.setId(4L);
        member.setEmail("member@example.test");
        when(users.findByEmail(member.getEmail())).thenReturn(Optional.of(member));

        ExerciseEntry exercise = new ExerciseEntry();
        exercise.setId(10L);
        exercise.setLevel(ExerciseEntry.EntryLevel.BEGINNER);
        when(exercises.findAll(any(org.springframework.data.jpa.domain.Specification.class)))
                .thenReturn(List.of(exercise));
        when(workouts.saveAndFlush(any(WorkoutEntry.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(jdbcTemplate.update(anyString(), any(), any(), any(), any(), any(), any(), any(), anyInt()))
                .thenReturn(1);

        var response = service.createWorkout(member.getEmail(), new CreateUpdateWorkoutRequestDTO(
                "Repeated exercise workout",
                null,
                false,
                List.of(
                        new WorkoutItemDTO(10L, 0, 3, 10, null, "REPS", 30),
                        new WorkoutItemDTO(10L, 1, 2, 8, null, "REPS", 30))));

        assertEquals(5, response.totalSets());
        ArgumentCaptor<WorkoutEntry> workoutCaptor = ArgumentCaptor.forClass(WorkoutEntry.class);
        verify(workouts, times(2)).saveAndFlush(workoutCaptor.capture());
        assertEquals(2, workoutCaptor.getValue().getExercises().size());
        assertEquals(10L, workoutCaptor.getValue().getExercises().get(0).getId());
        assertEquals(10L, workoutCaptor.getValue().getExercises().get(1).getId());
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
        workout.setActive(true);
        workout.setStatus("ACCEPTED");
        workout.setLevel("BEGINNER");
        workout.setTotalSets(9);
        workout.setEstimatedDuration(12);
        ExerciseEntry exercise = new ExerciseEntry();
        exercise.setMuscleGroup("Chest");
        workout.setExercises(List.of(exercise));
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
