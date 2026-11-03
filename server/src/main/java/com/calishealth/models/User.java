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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32, columnDefinition = "varchar(32) not null default 'MEMBER'")
    private UserRole role = UserRole.MEMBER;

    private boolean enabled = false; // true sau khi xác thực email

    private boolean blocked = false; // true khi admin vô hiệu hóa tài khoản

    private boolean mustChangePassword = false; // true khi admin cấp mật khẩu tạm; xóa sau khi user đổi mật khẩu

    /** Có thể đăng nhập: đã xác thực email và không bị admin khóa. */
    public boolean isActive() {
        return enabled && !blocked;
    }

    private LocalDateTime createdAt = LocalDateTime.now();
}
