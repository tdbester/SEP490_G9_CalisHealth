package com.calishealth.service;

import com.calishealth.dtos.MemberExerciseFilterRequestDTO;
import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.models.Exercise;
import com.calishealth.models.ExerciseMuscleGroup;
import com.calishealth.models.MemberFavorite;
import com.calishealth.models.MuscleGroup;
import com.calishealth.models.User;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.MemberFavoriteRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho {@link MemberExerciseService}: validate bộ lọc, visibility cộng đồng
 * và các nhánh định dạng thời gian tương đối.
 */
class MemberExerciseServiceCoverageTest {

    private ExerciseRepository exercises;
    private MemberFavoriteRepository favorites;
    private UserRepository users;
    private MemberExerciseService service;

    private static final String EMAIL = "member@example.com";

    @BeforeEach
    void setUp() {
        exercises = mock(ExerciseRepository.class);
        favorites = mock(MemberFavoriteRepository.class);
        users = mock(UserRepository.class);
        service = new MemberExerciseService(exercises, favorites, users);

        User member = new User();
        member.setId(10L);
        member.setEmail(EMAIL);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
    }

    private MemberExerciseFilterRequestDTO filter(String tab, String sortBy, int page, int size) {
        MemberExerciseFilterRequestDTO dto = new MemberExerciseFilterRequestDTO();
        dto.setTab(tab);
        dto.setSortBy(sortBy);
        dto.setPage(page);
        dto.setSize(size);
        return dto;
    }

    private Exercise memberExercise(Long id) {
        User author = new User();
        author.setId(20L);
        author.setFullName("Author " + id);
        Exercise exercise = new Exercise();
        exercise.setId(id);
        exercise.setCode("CU_" + id);
        exercise.setSystem(false);
        exercise.setName("Community " + id);
        exercise.setDescription("desc");
        exercise.setLevel("Beginner");
        exercise.setStatus(Exercise.EntryStatus.ACCEPTED.name());
        exercise.setModerationStatus("ACCEPTED");
        exercise.setShareWithCommunity(true);
        exercise.setAuthor(author);
        exercise.setCreatedAt(LocalDateTime.now());
        return exercise;
    }

