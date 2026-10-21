# Swagger — CalisHealth Auth API

Tài liệu OpenAPI 3.1 cho toàn bộ endpoints trong `server/src/main/java/com/calishealth/controllers/AuthController.java`.

---

## 1. Thư viện

Project dùng **Spring Boot 4.1.1** + **Java 17** → không dùng được `springfox`. Dùng **springdoc-openapi** (chuẩn cho Spring Boot 4).

### Maven dependency (thêm vào `server/pom.xml`, đặt **trước** `</dependencies>`)

```xml
<!-- OpenAPI 3 / Swagger UI -->
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
    <version>2.7.0</version>
</dependency>
```

> Bản 2.7.x tương thích Spring Boot 4 / Jakarta EE 11. Nếu build lỗi, hạ xuống `2.6.0` (Spring Boot 3.4 trở lên đều chạy).

---

## 2. Hai cách xem docs

### Cách A — Auto-generated (server tự sinh)

Thêm config class `SwaggerConfig.java` (xem bên dưới). Sau khi chạy `mvn spring-boot:run`:

| URL | Mô tả |
|---|---|
| `http://localhost:8080/swagger-ui.html` | Swagger UI (giao diện đẹp, "Authorize" để nhập JWT) |
| `http://localhost:8080/v3/api-docs` | OpenAPI spec dạng JSON (raw) |
| `http://localhost:8080/v3/api-docs.yaml` | OpenAPI spec dạng YAML |

### Cách B — File tĩnh (repo này)

