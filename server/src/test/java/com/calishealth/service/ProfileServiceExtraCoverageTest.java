package com.calishealth.service;

import com.calishealth.dtos.ProfileDtos.ProfileResponse;
import com.calishealth.dtos.ProfileDtos.UpdateProfileRequest;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.MemberProfile;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.AssessmentAnswerRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.UserActivityRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Bo sung coverage cho cac nhanh chua duoc kiem tra cua {@link ProfileService}. */
class ProfileServiceExtraCoverageTest {
    private UserRepository users;
    private MemberProfileRepository memberProfiles;
    private FitnessLevelRepository fitnessLevels;
    private AssessmentAnswerRepository answers;
    private ProfileAvatarStorageService avatars;
    private MediaRegistryService registry;
    private PasswordEncoder encoder;
    private UserActivityRepository activity;
    private MemberFitnessLevelService fitnessLevelsService;
    private ProfileService service;

    private static final String EMAIL = "member@example.test";

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        memberProfiles = mock(MemberProfileRepository.class);
        fitnessLevels = mock(FitnessLevelRepository.class);
        answers = mock(AssessmentAnswerRepository.class);
        avatars = mock(ProfileAvatarStorageService.class);
        registry = mock(MediaRegistryService.class);
        encoder = mock(PasswordEncoder.class);
        activity = mock(UserActivityRepository.class);
        fitnessLevelsService = mock(MemberFitnessLevelService.class);
        service = new ProfileService(users, memberProfiles, fitnessLevels, answers, avatars,
                registry, encoder, activity, fitnessLevelsService);
    }

    private static User member() {
        User user = new User();
        user.setId(42L);
        user.setEmail(EMAIL);
        user.setFullName("Nguyen Van A");
        user.setRole(UserRole.MEMBER);
        user.setEnabled(true);
        user.setCreatedAt(LocalDateTime.of(2026, 1, 1, 0, 0));
        return user;
    }

    private static MemberProfile profile(User user) {
        MemberProfile profile = new MemberProfile();
        profile.setId(7L);
        profile.setUser(user);
        profile.setGender("Male");
        profile.setDaysPerWeek(3);
        return profile;
    }

    private void stub(User user) {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(answers.findLatestAnswerValues(anyLong(), anyString())).thenReturn(List.of());
        when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());
    }

    @Test
    @DisplayName("normaliseGender: 'Other / prefer not to say' -> Other")
    void normaliseGenderMapsLegacyOtherLabel() {
        assertEquals("Other", ProfileService.normaliseGender("Other / prefer not to say"));
    }

    @Test
    @DisplayName("normaliseGender: 'prefer ...' -> Prefer not to say")
    void normaliseGenderMapsPreferLabel() {
        assertEquals("Prefer not to say", ProfileService.normaliseGender("Prefer not to say"));
    }

    @Test
    @DisplayName("normaliseGender: chuoi la -> Prefer not to say")
    void normaliseGenderFallsBackForUnknownValue() {
        assertEquals("Prefer not to say", ProfileService.normaliseGender("khong xac dinh"));
    }

    @Test
    @DisplayName("memberSummary: loi khi tinh rank -> rank null, khong nem loi")
    void memberSummarySurvivesLevelLookupFailure() {
        User user = member();
        MemberProfile p = profile(user);
        FitnessLevel level = new FitnessLevel();
        level.setName("Ghost");
        p.setFitnessLevel(level);
        stub(user);
        when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(p));
        // The first findAll() call happens inside levelRank() (wrapped in try/catch),
        // the second one happens in build() for the level dropdown.
        when(fitnessLevels.findAll(any(Sort.class)))
                .thenThrow(new RuntimeException("level table missing"))
                .thenReturn(List.of());

        ProfileResponse response = service.get(EMAIL);

        assertNull(response.member().levelRank());
        assertEquals("Ghost", response.member().levelName());
    }

    @Test
    @DisplayName("memberSummary: khong co profile -> dong so lieu mac dinh")
    void memberSummaryUsesDefaultsWithoutProfile() {
        User user = member();
        stub(user);
        when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.empty());

        ProfileResponse response = service.get(EMAIL);

        assertEquals(0, response.member().streakDays());
        assertEquals(0, response.member().longestStreak());
        assertEquals(3, response.member().daysPerWeek());
    }

    @Test
    @DisplayName("syncProfile: ngay sinh tuong lai -> 400")
    void updateRejectsFutureDateOfBirth() {
        User user = member();
        stub(user);
        when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(profile(user)));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.update(EMAIL, new UpdateProfileRequest(
                        null, null, null, LocalDate.now().plusDays(1), false, null, null, null, null)));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("syncProfile: ngay sinh qua xa -> 400")
    void updateRejectsTooOldDateOfBirth() {
        User user = member();
        stub(user);
        when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(profile(user)));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.update(EMAIL, new UpdateProfileRequest(
                        null, null, null, LocalDate.now().minusYears(130), false, null, null, null, null)));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("syncProfile: ngay sinh hop le -> luu vao profile")
    void updateStoresValidDateOfBirth() {
        User user = member();
        MemberProfile p = profile(user);
        stub(user);
        when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(p));
        when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(memberProfiles.save(any(MemberProfile.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        LocalDate dob = LocalDate.now().minusYears(25);
        service.update(EMAIL, new UpdateProfileRequest(
                null, null, null, dob, false, null, null, null, null));

        ArgumentCaptor<MemberProfile> captor = ArgumentCaptor.forClass(MemberProfile.class);
        org.mockito.Mockito.verify(memberProfiles).save(captor.capture());
        assertEquals(dob, captor.getValue().getDateOfBirth());
    }

    @Test
    @DisplayName("syncProfile: gender trong -> dung option da chuan hoa")
    void updateStoresNormalisedGender() {
        User user = member();
        MemberProfile p = profile(user);
        stub(user);
        when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(p));
        when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(memberProfiles.save(any(MemberProfile.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.update(EMAIL, new UpdateProfileRequest(
                null, null, "FEMALE", null, false, null, null, null, null));

        ArgumentCaptor<MemberProfile> captor = ArgumentCaptor.forClass(MemberProfile.class);
        org.mockito.Mockito.verify(memberProfiles).save(captor.capture());
        assertEquals("Female", captor.getValue().getGender());
    }

    @Test
    @DisplayName("syncProfile: bio rong -> null")
    void updateClearsBlankBio() {
        User user = member();
        MemberProfile p = profile(user);
        p.setBio("old bio");
        stub(user);
        when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(p));
        when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(memberProfiles.save(any(MemberProfile.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.update(EMAIL, new UpdateProfileRequest(
                null, null, null, null, false, "   ", null, null, null));

        ArgumentCaptor<MemberProfile> captor = ArgumentCaptor.forClass(MemberProfile.class);
        org.mockito.Mockito.verify(memberProfiles).save(captor.capture());
        assertNull(captor.getValue().getBio());
    }

    @Test
    @DisplayName("syncProfile: clearDateOfBirth -> xoa ngay sinh")
    void updateClearsDateOfBirth() {
        User user = member();
        MemberProfile p = profile(user);
        p.setDateOfBirth(LocalDate.now().minusYears(30));
        stub(user);
        when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(p));
        when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(memberProfiles.save(any(MemberProfile.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.update(EMAIL, new UpdateProfileRequest(
                null, null, null, null, true, null, null, null, null));

        ArgumentCaptor<MemberProfile> captor = ArgumentCaptor.forClass(MemberProfile.class);
        org.mockito.Mockito.verify(memberProfiles).save(captor.capture());
        assertNull(captor.getValue().getDateOfBirth());
    }

    @Test
    @DisplayName("surveyAge: json khong hop le -> fallback sang ngay sinh")
    void surveyAgeIgnoresMalformedAnswer() {
        User user = member();
        MemberProfile p = profile(user);
        p.setDateOfBirth(LocalDate.now().minusYears(30));
        stub(user);
        when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(p));
        when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of("not-json"));

        ProfileResponse response = service.get(EMAIL);

        assertTrue(response.age() == 30);
    }

    @Test
    @DisplayName("surveyAge: json rong -> fallback sang ngay sinh")
    void surveyAgeIgnoresBlankAnswer() {
        User user = member();
        MemberProfile p = profile(user);
        p.setDateOfBirth(LocalDate.now().minusYears(30));
        stub(user);
        when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(p));
        when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of("   "));

        ProfileResponse response = service.get(EMAIL);

        assertTrue(response.age() == 30);
    }
}
