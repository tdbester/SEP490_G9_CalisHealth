package com.calishealth.controllers;

import com.calishealth.dtos.AuthDtos.*;
import com.calishealth.models.User;
import com.calishealth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService auth;

    private ResponseEntity<Map<String, String>> msg(String m) {
        return ResponseEntity.ok(Map.of("message", m));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest r) {
        auth.register(r);
        return msg("Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.");
    }

    @GetMapping("/verify")
    public ResponseEntity<?> verify(@RequestParam String token) {
        auth.verifyEmail(token);
        return msg("Xác thực email thành công! Bạn có thể đăng nhập.");
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest r) {
        return auth.login(r);
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgot(@Valid @RequestBody ForgotRequest r) {
        auth.forgotPassword(r);
        return msg("Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu.");
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> reset(@Valid @RequestBody ResetRequest r) {
        auth.resetPassword(r);
        return msg("Đặt lại mật khẩu thành công! Hãy đăng nhập lại.");
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> change(Authentication a, @Valid @RequestBody ChangePasswordRequest r) {
        auth.changePassword((String) a.getPrincipal(), r);
        return msg("Đổi mật khẩu thành công!");
    }

    @GetMapping("/me")
    public AuthResponse me(Authentication a) {
        User u = auth.me((String) a.getPrincipal());
        return new AuthResponse(null, u.getEmail(), u.getFullName(), u.getRole().name());
    }
}
