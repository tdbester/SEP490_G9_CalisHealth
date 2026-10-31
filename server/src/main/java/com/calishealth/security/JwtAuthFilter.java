package com.calishealth.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import com.calishealth.models.User;
import com.calishealth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {
    private static final Logger logger = LoggerFactory.getLogger(JwtAuthFilter.class);

    private final JwtService jwtService;
    private final UserRepository users;

    private static boolean isAllowedWhilePasswordChangePending(HttpServletRequest req) {
        String path = req.getRequestURI();
        return "OPTIONS".equalsIgnoreCase(req.getMethod())
                || path.equals("/api/auth/change-password")
                || path.equals("/api/auth/me");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                String email = jwtService.extractEmail(header.substring(7));
                User user = users.findByEmail(email).orElse(null);
                if (user == null) {
                    logger.warn("Rejected JWT because its subject is not a registered account");
                } else if (!user.isActive()) {
                    logger.warn("Rejected JWT for disabled or blocked account");
                } else if (user.isMustChangePassword() && !isAllowedWhilePasswordChangePending(req)) {
                    // Temporary password issued by an admin: only /me and change-password work until it is replaced.
                    res.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    res.setContentType("application/json");
                    res.getWriter().write("{\"code\":\"PASSWORD_CHANGE_REQUIRED\","
                            + "\"message\":\"You must change your temporary password before continuing\"}");
                    return;
                } else {
                    SecurityContextHolder.getContext().setAuthentication(
                            new UsernamePasswordAuthenticationToken(
                                    email,
                                    null,
                                    List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
                            ));
                }
            } catch (io.jsonwebtoken.ExpiredJwtException exception) {
                logger.warn("Rejected expired JWT");
            } catch (io.jsonwebtoken.security.SignatureException exception) {
                logger.warn("Rejected JWT with an invalid signature; check that the login and API servers use the same app.jwt.secret");
            } catch (io.jsonwebtoken.JwtException | IllegalArgumentException exception) {
                logger.warn("Rejected malformed JWT: {}", exception.getMessage());
            }
        }
        chain.doFilter(req, res);
    }
}
