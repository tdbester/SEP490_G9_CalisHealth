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

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(nullable = false)
    private String password;

    // ERD: CHECK char_length(full_name) BETWEEN 2 AND 50
    @Column(nullable = false, length = 50)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole role = UserRole.MEMBER;

    @Column(nullable = false)
    private boolean enabled = false; // true sau khi xác thực email

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}