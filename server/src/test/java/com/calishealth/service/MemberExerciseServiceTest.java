package com.calishealth.service;

import com.calishealth.dtos.MemberExerciseFilterRequestDTO;
import com.calishealth.models.Exercise;
import com.calishealth.models.ExerciseMuscleGroup;
import com.calishealth.models.MemberFavorite;
import com.calishealth.models.MuscleGroup;
import com.calishealth.models.User;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.MemberFavoriteRepository;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MemberExerciseServiceTest {
    private ExerciseRepository exercises;
    private MemberFavoriteRepository favorites;
    private UserRepository users;
    private MemberExerciseService service;

    @BeforeEach
    void setUp() {
        exercises = mock(ExerciseRepository.class);
        favorites = mock(MemberFavoriteRepository.class);
        users = mock(UserRepository.class);
        service = new MemberExerciseService(exercises, favorites, users);
    }

    @Test
    void mapsCommunityExerciseWithSavedStateAndRelativePostTime() {
        User member = new User();
        member.setId(10L);
        when(users.findByEmail("member@example.com")).thenReturn(Optional.of(member));

        User author = new User();
        author.setFullName("Exercise Author");
        Exercise exercise = new Exercise();
        exercise.setId(25L);
        exercise.setSystem(false);
        exercise.setName("Community push-up");
        exercise.setLevel("Intermediate");
        exercise.setMuscleGroup("Chest, triceps");
        exercise.setDefaultSets(3);
        exercise.setDefaultReps(8);
        exercise.setAuthor(author);
        exercise.setCreatedAt(LocalDateTime.now().minusDays(2));
        exercise.setSaveCount(11);
        exercise.setStatus(Exercise.EntryStatus.ACCEPTED);
        when(exercises.findAll(any(org.springframework.data.jpa.domain.Specification.class),
                any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(exercise), PageRequest.of(0, 6), 1));
        when(favorites.findAllByMemberIdAndItemTypeIn(eq(10L), anyCollection()))
                .thenReturn(List.of(favorite(25L)));

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

    @Test
    void mapsAcceptedCommunityExerciseDetailForMember() {
        User member = new User();
        member.setId(10L);
        when(users.findByEmail("member@example.com")).thenReturn(Optional.of(member));

        User author = new User();
        author.setFullName("Exercise Author");
        Exercise exercise = new Exercise();
        exercise.setId(25L);
        exercise.setSystem(false);
        exercise.setName("Community push-up");
        exercise.setDescription("A controlled push-up variation.");
        exercise.setLevel("Intermediate");
        exercise.setMuscleGroup("Chest, triceps");
        exercise.setDefaultSets(3);
        exercise.setDefaultReps(8);
        exercise.setEquipment("Bodyweight");
        exercise.setGuideSteps("Set your hands.\nBrace your core.");
        exercise.setAuthor(author);
        exercise.setCreatedAt(LocalDateTime.now().minusDays(2));
        exercise.setSaveCount(11);
        exercise.setStatus(Exercise.EntryStatus.ACCEPTED);
        exercise.setShareWithCommunity(true);
        when(exercises.findById(25L)).thenReturn(Optional.of(exercise));
        when(favorites.existsByMemberIdAndItemTypeAndItemId(
                10L, MemberFavorite.ItemType.MEMBER_EXERCISE, 25L)).thenReturn(false);

        var result = service.getMemberExerciseDetail(25L, "member@example.com");

        assertThat(result.id()).isEqualTo(25L);
        assertThat(result.title()).isEqualTo("Community push-up");
        assertThat(result.level()).isEqualTo("Intermediate");
        assertThat(result.targetMuscle()).isEqualTo("Chest, triceps");
        assertThat(result.equipment()).isEqualTo("Bodyweight");
        assertThat(result.guideSteps()).containsExactly("Set your hands.", "Brace your core.");
        assertThat(result.authorName()).isEqualTo("Exercise Author");
        assertThat(result.postedTimeAgo()).isEqualTo("2 days ago");
        assertThat(result.saveCount()).isEqualTo(11);
        assertThat(result.isSavedByCurrentMember()).isFalse();
        assertThat(result.status()).isEqualTo("ACCEPTED");
    }

    @Test
    void mapsMuscleGroupsFromLinksWhenLegacyTextFieldIsEmpty() {
        User member = new User();
        member.setId(10L);
        when(users.findByEmail("member@example.com")).thenReturn(Optional.of(member));

        Exercise exercise = new Exercise();
        exercise.setId(26L);
        exercise.setSystem(false);
        exercise.setName("Community pull-up");
        exercise.setStatus(Exercise.EntryStatus.ACCEPTED);
        exercise.setShareWithCommunity(true);

        MuscleGroup back = new MuscleGroup();
        back.setName("Back");
        MuscleGroup biceps = new MuscleGroup();
        biceps.setName("Biceps");
        ExerciseMuscleGroup backLink = new ExerciseMuscleGroup();
        backLink.setExercise(exercise);
        backLink.setMuscleGroup(back);
        ExerciseMuscleGroup bicepsLink = new ExerciseMuscleGroup();
        bicepsLink.setExercise(exercise);
        bicepsLink.setMuscleGroup(biceps);
        exercise.setMuscleGroups(List.of(backLink, bicepsLink));

        when(exercises.findById(26L)).thenReturn(Optional.of(exercise));

        var result = service.getMemberExerciseDetail(26L, "member@example.com");

        assertThat(result.targetMuscle()).isEqualTo("Back, Biceps");
    }

    private MemberFavorite favorite(Long exerciseId) {
        MemberFavorite favorite = new MemberFavorite();
        favorite.setMemberId(10L);
        favorite.setItemType(MemberFavorite.ItemType.MEMBER_EXERCISE);
        favorite.setItemId(exerciseId);
        return favorite;
    }
}
