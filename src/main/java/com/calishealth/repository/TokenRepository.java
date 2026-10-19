package com.calishealth.repository;

import com.calishealth.models.AuthToken;
import com.calishealth.models.AuthToken.TokenType;
import com.calishealth.models.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface TokenRepository extends JpaRepository<AuthToken, Long> {
    Optional<AuthToken> findByTokenAndType(String token, TokenType type);
    void deleteByUserAndType(User user, TokenType type);
}
