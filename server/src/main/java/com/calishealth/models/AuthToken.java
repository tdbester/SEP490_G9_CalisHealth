package com.calishealth.models;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "auth_tokens")
@Getter @Setter @NoArgsConstructor
public class AuthToken {
    public enum TokenType { VERIFY_EMAIL, RESET_PASSWORD }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String token;

    @ManyToOne(optional = false)
    private User user;

    @Enumerated(EnumType.STRING)
    private TokenType type;

    private LocalDateTime expiresAt;
}
