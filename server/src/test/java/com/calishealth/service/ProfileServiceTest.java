package com.calishealth.service;

import com.calishealth.dtos.ProfileDtos.ChangeOwnPasswordRequest;
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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Unit test cho {@link ProfileService}. */
@ExtendWith(MockitoExtension.class)
class ProfileServiceTest {
    @Mock private UserRepository users;
    @Mock private MemberProfileRepository memberProfiles;
    @Mock private FitnessLevelRepository fitnessLevels;
    @Mock private AssessmentAnswerRepository answers;
    @Mock private ProfileAvatarStorageService avatars;
    @Mock private MediaRegistryService registry;
    @Mock private PasswordEncoder encoder;
    @Mock private UserActivityRepository activity;
    @Mock private MemberFitnessLevelService fitnessLevelsService;
    @InjectMocks private ProfileService service;

    private static final String EMAIL = "member@example.test";

    private static User user(UserRole role) {
        User user = new User();
        user.setId(42L);
        user.setEmail(EMAIL);
        user.setFullName("Nguyen Van A");
        user.setRole(role);
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

    private static FitnessLevel level(String name, int scoreMin, String status) {
        FitnessLevel level = new FitnessLevel();
        level.setId(1L);
        level.setName(name);
        level.setScoreMin(scoreMin);
        level.setStatus(status);
        return level;
    }

    private void stubMember() {
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(user(UserRole.MEMBER)));
        lenient().when(answers.findLatestAnswerValues(anyLong(), anyString())).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());
    }

    // ------------------------------------------------------------------- get

    @Test
    @DisplayName("get: tra ve thong tin profile cua member")
    void getReturnsMemberProfile() {
        User member = user(UserRole.MEMBER);
        MemberProfile profile = profile(member);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(profile));
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of(level("Beginner", 1, "ACTIVE")));

        ProfileResponse response = service.get(EMAIL);

        assertEquals("USR-00042", response.userCode());
        assertEquals("member", response.username());
        assertEquals("Member", response.roleLabel());
        assertEquals("Male", response.gender());
        assertNotNull(response.member());
        assertEquals(List.of("Beginner"), response.fitnessLevelOptions());
    }

    @Test
    @DisplayName("get: tuoi lay tu cau tra loi khuao sat")
    void getUsesSurveyAge() {
        User member = user(UserRole.MEMBER);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(profile(member)));
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of("30"));
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());

        assertEquals(30, service.get(EMAIL).age());
    }

    @Test
    @DisplayName("get: cau tra loi khong hop le -> dung ngay sinh")
    void getFallsBackToDateOfBirth() {
        User member = user(UserRole.MEMBER);
        MemberProfile p = profile(member);
        p.setDateOfBirth(LocalDate.now().minusYears(40));
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(p));
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of("not-a-number"));
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());

        assertEquals(40, service.get(EMAIL).age());
    }

    @Test
    @DisplayName("get: khong co user -> 401")
    void getRejectsUnknownUser() {
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.get(EMAIL));
        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
    }

    @Test
    @DisplayName("get: staff khong co member summary")
    void getReturnsNoMemberSummaryForStaff() {
        User admin = user(UserRole.ADMIN);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(admin));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.empty());
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());

        ProfileResponse response = service.get(EMAIL);

        assertNull(response.member());
        assertEquals("Administrator", response.roleLabel());
    }

    @Test
    @DisplayName("get: thanh vien chua co profile -> member summary rong")
    void getReturnsEmptyMemberSummaryWhenProfileMissing() {
        User member = user(UserRole.MEMBER);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.empty());
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());

        ProfileResponse response = service.get(EMAIL);

        assertNotNull(response.member());
        assertNull(response.member().levelName());
        assertEquals(3, response.member().daysPerWeek());
    }

    @Test
    @DisplayName("get: level khong tim thay trong thang -> rank null")
    void getReturnsNullRankForUnknownLevel() {
        User member = user(UserRole.MEMBER);
        MemberProfile p = profile(member);
        FitnessLevel current = level("Ghost", 1, "ACTIVE");
        p.setFitnessLevel(current);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(p));
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of(level("Beginner", 1, "ACTIVE")));

        assertNull(service.get(EMAIL).member().levelRank());
    }

    @Test
    @DisplayName("get: level co trong thang -> bang thu tu")
    void getComputesLevelRank() {
        User member = user(UserRole.MEMBER);
        MemberProfile p = profile(member);
        p.setFitnessLevel(level("Intermediate", 4, "ACTIVE"));
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(p));
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of(
                level("Beginner", 1, "ACTIVE"),
                level("Intermediate", 4, "ACTIVE")));

        assertEquals(2, service.get(EMAIL).member().levelRank());
    }

    @Test
    @DisplayName("get: profile khong co level -> rank null")
    void getReturnsNullRankWithoutLevel() {
        User member = user(UserRole.MEMBER);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(profile(member)));
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());

        assertNull(service.get(EMAIL).member().levelRank());
    }

    @Test
    @DisplayName("get: mat thoi han doi mat khauu -> security danh dau tam thoi")
    void getFlagsTemporaryPassword() {
        User member = user(UserRole.MEMBER);
        member.setMustChangePassword(true);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(profile(member)));
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());

        ProfileResponse response = service.get(EMAIL);

        assertTrue(response.security().temporaryPassword());
        assertTrue(response.security().mustChangePassword());
    }

    // ---------------------------------------------------------------- update

    @Test
    @DisplayName("update: doi ten va so dien thoai")
    void updateChangesNameAndPhone() {
        User member = user(UserRole.MEMBER);
        MemberProfile p = profile(member);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(p));
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());
        lenient().when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(memberProfiles.save(any(MemberProfile.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ProfileResponse response = service.update(EMAIL, new UpdateProfileRequest(
                "  Nguyen Van B  ", "0912345678", null, null, false, null, null, null, null));

        assertEquals("Nguyen Van B", response.fullName());
        assertEquals("0912345678", response.phone());
    }

    @Test
    @DisplayName("update: ten rong -> 400")
    void updateRejectsBlankName() {
        User member = user(UserRole.MEMBER);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(profile(member)));
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.update(EMAIL, new UpdateProfileRequest(
                        "   ", null, null, null, false, null, null, null, null)));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("update: so dien thoai rong -> null")
    void updateClearsBlankPhone() {
        User member = user(UserRole.MEMBER);
        member.setPhone("0912345678");
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(profile(member)));
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());
        lenient().when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(memberProfiles.save(any(MemberProfile.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        assertNull(service.update(EMAIL, new UpdateProfileRequest(
                null, "   ", null, null, false, null, null, null, null)).phone());
    }

    @Test
    @DisplayName("update: chua co profile -> tao profile moi")
    void updateCreatesProfileWhenMissing() {
        User member = user(UserRole.MEMBER);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.empty());
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());
        lenient().when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.update(EMAIL, new UpdateProfileRequest(
                null, null, "Female", null, false, "A bio", null, null, null));

        ArgumentCaptor<MemberProfile> captor = ArgumentCaptor.forClass(MemberProfile.class);
        verify(memberProfiles).save(captor.capture());
        assertEquals("Female", captor.getValue().getGender());
        assertEquals("A bio", captor.getValue().getBio());
        assertEquals(member, captor.getValue().getUser());
    }

    @Test
    @DisplayName("update: ngay sinh trong tuong lai -> 400")
    void updateRejectsFutureDateOfBirth() {
        User member = user(UserRole.MEMBER);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(profile(member)));
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());

        assertThrows(ResponseStatusException.class, () -> service.update(EMAIL, new UpdateProfileRequest(
                null, null, null, LocalDate.now().plusDays(1), false, null, null, null, null)));
    }

    @Test
    @DisplayName("update: ngay sinh qua 120 nam -> 400")
    void updateRejectsTooOldDateOfBirth() {
        User member = user(UserRole.MEMBER);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(profile(member)));
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());

        assertThrows(ResponseStatusException.class, () -> service.update(EMAIL, new UpdateProfileRequest(
                null, null, null, LocalDate.now().minusYears(121), false, null, null, null, null)));
    }

    @Test
    @DisplayName("update: clearDateOfBirth -> xoa ngay sinh")
    void updateClearsDateOfBirth() {
        User member = user(UserRole.MEMBER);
        MemberProfile p = profile(member);
        p.setDateOfBirth(LocalDate.now().minusYears(30));
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(p));
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());
        lenient().when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(memberProfiles.save(any(MemberProfile.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ProfileResponse response = service.update(EMAIL, new UpdateProfileRequest(
                null, null, null, null, true, null, null, null, null));

        assertNull(response.dateOfBirth());
    }

    @Test
    @DisplayName("update: doi level fitness -> doi level thanh vien")
    void updateChangesFitnessLevel() {
        User member = user(UserRole.MEMBER);
        MemberProfile p = profile(member);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(p));
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());
        lenient().when(fitnessLevels.findByNameIgnoreCase("Advanced")).thenReturn(Optional.of(level("Advanced", 7, "ACTIVE")));
        lenient().when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(memberProfiles.save(any(MemberProfile.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.update(EMAIL, new UpdateProfileRequest(
                null, null, null, null, false, null, "Advanced", 5, "HEALTH"));

        ArgumentCaptor<FitnessLevel> captor = ArgumentCaptor.forClass(FitnessLevel.class);
        verify(fitnessLevelsService).changeLevel(eq(p), captor.capture());
        assertEquals("Advanced", captor.getValue().getName());
    }

    @Test
    @DisplayName("update: level khong active -> 400")
    void updateRejectsInactiveFitnessLevel() {
        User member = user(UserRole.MEMBER);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(profile(member)));
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());
        lenient().when(fitnessLevels.findByNameIgnoreCase("Advanced")).thenReturn(Optional.of(level("Advanced", 7, "INACTIVE")));
        lenient().when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.update(EMAIL, new UpdateProfileRequest(
                        null, null, null, null, false, null, "Advanced", null, null)));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("update: level khong ton tai -> 400")
    void updateRejectsUnknownFitnessLevel() {
        User member = user(UserRole.MEMBER);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(profile(member)));
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());
        lenient().when(fitnessLevels.findByNameIgnoreCase("Ghost")).thenReturn(Optional.empty());
        lenient().when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        assertThrows(ResponseStatusException.class, () -> service.update(EMAIL, new UpdateProfileRequest(
                null, null, null, null, false, null, "Ghost", null, null)));
    }

    @Test
    @DisplayName("update: staff khong duoc doi level / muc tieu")
    void updateIgnoresFitnessFieldsForStaff() {
        User admin = user(UserRole.ADMIN);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(admin));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(profile(admin)));
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());
        lenient().when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(memberProfiles.save(any(MemberProfile.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.update(EMAIL, new UpdateProfileRequest(
                null, null, null, null, false, null, "Advanced", 5, "HEALTH"));

        verify(fitnessLevelsService, never()).changeLevel(any(), any());
    }

    // -------------------------------------------------------------- avatar

    @Test
    @DisplayName("updateAvatar: luu avatar moi va xoa avatar cu")
    void updateAvatarStoresNewAvatar() {
        User member = user(UserRole.MEMBER);
        member.setAvatarUrl("/media/profile-avatars/old.png");
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(profile(member)));
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());
        MultipartFile file = org.mockito.Mockito.mock(MultipartFile.class);
        lenient().when(file.getOriginalFilename()).thenReturn("avatar.png");
        lenient().when(avatars.store(file)).thenReturn("/media/profile-avatars/new.png");
        lenient().when(avatars.sizeOf("/media/profile-avatars/new.png")).thenReturn(1024L);
        lenient().when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ProfileResponse response = service.updateAvatar(EMAIL, file);

        assertEquals("/media/profile-avatars/new.png", response.avatarUrl());
        verify(avatars).delete("/media/profile-avatars/old.png");
        verify(registry).purgeAvatar("/media/profile-avatars/old.png");
        verify(registry).registerAvatar(eq("/media/profile-avatars/new.png"), eq("avatar.png"), eq(1024L), any(User.class));
    }

    @Test
    @DisplayName("removeAvatar: xoa avatar va dat null")
    void removeAvatarClearsAvatar() {
        User member = user(UserRole.MEMBER);
        member.setAvatarUrl("/media/profile-avatars/old.png");
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(profile(member)));
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());
        lenient().when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        assertNull(service.removeAvatar(EMAIL).avatarUrl());
        verify(avatars).delete("/media/profile-avatars/old.png");
        verify(registry).purgeAvatar("/media/profile-avatars/old.png");
    }

    @Test
    @DisplayName("removeAvatar: khong co user -> 401")
    void removeAvatarRejectsUnknownUser() {
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class, () -> service.removeAvatar(EMAIL));
    }

    // --------------------------------------------------------- changePassword

    @Test
    @DisplayName("changePassword: doi mat khauu thanh cong")
    void changePasswordUpdatesPassword() {
        User member = user(UserRole.MEMBER);
        member.setPassword("encoded-old");
        member.setMustChangePassword(true);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(profile(member)));
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());
        lenient().when(encoder.matches("Old@12345", "encoded-old")).thenReturn(true);
        lenient().when(encoder.matches("New@12345", "encoded-old")).thenReturn(false);
        lenient().when(encoder.encode("New@12345")).thenReturn("encoded-new");
        lenient().when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.changePassword(EMAIL, new ChangeOwnPasswordRequest("Old@12345", "New@12345", "New@12345"));

        assertEquals("encoded-new", member.getPassword());
        assertFalse(member.isMustChangePassword());
        assertNotNull(member.getPasswordChangedAt());
        verify(activity).logEvent(42L, "ACCOUNT", "Password changed from the profile screen", "SUCCESS");
    }

    @Test
    @DisplayName("changePassword: mat khauu hien tai sai -> 400")
    void changePasswordRejectsWrongCurrentPassword() {
        User member = user(UserRole.MEMBER);
        member.setPassword("encoded-old");
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(profile(member)));
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());
        lenient().when(encoder.matches("Wrong@12345", "encoded-old")).thenReturn(false);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.changePassword(EMAIL, new ChangeOwnPasswordRequest("Wrong@12345", "New@12345", "New@12345")));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("changePassword: mat khauu moi trung mat khauu cu -> 400")
    void changePasswordRejectsSamePassword() {
        User member = user(UserRole.MEMBER);
        member.setPassword("encoded-old");
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        lenient().when(memberProfiles.findByUser_Id(42L)).thenReturn(Optional.of(profile(member)));
        lenient().when(answers.findLatestAnswerValues(42L, "AGE")).thenReturn(List.of());
        lenient().when(fitnessLevels.findAll(any(Sort.class))).thenReturn(List.of());
        lenient().when(encoder.matches("Old@12345", "encoded-old")).thenReturn(true);

        assertThrows(ResponseStatusException.class,
                () -> service.changePassword(EMAIL, new ChangeOwnPasswordRequest("Old@12345", "Old@12345", "Old@12345")));
    }

    // ------------------------------------------------------- normaliseGender

    @Test
    @DisplayName("normaliseGender: chuan hoa cac gia tri")
    void normaliseGenderMapsValues() {
        assertNull(ProfileService.normaliseGender(null));
        assertNull(ProfileService.normaliseGender("  "));
        assertEquals("Male", ProfileService.normaliseGender("MALE"));
        assertEquals("Female", ProfileService.normaliseGender("female"));
        assertEquals("Other", ProfileService.normaliseGender("OTHER"));
        assertEquals("Other", ProfileService.normaliseGender("Other / prefer not to say"));
        assertEquals("Prefer not to say", ProfileService.normaliseGender("Prefer not to say"));
        assertEquals("Prefer not to say", ProfileService.normaliseGender("something else"));
    }
}
