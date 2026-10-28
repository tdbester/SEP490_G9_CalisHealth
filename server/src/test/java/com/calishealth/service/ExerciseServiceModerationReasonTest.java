package com.calishealth.service;

import com.calishealth.dtos.ExerciseDtos.ExerciseModerationHistoryResponse;
import com.calishealth.models.Exercise;
import com.calishealth.repository.ExerciseModerationHistoryRepository;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.MuscleGroupRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ExerciseServiceModerationReasonTest {
    private final ExerciseRepository exercises = mock(ExerciseRepository.class);
    private final ExerciseModerationHistoryRepository moderationHistory = mock(ExerciseModerationHistoryRepository.class);
    private final MuscleGroupRepository muscleGroups = mock(MuscleGroupRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final ExerciseVideoStorageService videoStorage = mock(ExerciseVideoStorageService.class);
    private final ExerciseService service = new ExerciseService(
            exercises, moderationHistory, muscleGroups, users, jdbcTemplate, videoStorage
    );

    @Test
    void rejectsStatusUpdateWhenReasonIsBlank() {
        assertThrows(
                ResponseStatusException.class,
                () -> service.updateStatus("HE-REASON-01", false, "  ")
        );
    }

    @Test
    void sendsRejectionReasonToModerationHistory() {
        Exercise exercise = customPendingExercise();
        when(exercises.findByCode(exercise.getCode())).thenReturn(Optional.of(exercise));
        when(exercises.saveAndFlush(exercise)).thenReturn(exercise);

        service.updateStatus(exercise.getCode(), false, "  Unsafe execution form  ");

        verify(moderationHistory).insert(
                eq(exercise.getCode()),
                eq(exercise.getName()),
                eq(exercise.getType()),
                eq(exercise.getCategory()),
                eq(exercise.getDifficultyLevel()),
                eq(exercise.getInstructions()),
                eq(exercise.getCategory()),
                eq(exercise.getExecutionSteps()),
                eq(exercise.getVideoUrl()),
                eq(exercise.getAnatomyImageUrl()),
                eq(null),
                eq("REJECTED"),
                eq("Unsafe execution form")
        );
    }

    @Test
    void receivesRejectionReasonFromApprovalHistory() {
        ExerciseModerationHistoryResponse history = new ExerciseModerationHistoryResponse(
                1L,
                "HE-REASON-01",
                "Community push-up",
                "HEALTH",
                "Chest",
                "Beginner",
                "Description",
                "REPS",
                "Keep your body straight",
                null,
                null,
                "Member One",
                "REJECTED",
                "Unsafe execution form",
                LocalDateTime.of(2026, 10, 28, 10, 0)
        );
        when(moderationHistory.findAll()).thenReturn(List.of(history));

        List<ExerciseModerationHistoryResponse> response = service.findApprovalHistory();

        assertEquals(1, response.size());
        assertEquals("REJECTED", response.get(0).decision());
        assertEquals("Unsafe execution form", response.get(0).rejectionReason());
    }

    private Exercise customPendingExercise() {
        Exercise exercise = new Exercise();
        exercise.setCode("HE-REASON-01");
        exercise.setName("Community push-up");
        exercise.setType("HEALTH");
        exercise.setCategory("REPS");
        exercise.setDifficultyLevel("Beginner");
        exercise.setInstructions("Description");
        exercise.setExecutionSteps("Keep your body straight");
        exercise.setSource(ExerciseService.SOURCE_CUSTOM);
        exercise.setActive(false);
        exercise.setUpdatedAt(LocalDateTime.of(2026, 10, 28, 9, 0));
        return exercise;
    }
}