    @Test
    @DisplayName("getMemberExercises: filter null -> nem 400")
    void nullFilterIsRejected() {
        assertThatThrownBy(() -> service.getMemberExercises(null, EMAIL))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("getMemberExercises: tab sai -> nem 400")
    void invalidTabIsRejected() {
        assertThatThrownBy(() -> service.getMemberExercises(filter("OTHER", "NEWEST", 0, 10), EMAIL))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Tab must be");
    }

    @Test
    @DisplayName("getMemberExercises: sortBy sai -> nem 400")
    void invalidSortIsRejected() {
        assertThatThrownBy(() -> service.getMemberExercises(filter("COMMUNITY", "RANDOM", 0, 10), EMAIL))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("sortBy must be");
    }

    @Test
    @DisplayName("getMemberExercises: page/size sai -> nem 400")
    void invalidPagingIsRejected() {
        assertThatThrownBy(() -> service.getMemberExercises(filter("COMMUNITY", "NEWEST", -1, 10), EMAIL))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> service.getMemberExercises(filter("COMMUNITY", "NEWEST", 0, 0), EMAIL))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> service.getMemberExercises(filter("COMMUNITY", "NEWEST", 0, 101), EMAIL))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("getMemberExercises: member khong ton tai -> 401")
    void unknownMemberIsRejected() {
        when(users.findByEmail("ghost@x.vn")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getMemberExercises(filter("COMMUNITY", "NEWEST", 0, 10), "ghost@x.vn"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    @DisplayName("getMemberExercises: sap xep theo MOST_SAVED / OLDEST / NEWEST")
    void supportsAllSortModes() {
        when(exercises.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        service.getMemberExercises(filter("COMMUNITY", "MOST_SAVED", 0, 10), EMAIL);
        service.getMemberExercises(filter("COMMUNITY", "OLDEST", 0, 10), EMAIL);
        service.getMemberExercises(filter("MY_SUBMISSIONS", "NEWEST", 0, 10), EMAIL);

        var captor = org.mockito.ArgumentCaptor.forClass(Pageable.class);
        verify(exercises, org.mockito.Mockito.times(3))
                .findAll(any(org.springframework.data.jpa.domain.Specification.class), captor.capture());
        assertThat(captor.getAllValues().get(0).getSort().getOrderFor("saveCount")).isNotNull();
        assertThat(captor.getAllValues().get(1).getSort().getOrderFor("createdAt").getDirection())
                .isEqualTo(org.springframework.data.domain.Sort.Direction.ASC);
    }

    @Test
    @DisplayName("getMemberExercises: trang rong -> khong goi favorites")
    void emptyPageSkipsFavoriteLookup() {
        when(exercises.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        var result = service.getMemberExercises(filter("COMMUNITY", "NEWEST", 0, 10), EMAIL);

        assertThat(result.content()).isEmpty();
        verify(favorites, never()).findAllByMemberIdAndItemTypeIn(anyLong(), anyCollection());
    }

    @Test
    @DisplayName("getMemberExercises: bai da luu -> isSaved = true")
    void savedItemsAreFlagged() {
        Exercise exercise = memberExercise(31L);
        when(exercises.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(exercise)));
        MemberFavorite favorite = new MemberFavorite();
        favorite.setItemId(31L);
        when(favorites.findAllByMemberIdAndItemTypeIn(eq(10L), anyCollection()))
                .thenReturn(List.of(favorite));

        var result = service.getMemberExercises(filter("COMMUNITY", "NEWEST", 0, 10), EMAIL);

        assertThat(result.content().get(0).isSavedByCurrentMember()).isTrue();
        assertThat(result.content().get(0).authorName()).isEqualTo("Author 31");
        assertThat(result.content().get(0).saveCount()).isZero();
    }

    @Test
    @DisplayName("getMemberExerciseDetail: bai he thong -> 404")
    void systemExerciseIsHidden() {
        Exercise exercise = memberExercise(41L);
        exercise.setSystem(true);
        when(exercises.findById(41L)).thenReturn(Optional.of(exercise));

        assertThatThrownBy(() -> service.getMemberExerciseDetail(41L, EMAIL))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("getMemberExerciseDetail: moderation chua duyet -> 404")
    void pendingExerciseIsHidden() {
        Exercise exercise = memberExercise(42L);
        exercise.setModerationStatus("PENDING");
        when(exercises.findById(42L)).thenReturn(Optional.of(exercise));

        assertThatThrownBy(() -> service.getMemberExerciseDetail(42L, EMAIL))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("getMemberExerciseDetail: moderation ACTIVE -> duoc xem")
    void activeModerationIsVisible() {
        Exercise exercise = memberExercise(43L);
        exercise.setModerationStatus("ACTIVE");
        when(exercises.findById(43L)).thenReturn(Optional.of(exercise));

        assertThat(service.getMemberExerciseDetail(43L, EMAIL).id()).isEqualTo(43L);
    }

    @Test
    @DisplayName("getMemberExerciseDetail: khong chia se cong dong -> chi chinh tac gia")
    void privateExerciseOnlyVisibleToAuthor() {
        Exercise exercise = memberExercise(44L);
        exercise.setShareWithCommunity(false);
        when(exercises.findById(44L)).thenReturn(Optional.of(exercise));

        assertThatThrownBy(() -> service.getMemberExerciseDetail(44L, EMAIL))
                .isInstanceOf(ResourceNotFoundException.class);

        // Chính tác giả vẫn xem được bài của mình.
        when(exercises.findById(44L)).thenAnswer(i -> {
            exercise.getAuthor().setId(10L);
            return Optional.of(exercise);
        });
        assertThat(service.getMemberExerciseDetail(44L, EMAIL).id()).isEqualTo(44L);
    }

    @Test
    @DisplayName("getMemberExerciseDetail: khong co guideSteps -> dung guide")
    void detailFallsBackToGuideField() {
        Exercise exercise = memberExercise(45L);
        exercise.setGuideSteps(null);
        exercise.setGuide("Step A\n\nStep B");
        when(exercises.findById(45L)).thenReturn(Optional.of(exercise));

        assertThat(service.getMemberExerciseDetail(45L, EMAIL).guideSteps())
                .containsExactly("Step A", "Step B");
    }

    @Test
    @DisplayName("getMemberExerciseDetail: khong co huong dan -> danh sach rong")
    void detailWithoutGuideHasNoSteps() {
        Exercise exercise = memberExercise(46L);
        exercise.setGuideSteps("  ");
        exercise.setGuide(null);
        when(exercises.findById(46L)).thenReturn(Optional.of(exercise));

        assertThat(service.getMemberExerciseDetail(46L, EMAIL).guideSteps()).isEmpty();
    }

    @Test
    @DisplayName("getMemberExerciseDetail: nhom co co rong -> dung danh sach lien ket")
    void detailFallsBackToMuscleGroupLinks() {
        Exercise exercise = memberExercise(47L);
        exercise.setMuscleGroup(null);
        MuscleGroup chest = new MuscleGroup();
        chest.setName("Chest");
        ExerciseMuscleGroup link = new ExerciseMuscleGroup();
        link.setExercise(exercise);
        link.setMuscleGroup(chest);
        exercise.setMuscleGroups(List.of(link));
        when(exercises.findById(47L)).thenReturn(Optional.of(exercise));

        assertThat(service.getMemberExerciseDetail(47L, EMAIL).targetMuscle()).isEqualTo("Chest");
    }

    @Test
    @DisplayName("getMemberExerciseDetail: khong co nhom co co -> null")
    void detailWithoutMuscleGroupIsNull() {
        Exercise exercise = memberExercise(48L);
        exercise.setMuscleGroup(null);
        exercise.setMuscleGroups(List.of());
        when(exercises.findById(48L)).thenReturn(Optional.of(exercise));

        assertThat(service.getMemberExerciseDetail(48L, EMAIL).targetMuscle()).isNull();
    }

    @Test
    @DisplayName("timeAgo: dinh dang day du cac don vi")
    void relativeTimeFormatting() {
        Exercise exercise = memberExercise(50L);
        when(exercises.findById(50L)).thenReturn(Optional.of(exercise));

        exercise.setCreatedAt(null);
        assertThat(service.getMemberExerciseDetail(50L, EMAIL).postedTimeAgo()).isEqualTo("Unknown");

        exercise.setCreatedAt(LocalDateTime.now().minusSeconds(10));
        assertThat(service.getMemberExerciseDetail(50L, EMAIL).postedTimeAgo()).isEqualTo("Just now");

        exercise.setCreatedAt(LocalDateTime.now().minusMinutes(1));
        assertThat(service.getMemberExerciseDetail(50L, EMAIL).postedTimeAgo()).isEqualTo("1 minute ago");

        exercise.setCreatedAt(LocalDateTime.now().minusMinutes(30));
        assertThat(service.getMemberExerciseDetail(50L, EMAIL).postedTimeAgo()).isEqualTo("30 minutes ago");

        exercise.setCreatedAt(LocalDateTime.now().minusHours(1));
        assertThat(service.getMemberExerciseDetail(50L, EMAIL).postedTimeAgo()).isEqualTo("1 hour ago");

        exercise.setCreatedAt(LocalDateTime.now().minusHours(5));
        assertThat(service.getMemberExerciseDetail(50L, EMAIL).postedTimeAgo()).isEqualTo("5 hours ago");

        exercise.setCreatedAt(LocalDateTime.now().minusDays(1));
        assertThat(service.getMemberExerciseDetail(50L, EMAIL).postedTimeAgo()).isEqualTo("1 day ago");

        exercise.setCreatedAt(LocalDateTime.now().minusDays(3));
        assertThat(service.getMemberExerciseDetail(50L, EMAIL).postedTimeAgo()).isEqualTo("3 days ago");

        exercise.setCreatedAt(LocalDateTime.now().minusDays(7));
        assertThat(service.getMemberExerciseDetail(50L, EMAIL).postedTimeAgo()).isEqualTo("1 week ago");

        exercise.setCreatedAt(LocalDateTime.now().minusDays(20));
        assertThat(service.getMemberExerciseDetail(50L, EMAIL).postedTimeAgo()).isEqualTo("2 weeks ago");

        exercise.setCreatedAt(LocalDateTime.now().minusDays(45));
        assertThat(service.getMemberExerciseDetail(50L, EMAIL).postedTimeAgo()).isEqualTo("1 month ago");

        exercise.setCreatedAt(LocalDateTime.now().minusDays(120));
        assertThat(service.getMemberExerciseDetail(50L, EMAIL).postedTimeAgo()).isEqualTo("4 months ago");

        exercise.setCreatedAt(LocalDateTime.now().minusDays(400));
        assertThat(service.getMemberExerciseDetail(50L, EMAIL).postedTimeAgo()).isEqualTo("1 year ago");

        exercise.setCreatedAt(LocalDateTime.now().plusDays(1));
        assertThat(service.getMemberExerciseDetail(50L, EMAIL).postedTimeAgo()).isEqualTo("Just now");
    }

    @Test
    @DisplayName("level rong -> null")
    void blankLevelBecomesNull() {
        Exercise exercise = memberExercise(51L);
        exercise.setLevel("  ");
        when(exercises.findById(51L)).thenReturn(Optional.of(exercise));

        assertThat(service.getMemberExerciseDetail(51L, EMAIL).level()).isNull();
    }
}
