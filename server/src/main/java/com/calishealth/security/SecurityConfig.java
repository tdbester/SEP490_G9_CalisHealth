package com.calishealth.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {
    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(c -> c.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(a -> a
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/api/auth/change-password", "/api/auth/me").authenticated()
                        .requestMatchers(
                            "/api/auth/**",
                            "/swagger-ui.html",
                            "/swagger-ui/**",
                            "/v3/api-docs",
                            "/v3/api-docs/**",
                            "/webjars/**"
                        ).permitAll()
                        .requestMatchers("/media/exercise-demos/**").permitAll()
                        .requestMatchers("/media/exercise-anatomy/**").permitAll()
                        .requestMatchers("/api/content/**").hasRole("CONTENT_MANAGER")
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/v1/library/exercises/**").hasRole("MEMBER")
                        .requestMatchers("/api/v1/library/exercise-tree/**").hasRole("MEMBER")
                        .requestMatchers("/api/v1/library/member-exercises/**").hasRole("MEMBER")
                        .requestMatchers("/api/v1/library/personal-exercises/**").hasRole("MEMBER")
                        .requestMatchers("/api/v1/library/custom-workouts/**").hasRole("MEMBER")
                        .requestMatchers("/api/v1/library/my-workouts/**").hasRole("MEMBER")
                        .requestMatchers("/api/v1/library/workout-exercises/**").hasRole("MEMBER")
                        .requestMatchers("/api/v1/library/overview").hasRole("MEMBER")
                        .requestMatchers("/api/library/**").permitAll()
                        .requestMatchers("/api/exercises/**").permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOriginPatterns(List.of("http://localhost:*", "http://127.0.0.1:*"));
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/**", cfg);
        return src;
    }
}
