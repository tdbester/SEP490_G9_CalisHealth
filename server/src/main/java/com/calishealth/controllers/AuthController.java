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
        return msg("Registration successful! Please check your email to verify your account.");
    }

    @GetMapping("/verify")
    public ResponseEntity<?> checkVerificationToken(@RequestParam String token) {
        auth.checkEmailVerificationToken(token);
        return msg("Verification link is valid.");
    }

    @PostMapping("/verify")
    public ResponseEntity<?> verify(@RequestParam String token) {
        auth.verifyEmail(token);
        return msg("Email verified successfully! You can now log in.");
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest r) {
        return auth.login(r);
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgot(@Valid @RequestBody ForgotRequest r) {
        auth.forgotPassword(r);
        return msg("If the email exists, we have sent a password reset link.");
    }

    @GetMapping("/verify-reset-token")
    public ResponseEntity<?> verifyResetToken(@RequestParam String token) {
        auth.verifyResetToken(token);
        return msg("Password reset token is valid.");
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> reset(@Valid @RequestBody ResetRequest r) {
        auth.resetPassword(r);
        return msg("Password reset successfully! Please log in again.");
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> change(Authentication a, @Valid @RequestBody ChangePasswordRequest r) {
        auth.changePassword((String) a.getPrincipal(), r);
        return msg("Password changed successfully!");
    }

    @GetMapping("/me")
    public AuthResponse me(Authentication a) {
        User u = auth.me((String) a.getPrincipal());
        return new AuthResponse(null, u.getEmail(), u.getFullName(), u.getRole().name(),
                u.isMustChangePassword());
    }
}
