package com.calishealth.dtos;

import com.calishealth.validation.StrongPassword;
import com.calishealth.validation.ValidEmail;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class AuthDtos {
    public record RegisterRequest(
            @NotBlank(message = "Vui lòng nhập họ tên")
            @Size(min = 2, max = 50, message = "Họ tên phải từ 2 đến 50 ký tự") String fullName,
            @ValidEmail String email,
            @NotBlank(message = "Vui lòng nhập mật khẩu") @StrongPassword String password,
            @NotBlank(message = "Vui lòng xác nhận mật khẩu") String confirmPassword) {

        @AssertTrue(message = "Mật khẩu xác nhận không khớp")
        public boolean isPasswordConfirmed() {
            return password != null && password.equals(confirmPassword);
        }
    }

    public record LoginRequest(
            @ValidEmail String email,
            @NotBlank(message = "Vui lòng nhập mật khẩu") String password) {}

    public record ForgotRequest(@ValidEmail String email) {}

    public record ResetRequest(
            @NotBlank String token,
            @NotBlank(message = "Vui lòng nhập mật khẩu mới") @StrongPassword String newPassword,
            @NotBlank(message = "Vui lòng xác nhận mật khẩu mới") String confirmNewPassword) {

        @AssertTrue(message = "Mật khẩu xác nhận không khớp")
        public boolean isNewPasswordConfirmed() {
            return newPassword != null && newPassword.equals(confirmNewPassword);
        }
    }

    public record ChangePasswordRequest(
            String oldPassword,
            @NotBlank(message = "Vui lòng nhập mật khẩu mới") @StrongPassword String newPassword,
            @NotBlank(message = "Vui lòng xác nhận mật khẩu mới") String confirmNewPassword) {

        @AssertTrue(message = "Mật khẩu xác nhận không khớp")
        public boolean isNewPasswordConfirmed() {
            return newPassword != null && newPassword.equals(confirmNewPassword);
        }
    }

    public record AuthResponse(String token, String email, String fullName, String role) {}
}
