package com.calishealth.dtos;

import com.calishealth.validation.StrongPassword;
import com.calishealth.validation.ValidEmail;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;

public class AuthDtos {
    public record RegisterRequest(
            @NotBlank(message = "Please enter your full name") String fullName,
            @ValidEmail String email,
            @NotBlank(message = "Please enter a password") @StrongPassword String password,
            @NotBlank(message = "Please confirm your password") String confirmPassword) {

        @AssertTrue(message = "The confirmation password does not match")
        public boolean isPasswordConfirmed() {
            return password != null && password.equals(confirmPassword);
        }
    }

    public record LoginRequest(
            @ValidEmail String email,
            @NotBlank(message = "Please enter a password") String password) {}

    public record ForgotRequest(@ValidEmail String email) {}

    public record ResetRequest(
            @NotBlank String token,
            @NotBlank(message = "Please enter a new password") @StrongPassword String newPassword,
            @NotBlank(message = "Please confirm your new password") String confirmNewPassword) {

        @AssertTrue(message = "The confirmation password does not match")
        public boolean isNewPasswordConfirmed() {
            return newPassword != null && newPassword.equals(confirmNewPassword);
        }
    }

    public record ChangePasswordRequest(
            String oldPassword,
            @NotBlank(message = "Please enter a new password") @StrongPassword String newPassword,
            @NotBlank(message = "Please confirm your new password") String confirmNewPassword) {

        @AssertTrue(message = "The confirmation password does not match")
        public boolean isNewPasswordConfirmed() {
            return newPassword != null && newPassword.equals(confirmNewPassword);
        }
    }

    public record AuthResponse(String token, String email, String fullName, String role, boolean mustChangePassword) {}
}
