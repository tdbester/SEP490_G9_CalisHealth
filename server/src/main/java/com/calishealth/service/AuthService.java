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
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository users;
    private final TokenRepository tokens;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final EmailService mail;
    private final MessageService msg;

    @Value("${app.frontend-url}") private String frontendUrl;

    private ResponseStatusException err(HttpStatus s, String key) {
        return new ResponseStatusException(s, msg.get(key));
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
                .orElseThrow(() -> err(HttpStatus.BAD_REQUEST, "auth.token.invalid"));
        if (t.getExpiresAt().isBefore(LocalDateTime.now()))
            throw err(HttpStatus.BAD_REQUEST, "auth.token.expired");
        return t;
    }

    // 1. Đăng ký + gửi email xác thực
    @Transactional
    public void register(RegisterRequest r) {
        String email = r.email().trim().toLowerCase();
        if (users.existsByEmail(email))
            throw err(HttpStatus.BAD_REQUEST, "auth.register.email_exists");
        User u = new User();
        u.setEmail(email);
        u.setFullName(r.fullName().trim());
        u.setPassword(encoder.encode(r.password()));
        users.save(u);

        AuthToken t = createToken(u, TokenType.VERIFY_EMAIL, 24 * 60);
        // Email luôn gửi tiếng Việt (Locale.VI), không phụ thuộc ngôn ngữ người dùng đang xem web.
        String subject = msg.get(Locale.forLanguageTag("vi"), "mail.verify.subject");
        String body = msg.get(Locale.forLanguageTag("vi"), "mail.verify.body", u.getFullName(),
                frontendUrl + "/verify-email?token=" + t.getToken());
        mail.send(email, subject, body);
    }

    // 2. Xác thực email
    @Transactional
    public void verifyEmail(String token) {
        AuthToken t = validToken(token, TokenType.VERIFY_EMAIL);
        User u = t.getUser();
        u.setEnabled(true);
        users.save(u);
        tokens.delete(t);
    }

    // 3. Đăng nhập
    public AuthResponse login(LoginRequest r) {
        User u = users.findByEmail(r.email().trim().toLowerCase())
                .orElseThrow(() -> err(HttpStatus.UNAUTHORIZED, "auth.login.invalid_credentials"));
        if (!encoder.matches(r.password(), u.getPassword()))
            throw err(HttpStatus.UNAUTHORIZED, "auth.login.invalid_credentials");
        if (!u.isEnabled())
            throw err(HttpStatus.FORBIDDEN, "auth.login.email_not_verified");
        return new AuthResponse(jwt.generate(u.getEmail()), u.getEmail(), u.getFullName(), u.getRole().name());
    }

    // 4. Quên mật khẩu -> gửi link reset (luôn trả cùng 1 thông báo để không lộ email nào tồn tại)
    @Transactional
    public void forgotPassword(ForgotRequest r) {
        users.findByEmail(r.email().trim().toLowerCase()).ifPresent(u -> {
            AuthToken t = createToken(u, TokenType.RESET_PASSWORD, 30);
            String subject = msg.get(Locale.forLanguageTag("vi"), "mail.reset.subject");
            String body = msg.get(Locale.forLanguageTag("vi"), "mail.reset.body",
                    frontendUrl + "/reset-password?token=" + t.getToken());
            mail.send(u.getEmail(), subject, body);
        });
    }

    @Transactional
    public void resetPassword(ResetRequest r) {
        AuthToken t = validToken(r.token(), TokenType.RESET_PASSWORD);
        User u = t.getUser();
        u.setPassword(encoder.encode(r.newPassword()));
        users.save(u);
        tokens.delete(t);
    }

    // 5. Đổi mật khẩu (đã đăng nhập)
    @Transactional
    public void changePassword(String email, ChangePasswordRequest r) {
        User u = users.findByEmail(email).orElseThrow(() -> err(HttpStatus.UNAUTHORIZED, "auth.unauthorized"));
        if (r.oldPassword() != null && !r.oldPassword().isBlank()) {
            if (!encoder.matches(r.oldPassword(), u.getPassword()))
                throw err(HttpStatus.BAD_REQUEST, "auth.change_password.old_invalid");
        }
        u.setPassword(encoder.encode(r.newPassword()));
        users.save(u);
    }

    public User me(String email) {
        return users.findByEmail(email).orElseThrow(() -> err(HttpStatus.UNAUTHORIZED, "auth.unauthorized"));
    }
}
