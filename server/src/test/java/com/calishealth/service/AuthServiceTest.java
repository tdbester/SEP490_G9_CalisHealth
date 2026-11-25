package com.calishealth.service;

import com.calishealth.dtos.AuthDtos.AuthResponse;
import com.calishealth.dtos.AuthDtos.ChangePasswordRequest;
import com.calishealth.dtos.AuthDtos.ForgotRequest;
import com.calishealth.dtos.AuthDtos.LoginRequest;
import com.calishealth.dtos.AuthDtos.RegisterRequest;
import com.calishealth.dtos.AuthDtos.ResetRequest;
import com.calishealth.models.AuthToken;
import com.calishealth.models.AuthToken.TokenType;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.TokenRepository;
import com.calishealth.repository.UserActivityRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.security.JwtService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Unit test cho {@link AuthService}. */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
    @Mock private UserRepository users;
    @Mock private TokenRepository tokens;
    @Mock private PasswordEncoder encoder;
    @Mock private JwtService jwt;
    @Mock private EmailService mail;
    @Mock private UserActivityRepository activity;
    @InjectMocks private AuthService service;

    private static final String EMAIL = "member@example.test";

    private static User user(boolean enabled, boolean blocked, boolean mustChange) {
        User user = new User();
        user.setId(1L);
        user.setEmail(EMAIL);
        user.setFullName("Nguyen Van A");
        user.setRole(UserRole.MEMBER);
        user.setEnabled(enabled);
        user.setBlocked(blocked);
        user.setMustChangePassword(mustChange);
        user.setPassword("encoded");
        return user;
    }

    private static AuthToken token(TokenType type, User user, LocalDateTime expiresAt) {
        AuthToken token = new AuthToken();
        token.setId(1L);
        token.setToken("tok-123");
        token.setType(type);
        token.setUser(user);
        token.setExpiresAt(expiresAt);
        return token;
    }

    private void setFrontendUrl() {
        ReflectionTestUtils.setField(service, "frontendUrl", "http://localhost:5173");
    }

    // ------------------------------------------------------------- register

    @Test
    @DisplayName("register: tao tai khoan moi va gui email xac thuc")
    void registerCreatesAccountAndSendsEmail() {
        setFrontendUrl();
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());
        when(encoder.encode("Pass@12345")).thenReturn("encoded");
        lenient().when(tokens.save(any(AuthToken.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.register(new RegisterRequest("Nguyen Van A", EMAIL, "Pass@12345", "Pass@12345"));

        verify(users).save(any(User.class));
        verify(mail).send(eq(EMAIL), anyString(), org.mockito.ArgumentMatchers.contains("verify-email"));
        verify(tokens).deleteByUserAndType(any(User.class), eq(TokenType.VERIFY_EMAIL));
    }

    @Test
    @DisplayName("register: email da ton tai -> 400")
    void registerRejectsExistingEmail() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(user(true, false, false)));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.register(new RegisterRequest("A", EMAIL, "Pass@12345", "Pass@12345")));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("register: email da bi chan -> 400")
    void registerRejectsBlockedEmail() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(user(false, true, false)));

        assertThrows(ResponseStatusException.class,
                () -> service.register(new RegisterRequest("A", EMAIL, "Pass@12345", "Pass@12345")));
    }

    @Test
    @DisplayName("register: email viet hoa -> chuan hoa thanh chu thap")
    void registerNormalisesEmail() {
        setFrontendUrl();
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());
        when(encoder.encode(anyString())).thenReturn("encoded");
        lenient().when(tokens.save(any(AuthToken.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.register(new RegisterRequest("A", "  MEMBER@EXAMPLE.TEST ", "Pass@12345", "Pass@12345"));

        verify(users).findByEmail(EMAIL);
    }

    // --------------------------------------------------- email verification

    @Test
    @DisplayName("checkEmailVerificationToken: token hop le -> khong loi")
    void checkEmailVerificationTokenAcceptsValidToken() {
        when(tokens.findByTokenAndType("tok-123", TokenType.VERIFY_EMAIL))
                .thenReturn(Optional.of(token(TokenType.VERIFY_EMAIL, user(false, false, false),
                        LocalDateTime.now().plusHours(1))));

        service.checkEmailVerificationToken("tok-123");
    }

    @Test
    @DisplayName("checkEmailVerificationToken: token khong ton tai -> 400")
    void checkEmailVerificationTokenRejectsUnknownToken() {
        when(tokens.findByTokenAndType("bad", TokenType.VERIFY_EMAIL)).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.checkEmailVerificationToken("bad"));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("checkEmailVerificationToken: token het han -> 400")
    void checkEmailVerificationTokenRejectsExpiredToken() {
        when(tokens.findByTokenAndType("tok-123", TokenType.VERIFY_EMAIL))
                .thenReturn(Optional.of(token(TokenType.VERIFY_EMAIL, user(false, false, false),
                        LocalDateTime.now().minusMinutes(1))));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.checkEmailVerificationToken("tok-123"));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("verifyEmail: bat xac thuc va xoa token")
    void verifyEmailEnablesAccount() {
        User u = user(false, false, false);
        AuthToken t = token(TokenType.VERIFY_EMAIL, u, LocalDateTime.now().plusHours(1));
        when(tokens.findByTokenAndType("tok-123", TokenType.VERIFY_EMAIL)).thenReturn(Optional.of(t));

        service.verifyEmail("tok-123");

        assertTrue(u.isEnabled());
        verify(users).save(u);
        verify(tokens).delete(t);
    }

    // ----------------------------------------------------------------- login

    @Test
    @DisplayName("login: dang nhap thanh cong")
    void loginReturnsToken() {
        User u = user(true, false, false);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        when(encoder.matches("Pass@12345", "encoded")).thenReturn(true);
        when(jwt.generate(EMAIL)).thenReturn("jwt-token");

        AuthResponse response = service.login(new LoginRequest(EMAIL, "Pass@12345"));

        assertEquals("jwt-token", response.token());
        assertEquals("MEMBER", response.role());
        assertFalse(response.mustChangePassword());
        verify(activity).logEvent(1L, "LOGIN", "Signed in successfully", "SUCCESS");
    }

    @Test
    @DisplayName("login: mat khauu sai -> 401")
    void loginRejectsWrongPassword() {
        User u = user(true, false, false);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        when(encoder.matches("Wrong@12345", "encoded")).thenReturn(false);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.login(new LoginRequest(EMAIL, "Wrong@12345")));
        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
        verify(activity).logEvent(1L, "LOGIN", "Failed sign-in attempt (wrong password)", "FAILED");
    }

    @Test
    @DisplayName("login: email khong ton tai -> 401")
    void loginRejectsUnknownEmail() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.login(new LoginRequest(EMAIL, "Pass@12345")));
        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
    }

    @Test
    @DisplayName("login: tai khoan bi chan -> 403")
    void loginRejectsBlockedAccount() {
        User u = user(true, true, false);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        when(encoder.matches("Pass@12345", "encoded")).thenReturn(true);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.login(new LoginRequest(EMAIL, "Pass@12345")));
        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
    }

    @Test
    @DisplayName("login: email chua xac thuc -> 403")
    void loginRejectsUnverifiedEmail() {
        User u = user(false, false, false);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        when(encoder.matches("Pass@12345", "encoded")).thenReturn(true);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.login(new LoginRequest(EMAIL, "Pass@12345")));
        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
    }

    // --------------------------------------------------------- forgot/reset

    @Test
    @DisplayName("forgotPassword: gui link reset cho tai khoan da xac thuc")
    void forgotPasswordSendsResetLink() {
        setFrontendUrl();
        User u = user(true, false, false);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        lenient().when(tokens.save(any(AuthToken.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.forgotPassword(new ForgotRequest(EMAIL));

        verify(mail).send(eq(EMAIL), anyString(), org.mockito.ArgumentMatchers.contains("verify-reset-password"));
    }

    @Test
    @DisplayName("forgotPassword: email khong ton tai -> khong lam gi")
    void forgotPasswordIgnoresUnknownEmail() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        service.forgotPassword(new ForgotRequest(EMAIL));

        verify(mail, never()).send(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("forgotPassword: tai khoan bi chan -> 403")
    void forgotPasswordRejectsBlockedAccount() {
        User u = user(true, true, false);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.forgotPassword(new ForgotRequest(EMAIL)));
        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
    }

    @Test
    @DisplayName("forgotPassword: email chua xac thuc -> 403")
    void forgotPasswordRejectsUnverifiedEmail() {
        User u = user(false, false, false);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.forgotPassword(new ForgotRequest(EMAIL)));
        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
    }

    @Test
    @DisplayName("verifyResetToken: token hop le -> khong loi")
    void verifyResetTokenAcceptsValidToken() {
        when(tokens.findByTokenAndType("tok-123", TokenType.RESET_PASSWORD))
                .thenReturn(Optional.of(token(TokenType.RESET_PASSWORD, user(true, false, false),
                        LocalDateTime.now().plusMinutes(10))));

        service.verifyResetToken("tok-123");
    }

    @Test
    @DisplayName("verifyResetToken: token khong ton tai -> 400")
    void verifyResetTokenRejectsUnknownToken() {
        when(tokens.findByTokenAndType("bad", TokenType.RESET_PASSWORD)).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class, () -> service.verifyResetToken("bad"));
    }

    @Test
    @DisplayName("resetPassword: doi mat khauu thanh cong")
    void resetPasswordUpdatesPassword() {
        User u = user(true, false, true);
        AuthToken t = token(TokenType.RESET_PASSWORD, u, LocalDateTime.now().plusMinutes(10));
        when(tokens.findByTokenAndType("tok-123", TokenType.RESET_PASSWORD)).thenReturn(Optional.of(t));
        when(encoder.encode("New@12345")).thenReturn("encoded-new");

        service.resetPassword(new ResetRequest("tok-123", "New@12345", "New@12345"));

        assertEquals("encoded-new", u.getPassword());
        assertFalse(u.isMustChangePassword());
        verify(tokens).delete(t);
    }

    @Test
    @DisplayName("resetPassword: tai khoan bi chan -> 403 va xoa token")
    void resetPasswordRejectsBlockedAccount() {
        User u = user(true, true, false);
        AuthToken t = token(TokenType.RESET_PASSWORD, u, LocalDateTime.now().plusMinutes(10));
        when(tokens.findByTokenAndType("tok-123", TokenType.RESET_PASSWORD)).thenReturn(Optional.of(t));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.resetPassword(new ResetRequest("tok-123", "New@12345", "New@12345")));
        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
        verify(tokens).delete(t);
    }

    @Test
    @DisplayName("resetPassword: email chua xac thuc -> 403 va xoa token")
    void resetPasswordRejectsUnverifiedEmail() {
        User u = user(false, false, false);
        AuthToken t = token(TokenType.RESET_PASSWORD, u, LocalDateTime.now().plusMinutes(10));
        when(tokens.findByTokenAndType("tok-123", TokenType.RESET_PASSWORD)).thenReturn(Optional.of(t));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.resetPassword(new ResetRequest("tok-123", "New@12345", "New@12345")));
        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
        verify(tokens).delete(t);
    }

    // -------------------------------------------------------- changePassword

    @Test
    @DisplayName("changePassword: mat khauu cu sai -> 400")
    void changePasswordRejectsWrongOldPassword() {
        User u = user(true, false, false);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        when(encoder.matches("Wrong@12345", "encoded")).thenReturn(false);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.changePassword(EMAIL, new ChangePasswordRequest("Wrong@12345", "New@12345", "New@12345")));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("changePassword: mat khauu moi trung mat khauu tam thoi -> 400")
    void changePasswordRejectsSameDefaultPassword() {
        User u = user(true, false, true);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        when(encoder.matches("Old@12345", "encoded")).thenReturn(true);
        when(encoder.matches("New@12345", "encoded")).thenReturn(true);

        assertThrows(ResponseStatusException.class,
                () -> service.changePassword(EMAIL, new ChangePasswordRequest("Old@12345", "New@12345", "New@12345")));
    }

    @Test
    @DisplayName("changePassword: mat khauu cu rong -> doi thanh cong")
    void changePasswordSucceeds() {
        User u = user(true, false, false);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        when(encoder.matches("Old@12345", "encoded")).thenReturn(true);
        when(encoder.encode("New@12345")).thenReturn("encoded-new");

        service.changePassword(EMAIL, new ChangePasswordRequest("Old@12345", "New@12345", "New@12345"));

        assertEquals("encoded-new", u.getPassword());
        assertNotNull(u.getPasswordChangedAt());
    }

    @Test
    @DisplayName("changePassword: khong nhap mat khauu cu -> bo qua kiem tra")
    void changePasswordSkipsOldPasswordCheck() {
        User u = user(true, false, false);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        when(encoder.encode("New@12345")).thenReturn("encoded-new");

        service.changePassword(EMAIL, new ChangePasswordRequest(null, "New@12345", "New@12345"));

        assertEquals("encoded-new", u.getPassword());
    }

    @Test
    @DisplayName("changePassword: khong tim thay user -> 401")
    void changePasswordRejectsUnknownUser() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.changePassword(EMAIL, new ChangePasswordRequest(null, "New@12345", "New@12345")));
        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
    }

    // ------------------------------------------------------------------- me

    @Test
    @DisplayName("me: tra ve user")
    void meReturnsUser() {
        User u = user(true, false, false);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(u));

        assertEquals(u, service.me(EMAIL));
    }

    @Test
    @DisplayName("me: khong tim thay user -> 401")
    void meRejectsUnknownUser() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.me(EMAIL));
        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
    }
}
