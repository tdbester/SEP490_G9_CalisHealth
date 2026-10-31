package com.calishealth.service;

import com.calishealth.dtos.ExerciseDtos.CreateWorkoutRequest;
import com.calishealth.models.Exercise;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.User;
import com.calishealth.models.WorkoutEntry;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkoutServiceTest {
    @Mock private WorkoutRepository workouts;
    @Mock private ExerciseRepository exercises;
    @Mock private UserRepository users;
    @Mock private FitnessLevelRepository fitnessLevels;
    @InjectMocks private WorkoutService service;

    @Test
    void allowsTheSameExerciseMoreThanOnce() {
        User member = new User();
        member.setId(1L);
        member.setEmail("member@example.test");
        when(users.findByEmail(member.getEmail())).thenReturn(Optional.of(member));
        FitnessLevel level = new FitnessLevel();
        level.setName("Beginner");
        when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level));

        Exercise exercise = new Exercise();
        exercise.setCode("PUSH_UP");
        exercise.setName("Push-up");
        exercise.setType(Exercise.EntryType.HEALTH);
        exercise.setLevel(Exercise.EntryLevel.BEGINNER);
        exercise.setMuscleGroup("Chest");
        when(exercises.findAllByCodeIn(List.of("PUSH_UP"))).thenReturn(List.of(exercise));
        when(workouts.save(any(WorkoutEntry.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.create(new CreateWorkoutRequest(
                "Repeated exercises",
                "Workout description",
                60,
                "Beginner",
                List.of("PUSH_UP", "PUSH_UP"),
                null
        ), member.getEmail());

        assertEquals(2, response.exercises().size());
        assertEquals("PUSH_UP", response.exercises().get(0).code());
        assertEquals("PUSH_UP", response.exercises().get(1).code());
        verify(exercises).findAllByCodeIn(List.of("PUSH_UP"));
    }
}
