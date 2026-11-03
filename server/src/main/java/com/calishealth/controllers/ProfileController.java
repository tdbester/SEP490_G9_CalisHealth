package com.calishealth.controllers;

import com.calishealth.dtos.ProfileDtos.ChangeOwnPasswordRequest;
import com.calishealth.dtos.ProfileDtos.ProfileResponse;
import com.calishealth.dtos.ProfileDtos.UpdateProfileRequest;
import com.calishealth.service.ProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * Profile Information screen of every signed-in account (MEMBER, CONTENT_MANAGER, ADMIN).
 * <p>
 * Authentication only: each request acts on the caller's own account read from the JWT, so the
 * role guards of the /api/content/** and /api/admin/** areas do not apply here.
 * Password changes stay on {@code POST /api/auth/change-password}.
 */
@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {
    private final ProfileService service;

    @GetMapping
    public ProfileResponse get(Authentication a) {
        return service.get((String) a.getPrincipal());
    }

    @PutMapping
    public ProfileResponse update(Authentication a, @Valid @RequestBody UpdateProfileRequest r) {
        return service.update((String) a.getPrincipal(), r);
    }

    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ProfileResponse uploadAvatar(Authentication a, @RequestParam("file") MultipartFile file) {
        return service.updateAvatar((String) a.getPrincipal(), file);
    }

    @DeleteMapping("/avatar")
    public ProfileResponse removeAvatar(Authentication a) {
        return service.removeAvatar((String) a.getPrincipal());
    }

    /** Changes the caller's own password and returns the refreshed security card. */
    @PostMapping("/password")
    public ProfileResponse changePassword(Authentication a, @Valid @RequestBody ChangeOwnPasswordRequest r) {
        return service.changePassword((String) a.getPrincipal(), r);
    }
}