Hai file trong folder này dùng để:
- **Import** vào [Swagger Editor online](https://editor.swagger.io/) hoặc Postman → đọc docs không cần chạy server
- **Review offline** các request/response shape
- **Generate client SDK** (openapi-generator) cho frontend

| File | Định dạng |
|---|---|
| `openapi.yaml` | OpenAPI 3.1 (chuẩn, dùng cho tooling) |
| `README.md` | File này — hướng dẫn tích hợp |

---

## 3. `SwaggerConfig.java` — đặt tại `server/src/main/java/com/calishealth/config/SwaggerConfig.java`

```java
package com.calishealth.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SwaggerConfig {

    private static final String JWT_SCHEME = "bearerAuth";

    @Bean
    public OpenAPI calisHealthOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("CalisHealth Auth API")
                        .description("""
                                REST API xác thực & quản lý tài khoản cho dự án SEP490_G9_CalisHealth.
                                Bao gồm: đăng ký, xác thực email, đăng nhập (JWT),
                                quên/đặt lại mật khẩu, đổi mật khẩu, lấy thông tin user hiện tại.
                                """)
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("CalisHealth Team")
                                .email("support@calishealth.local"))
                        .license(new License().name("Proprietary")))
                // Nút "Authorize" trên Swagger UI — nhập JWT để test endpoint cần auth
                .addSecurityItem(new SecurityRequirement().addList(JWT_SCHEME))
                .components(new Components().addSecuritySchemes(JWT_SCHEME,
                        new SecurityScheme()
                                .name(JWT_SCHEME)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")));
    }
}
```

---

## 4. Annotate endpoints — viết Swagger trực tiếp trên `AuthController.java`

Thay thế toàn bộ nội dung `AuthController.java` (xem chi tiết request/response cho từng endpoint trong `openapi.yaml`):

```java
package com.calishealth.controllers;

import com.calishealth.dtos.AuthDtos.*;
import com.calishealth.models.User;
import com.calishealth.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Auth", description = "Xác thực & quản lý tài khoản (đăng ký, đăng nhập, JWT, mật khẩu)")
public class AuthController {
    private final AuthService auth;

    private ResponseEntity<Map<String, String>> msg(String m) {
        return ResponseEntity.ok(Map.of("message", m));
    }

    // ============================================================
    // 1. ĐĂNG KÝ
    // ============================================================
    @Operation(
            summary = "Đăng ký tài khoản mới",
            description = "Tạo user mới và gửi email xác thực (token hết hạn sau 24 giờ). "
                        + "Email phải hợp lệ, mật khẩu tối thiểu 8 ký tự gồm chữ hoa, chữ thường, số, ký tự đặc biệt."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Đăng ký thành công, email xác thực đã được gửi"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu không hợp lệ (email trùng, validation fail)",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/register")
    public ResponseEntity<?> register(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    required = true,
                    content = @Content(schema = @Schema(implementation = RegisterRequest.class)))
            @Valid @RequestBody RegisterRequest r) {
        auth.register(r);
        return msg("Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.");
    }

    // ============================================================
    // 2. XÁC THỰC EMAIL (click link trong email)
    // ============================================================
    @Operation(
            summary = "Xác thực email bằng token",
            description = "User nhấn link trong email → frontend redirect về trang verify, "
                        + "gọi endpoint này để kích hoạt tài khoản (set enabled = true)."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Xác thực thành công"),
            @ApiResponse(responseCode = "400", description = "Token không hợp lệ hoặc đã hết hạn",
                    content = @Content(schema = @Schema(implementation = MessageResponse.class)))
    })
    @GetMapping("/verify")
    public ResponseEntity<?> verify(
            @Parameter(description = "Token nhận từ link email (?token=...)", required = true, example = "a1b2c3d4-...")
            @RequestParam String token) {
        auth.verifyEmail(token);
        return msg("Xác thực email thành công! Bạn có thể đăng nhập.");
    }

    // ============================================================
    // 3. ĐĂNG NHẬP (trả JWT)
    // ============================================================
    @Operation(
            summary = "Đăng nhập → trả JWT",
            description = "Xác thực email + password, trả về JWT (dùng cho `Authorization: Bearer <token>`)."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Đăng nhập thành công",
                    content = @Content(schema = @Schema(implementation = AuthResponse.class))),
            @ApiResponse(responseCode = "401", description = "Email hoặc mật khẩu không đúng"),
            @ApiResponse(responseCode = "403", description = "Tài khoản chưa xác thực email")
    })
    @PostMapping("/login")
    public AuthResponse login(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    required = true,
                    content = @Content(schema = @Schema(implementation = LoginRequest.class)))
            @Valid @RequestBody LoginRequest r) {
        return auth.login(r);
    }

    // ============================================================
    // 4. QUÊN MẬT KHẨU (gửi link reset qua email)
    // ============================================================
    @Operation(
            summary = "Yêu cầu đặt lại mật khẩu",
            description = "Luôn trả về cùng 1 thông báo bất kể email có tồn tại hay không "
                        + "(tránh lộ thông tin). Nếu email tồn tại, link reset (hết hạn sau 30 phút) được gửi."
    )
    @ApiResponse(responseCode = "200", description = "Yêu cầu đã được xử lý")
    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgot(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    required = true,
                    content = @Content(schema = @Schema(implementation = ForgotRequest.class)))
            @Valid @RequestBody ForgotRequest r) {
        auth.forgotPassword(r);
        return msg("Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu.");
    }

    // ============================================================
    // 5. ĐẶT LẠI MẬT KHẨU (dùng token từ email)
    // ============================================================
    @Operation(
            summary = "Đặt lại mật khẩu bằng token",
            description = "User nhấn link reset → frontend gửi token + mật khẩu mới về endpoint này."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Đặt lại mật khẩu thành công"),
            @ApiResponse(responseCode = "400", description = "Token không hợp lệ / hết hạn / mật khẩu yếu")
    })
    @PostMapping("/reset-password")
    public ResponseEntity<?> reset(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    required = true,
                    content = @Content(schema = @Schema(implementation = ResetRequest.class)))
            @Valid @RequestBody ResetRequest r) {
        auth.resetPassword(r);
        return msg("Đặt lại mật khẩu thành công! Hãy đăng nhập lại.");
    }

    // ============================================================
    // 6. ĐỔI MẬT KHẨU (yêu cầu đăng nhập)
    // ============================================================
    @Operation(
            summary = "Đổi mật khẩu (đã đăng nhập)",
            description = "Yêu cầu JWT trong header `Authorization: Bearer <token>`. "
                        + "Cần mật khẩu cũ để xác minh.",
            security = @SecurityRequirement(name = "bearerAuth")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Đổi mật khẩu thành công"),
            @ApiResponse(responseCode = "400", description = "Mật khẩu cũ không đúng / validation fail"),
            @ApiResponse(responseCode = "401", description = "Thiếu hoặc JWT không hợp lệ")
    })
    @PostMapping("/change-password")
    public ResponseEntity<?> change(
            @Parameter(hidden = true) Authentication a,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    required = true,
                    content = @Content(schema = @Schema(implementation = ChangePasswordRequest.class)))
            @Valid @RequestBody ChangePasswordRequest r) {
        auth.changePassword((String) a.getPrincipal(), r);
        return msg("Đổi mật khẩu thành công!");
    }

    // ============================================================
    // 7. LẤY THÔNG TIN USER HIỆN TẠI
    // ============================================================
    @Operation(
            summary = "Lấy thông tin user từ JWT",
            security = @SecurityRequirement(name = "bearerAuth")
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Thông tin user hiện tại",
                    content = @Content(schema = @Schema(implementation = MeResponse.class))),
            @ApiResponse(responseCode = "401", description = "Thiếu hoặc JWT không hợp lệ")
    })
    @GetMapping("/me")
    public MeResponse me(@Parameter(hidden = true) Authentication a) {
        User u = auth.me((String) a.getPrincipal());
        return new MeResponse(u.getEmail(), u.getFullName());
    }

    // ----- DTOs Swagger-only (không ảnh hưởng runtime) -----
    public record ErrorResponse(String message, Object errors) {}
    public record MessageResponse(String message) {}
    public record MeResponse(String email, String fullName) {}
}
```

> **JWT trong Swagger UI**: nhấn nút **"Authorize"** (ổ khóa trên cùng) → nhập JWT (chỉ phần token, không cần "Bearer ") → test `/change-password` và `/me`.

---

## 5. Cấu hình bổ sung (tùy chọn)

Nếu muốn đổi đường dẫn docs hoặc chỉ bật ở môi trường dev, thêm vào `application.yml`:

```yaml
springdoc:
  api-docs:
    path: /v3/api-docs        # OpenAPI JSON
  swagger-ui:
    path: /swagger-ui.html    # Swagger UI
    operationsSorter: alpha   # sort endpoints A-Z
    tagsSorter: alpha
```

---

## 6. Checklist tích hợp

- [ ] Thêm dependency `springdoc-openapi-starter-webmvc-ui` 2.7.0 vào `pom.xml`
- [ ] Tạo `server/src/main/java/com/calishealth/config/SwaggerConfig.java`
- [ ] Annotate `AuthController.java` (xem mục 4)
- [ ] Cho `SecurityConfig` permit `/v3/api-docs/**`, `/swagger-ui/**`, `/swagger-ui.html` (nếu cần truy cập khi đã bật Spring Security)

Ví dụ bổ sung vào `SecurityConfig`:

```java
.authorizeHttpRequests(a -> a
        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
        .requestMatchers("/api/auth/change-password", "/api/auth/me").authenticated()
        .requestMatchers("/api/auth/**").permitAll()
        .anyRequest().authenticated())
```
