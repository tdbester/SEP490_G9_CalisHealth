package com.calishealth.service;

import com.calishealth.dtos.AuthDtos.*;
import com.calishealth.models.AuthToken;
import com.calishealth.models.AuthToken.TokenType;
import com.calishealth.models.User;
import com.calishealth.repository.TokenRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository users;
    private final TokenRepository tokens;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final EmailService mail;

    @Value("${app.frontend-url}") private String frontendUrl;

    private ResponseStatusException err(HttpStatus s, String msg) {
        return new ResponseStatusException(s, msg);
    }

    private AuthToken createToken(User u, TokenType type, long minutes) {
        tokens.deleteByUserAndType(u, type); // mỗi user chỉ giữ 1 token mỗi loại
        tokens.flush();
        AuthToken t = new AuthToken();
        t.setToken(UUID.randomUUID().toString());
        t.setUser(u);
        t.setType(type);
        t.setExpiresAt(LocalDateTime.now().plusMinutes(minutes));
        return tokens.save(t);
    }

    private AuthToken validToken(String token, TokenType type) {
        AuthToken t = tokens.findByTokenAndType(token, type)
                .orElseThrow(() -> err(HttpStatus.BAD_REQUEST, "The link is invalid or has already been used"));
        if (t.getExpiresAt().isBefore(LocalDateTime.now()))
            throw err(HttpStatus.BAD_REQUEST, "The link has expired");
        return t;
    }

    // 1. Đăng ký + gửi email xác thực
    @Transactional
    public void register(RegisterRequest r) {
        String email = r.email().trim().toLowerCase();
        User u = users.findByEmail(email).orElseGet(User::new);
        if (u.getId() != null && (u.isEnabled() || u.isBlocked()))
            throw err(HttpStatus.BAD_REQUEST, "Email is already registered");
        u.setEmail(email);
        u.setFullName(r.fullName().trim());
        u.setPassword(encoder.encode(r.password()));
        users.save(u);

        AuthToken t = createToken(u, TokenType.VERIFY_EMAIL, 24 * 60);
        mail.send(email, "[CLH] Verify your account",
                "Hello " + u.getFullName() + ",\n\nClick the link below to verify your account (valid for 24 hours):\n"
                        + frontendUrl + "/verify-email?token=" + t.getToken());
    }

    // Chỉ kiểm tra link khi trang được mở; email scanners thường tự truy cập GET.
    @Transactional(readOnly = true)
    public void checkEmailVerificationToken(String token) {
        validToken(token, TokenType.VERIFY_EMAIL);
    }

    // 2. Xác thực email sau thao tác xác nhận rõ ràng của người dùng
    @Transactional
    public void verifyEmail(String token) {
        AuthToken t = validToken(token, TokenType.VERIFY_EMAIL);
        User u = t.getUser();
        u.setEnabled(true);
        users.save(u);
        tokens.delete(t);
    }

    // Kiểm tra token reset trước khi hiển thị màn hình đổi mật khẩu
    @Transactional(readOnly = true)
    public void verifyResetToken(String token) {
        validToken(token, TokenType.RESET_PASSWORD);
    }

    // 3. Đăng nhập
    public AuthResponse login(LoginRequest r) {
        User u = users.findByEmail(r.email().trim().toLowerCase())
                .orElseThrow(() -> err(HttpStatus.UNAUTHORIZED, "Incorrect email or password"));
        if (!encoder.matches(r.password(), u.getPassword()))
            throw err(HttpStatus.UNAUTHORIZED, "Incorrect email or password");
        if (u.isBlocked())
            throw err(HttpStatus.FORBIDDEN, "Your account has been blocked");
        if (!u.isEnabled())
            throw err(HttpStatus.FORBIDDEN, "Account email is not verified. Please check your inbox");
        return new AuthResponse(jwt.generate(u.getEmail()), u.getEmail(), u.getFullName(), u.getRole().name(),
                u.isMustChangePassword());
    }

    // 4. Quên mật khẩu -> chỉ gửi link reset cho tài khoản đã xác thực email
    @Transactional
    public void forgotPassword(ForgotRequest r) {
        users.findByEmail(r.email().trim().toLowerCase()).ifPresent(u -> {
            if (u.isBlocked()) {
                throw err(HttpStatus.FORBIDDEN, "Your account has been blocked");
            }
            if (!u.isEnabled()) {
                throw err(HttpStatus.FORBIDDEN,
                        "Email is not verified. Please verify your email before using forgot password.");
            }

            AuthToken t = createToken(u, TokenType.RESET_PASSWORD, 30);
            mail.send(u.getEmail(), "[CLH] Reset your password",
                    "Click the link below to reset your password (valid for 30 minutes):\n"
                            + frontendUrl + "/verify-reset-password?token=" + t.getToken());
        });
    }

    @Transactional
    public void resetPassword(ResetRequest r) {
        AuthToken t = validToken(r.token(), TokenType.RESET_PASSWORD);
        User u = t.getUser();
        if (u.isBlocked()) {
            tokens.delete(t);
            throw err(HttpStatus.FORBIDDEN, "Your account has been blocked");
        }
        if (!u.isEnabled()) {
            tokens.delete(t);
            throw err(HttpStatus.FORBIDDEN, "Account email is not verified. Please verify your email before resetting your password.");
        }
        u.setPassword(encoder.encode(r.newPassword()));
        u.setMustChangePassword(false);
        users.save(u);
        tokens.delete(t);
    }

    // 5. Đổi mật khẩu (đã đăng nhập)
    @Transactional
    public void changePassword(String email, ChangePasswordRequest r) {
        User u = users.findByEmail(email).orElseThrow(() -> err(HttpStatus.UNAUTHORIZED, "Not logged in"));
        if (r.oldPassword() != null && !r.oldPassword().isBlank()) {
            if (!encoder.matches(r.oldPassword(), u.getPassword()))
                throw err(HttpStatus.BAD_REQUEST, "Incorrect old password");
        }
        if (u.isMustChangePassword() && encoder.matches(r.newPassword(), u.getPassword()))
            throw err(HttpStatus.BAD_REQUEST, "The new password must be different from the default password");
        u.setPassword(encoder.encode(r.newPassword()));
        u.setMustChangePassword(false);
        users.save(u);
    }

    public User me(String email) {
        return users.findByEmail(email).orElseThrow(() -> err(HttpStatus.UNAUTHORIZED, "Not logged in"));
    }
}
