package com.calishealth.controllers;

import com.calishealth.dtos.AdminUserDtos.*;
import com.calishealth.models.UserRole;
import com.calishealth.service.AdminUserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/** Protected by SecurityConfig: /api/admin/** requires ROLE_ADMIN. */
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {
    private final AdminUserService service;

    @GetMapping
    public UserPage list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) UserRole role,
            @RequestParam(required = false) StatusFilter status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate joinedOn,
            @RequestParam(defaultValue = "newest") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return service.list(q, role, status, joinedOn, sort, page, size);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserItem create(@Valid @RequestBody CreateUserRequest r) {
        return service.create(r);
    }

    @PatchMapping("/status")
    public BulkResult updateStatus(Authentication a, @Valid @RequestBody BulkStatusRequest r) {
        return service.setActive((String) a.getPrincipal(), r);
    }
}
