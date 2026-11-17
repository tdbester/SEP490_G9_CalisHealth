package com.calishealth.models;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter @Setter @NoArgsConstructor
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String fullName;

    // ---- Profile Information screen (V26) ----
    // gender / date_of_birth / bio are owned by MemberProfile (see V81); only the
    // account facts (name, phone, avatar, role, security) live here.

    /** Kept as typed so the leading 0 or "+84" of a Vietnamese number survives a round trip. */
    @Column(length = 30)
    private String phone;

    @Column(name = "avatar_url", length = 1000)
    private String avatarUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32, columnDefinition = "varchar(32) not null default 'MEMBER'")
    private UserRole role = UserRole.MEMBER;

    private boolean enabled = false; // true sau khi xác thực email

    private boolean blocked = false; // true khi admin vô hiệu hóa tài khoản

    private boolean mustChangePassword = false; // true khi admin cấp mật khẩu tạm; xóa sau khi user đổi mật khẩu

    /** When the current password was set; shown as "Last changed" on the profile screen. */
    @Column(name = "password_changed_at")
    private LocalDateTime passwordChangedAt;

    /** Có thể đăng nhập: đã xác thực email và không bị admin khóa. */
    public boolean isActive() {
        return enabled && !blocked;
    }

    private LocalDateTime createdAt = LocalDateTime.now();
}
