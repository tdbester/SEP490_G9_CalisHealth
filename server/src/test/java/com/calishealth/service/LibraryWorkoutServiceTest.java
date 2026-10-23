package com.calishealth.service;

import com.calishealth.dtos.CreateUpdateWorkoutRequestDTO;
import com.calishealth.dtos.WorkoutItemDTO;
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
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
                        new WorkoutItemDTO(10L, 0, 2, 10, null, "REPS", 30),
                        new WorkoutItemDTO(20L, 1, 2, null, 20, "SECONDS", 60)));

        var response = service.createWorkout(member.getEmail(), request);

        assertEquals(4, response.totalSets());
        assertEquals(4, response.estimatedDuration());
        assertEquals("ADVANCED", response.level());

        ArgumentCaptor<WorkoutEntry> workoutCaptor = ArgumentCaptor.forClass(WorkoutEntry.class);
        verify(workouts, times(2)).saveAndFlush(workoutCaptor.capture());
        WorkoutEntry saved = workoutCaptor.getValue();
        assertEquals(4, saved.getTotalSets());
        assertEquals(4, saved.getEstimatedDuration());
        assertEquals("ADVANCED", saved.getLevel());
    }
}
