package com.calishealth.controllers;

import com.calishealth.dtos.AuthDtos.*;
import com.calishealth.models.User;
import com.calishealth.service.AuthService;
import com.calishealth.service.MessageService;
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
    private final MessageService msg;

    private ResponseEntity<Map<String, String>> msg(String key) {
        return ResponseEntity.ok(Map.of("message", msg.get(key)));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest r) {
        auth.register(r);
        return msg("auth.register.success");
    }

    @GetMapping("/verify")
    public ResponseEntity<?> verify(@RequestParam String token) {
        auth.verifyEmail(token);
        return msg("auth.verify.success");
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest r) {
        return auth.login(r);
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgot(@Valid @RequestBody ForgotRequest r) {
        auth.forgotPassword(r);
        return msg("auth.forgot.success");
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> reset(@Valid @RequestBody ResetRequest r) {
        auth.resetPassword(r);
        return msg("auth.reset.success");
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> change(Authentication a, @Valid @RequestBody ChangePasswordRequest r) {
        auth.changePassword((String) a.getPrincipal(), r);
        return msg("auth.change_password.success");
    }

    @GetMapping("/me")
    public Map<String, String> me(Authentication a) {
        User u = auth.me((String) a.getPrincipal());
        return Map.of("email", u.getEmail(), "fullName", u.getFullName(), "role", u.getRole().name());
    }
}
