package com.calishealth.dtos;

import com.calishealth.validation.StrongPassword;
import com.calishealth.validation.ValidEmail;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;

/**
 * Message trong annotation là KEY i18n (vd "validation.email.required").
 * GlobalExceptionHandler sẽ tra key này trong messages_*.properties theo
 * header Accept-Language rồi mới trả về cho client.
 */
public class AuthDtos {
    public record RegisterRequest(
            @NotBlank(message = "validation.fullName.required") String fullName,
            @ValidEmail String email,
            @NotBlank(message = "validation.password.required") @StrongPassword String password,
            @NotBlank(message = "validation.confirmPassword.required") String confirmPassword) {

        @AssertTrue(message = "validation.password.confirm_mismatch")
        public boolean isPasswordConfirmed() {
            return password != null && password.equals(confirmPassword);
        }
    }

    public record LoginRequest(
            @ValidEmail String email,
            @NotBlank(message = "validation.password.required") String password) {}

    public record ForgotRequest(@ValidEmail String email) {}

    public record ResetRequest(
            @NotBlank(message = "validation.token.required") String token,
            @NotBlank(message = "validation.newPassword.required") @StrongPassword String newPassword,
            @NotBlank(message = "validation.confirmNewPassword.required") String confirmNewPassword) {

        @AssertTrue(message = "validation.newPassword.confirm_mismatch")
        public boolean isNewPasswordConfirmed() {
            return newPassword != null && newPassword.equals(confirmNewPassword);
        }
    }

    public record ChangePasswordRequest(
            String oldPassword,
            @NotBlank(message = "validation.newPassword.required") @StrongPassword String newPassword,
            @NotBlank(message = "validation.confirmNewPassword.required") String confirmNewPassword) {

        @AssertTrue(message = "validation.newPassword.confirm_mismatch")
        public boolean isNewPasswordConfirmed() {
            return newPassword != null && newPassword.equals(confirmNewPassword);
        }
    }

    public record AuthResponse(String token, String email, String fullName, String role) {}
}
