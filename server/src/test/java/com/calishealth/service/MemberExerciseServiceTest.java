package com.calishealth.service;

import com.calishealth.dtos.MemberExerciseFilterRequestDTO;
import com.calishealth.models.ExerciseEntry;
import com.calishealth.models.MemberSavedExercise;
import com.calishealth.models.User;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.MemberSavedExerciseRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MemberExerciseServiceTest {
    private ExerciseRepository exercises;
    private MemberSavedExerciseRepository savedExercises;
    private UserRepository users;
    private MemberExerciseService service;

    @BeforeEach
    void setUp() {
        exercises = mock(ExerciseRepository.class);
        savedExercises = mock(MemberSavedExerciseRepository.class);
        users = mock(UserRepository.class);
        service = new MemberExerciseService(exercises, savedExercises, users);
    }

    @Test
    void mapsCommunityExerciseWithSavedStateAndRelativePostTime() {
        User member = new User();
        member.setId(10L);
        when(users.findByEmail("member@example.com")).thenReturn(Optional.of(member));

        User author = new User();
        author.setFullName("Exercise Author");
        ExerciseEntry exercise = new ExerciseEntry();
        exercise.setId(25L);
        exercise.setName("Community push-up");
        exercise.setLevel(ExerciseEntry.EntryLevel.INTERMEDIATE);
        exercise.setMuscleGroup("Chest, triceps");
        exercise.setDefaultSets(3);
        exercise.setDefaultReps(8);
        exercise.setAuthor(author);
        exercise.setCreatedAt(LocalDateTime.now().minusDays(2));
        exercise.setSaveCount(11);
        exercise.setStatus(ExerciseEntry.EntryStatus.ACCEPTED);
        when(exercises.findAll(any(org.springframework.data.jpa.domain.Specification.class),
                any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(exercise), PageRequest.of(0, 6), 1));
        MemberSavedExercise saved = new MemberSavedExercise();
        saved.setExerciseId(25L);
        when(savedExercises.findAllByMemberIdAndExerciseIdIn(anyLong(), anyCollection()))
                .thenReturn(List.of(saved));

        MemberExerciseFilterRequestDTO filter = new MemberExerciseFilterRequestDTO();
        var result = service.getMemberExercises(filter, "member@example.com");

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).title()).isEqualTo("Community push-up");
        assertThat(result.content().get(0).level()).isEqualTo("Intermediate");
        assertThat(result.content().get(0).targetMuscle()).isEqualTo("Chest, triceps");
        assertThat(result.content().get(0).defaultSets()).isEqualTo(3);
        assertThat(result.content().get(0).defaultReps()).isEqualTo(8);
        assertThat(result.content().get(0).authorName()).isEqualTo("Exercise Author");
        assertThat(result.content().get(0).authorAvatar()).isNull();
        assertThat(result.content().get(0).postedTimeAgo()).isEqualTo("2 days ago");
        assertThat(result.content().get(0).saveCount()).isEqualTo(11);
        assertThat(result.content().get(0).isSavedByCurrentMember()).isTrue();
        assertThat(result.content().get(0).status()).isEqualTo("ACCEPTED");
        assertThat(result.currentPage()).isZero();
        assertThat(result.pageSize()).isEqualTo(6);
        assertThat(result.totalElements()).isEqualTo(1);
        assertThat(result.totalPages()).isEqualTo(1);
        assertThat(result.hasNext()).isFalse();
        assertThat(result.hasPrevious()).isFalse();
    }
}
