package com.calishealth.service;

import com.calishealth.dtos.AdminUserDtos.*;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class AdminUserService {
    static final int MAX_PAGE_SIZE = 50;
    /** Initial password of every staff account created from the admin area. */
    public static final String DEFAULT_STAFF_PASSWORD = "Test@123";
    private static final Pattern USER_CODE = Pattern.compile("^(?:usr-?)?(\\d{1,18})$", Pattern.CASE_INSENSITIVE);

    private final UserRepository users;
    private final PasswordEncoder encoder;

    public static String userCode(Long id) {
        return String.format("USR-%05d", id);
    }

    private static UserItem toItem(User u) {
        return new UserItem(u.getId(), userCode(u.getId()), u.getFullName(), u.getEmail(),
                u.getRole().name(), u.isActive(), u.getCreatedAt());
    }

    private static ResponseStatusException err(HttpStatus s, String msg) {
        return new ResponseStatusException(s, msg);
    }

    private static Sort sortFor(String sort) {
        String key = sort == null ? "newest" : sort.toLowerCase(Locale.ROOT);
        return switch (key) {
            case "oldest" -> Sort.by(Sort.Order.asc("createdAt"), Sort.Order.asc("id"));
            case "name_asc" -> Sort.by(Sort.Order.asc("fullName").ignoreCase(), Sort.Order.asc("id"));
            case "name_desc" -> Sort.by(Sort.Order.desc("fullName").ignoreCase(), Sort.Order.asc("id"));
            case "newest" -> Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
            default -> throw err(HttpStatus.BAD_REQUEST, "Parameter 'sort' has an invalid value");
        };
    }

    /** Matches name, email, or the user code ("USR-00124", "00124", "124"). */
    private static Specification<User> searchSpec(String q) {
        String term = q.trim().toLowerCase(Locale.ROOT);
        String like = "%" + term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        Matcher m = USER_CODE.matcher(term);
        Long id = m.matches() ? Long.valueOf(m.group(1)) : null;
        return (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> any = new ArrayList<>();
            any.add(cb.like(cb.lower(root.get("fullName")), like, '\\'));
            any.add(cb.like(cb.lower(root.get("email")), like, '\\'));
            if (id != null) any.add(cb.equal(root.get("id"), id));
            return cb.or(any.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    /** Mirrors User.isActive(): enabled and not blocked. */
    private static Specification<User> statusSpec(StatusFilter status) {
        return (root, query, cb) -> {
            var active = cb.and(cb.isTrue(root.get("enabled")), cb.isFalse(root.get("blocked")));
            return status == StatusFilter.ACTIVE ? active : cb.not(active);
        };
    }

    @Transactional(readOnly = true)
    public UserPage list(String q, UserRole role, StatusFilter status, LocalDate joinedOn,
                         String sort, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);

        Specification<User> spec = (root, query, cb) -> cb.conjunction();
        if (q != null && !q.isBlank()) spec = spec.and(searchSpec(q));
        if (role != null) spec = spec.and((root, query, cb) -> cb.equal(root.get("role"), role));
        if (status != null) spec = spec.and(statusSpec(status));
        if (joinedOn != null) {
            LocalDateTime start = joinedOn.atStartOfDay();
            LocalDateTime endExclusive = joinedOn.plusDays(1).atStartOfDay();
            spec = spec.and((root, query, cb) -> cb.and(
                    cb.greaterThanOrEqualTo(root.<LocalDateTime>get("createdAt"), start),
                    cb.lessThan(root.<LocalDateTime>get("createdAt"), endExclusive)));
        }

        Page<User> result = users.findAll(spec, PageRequest.of(safePage, safeSize, sortFor(sort)));
        return new UserPage(result.getContent().stream().map(AdminUserService::toItem).toList(),
                safePage, safeSize, result.getTotalElements(), result.getTotalPages(), summary());
    }

    @Transactional(readOnly = true)
    public Summary summary() {
        Map<String, Long> byRole = new LinkedHashMap<>();
        for (UserRole r : UserRole.values()) byRole.put(r.name(), users.countByRole(r));
        long total = users.count();
        long active = users.countByEnabledAndBlocked(true, false);
        // Inactive = everyone who cannot sign in (blocked or email not verified), same rule as the Status filter.
        return new Summary(total, active, total - active, byRole);
    }

    @Transactional
    public UserItem create(CreateUserRequest r) {
        if (r.role() == UserRole.MEMBER)
            throw err(HttpStatus.BAD_REQUEST, "Only Admin or Content Manager accounts can be created here");
        String email = r.email().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmail(email))
            throw err(HttpStatus.CONFLICT, "Email is already registered");
        User u = new User();
        u.setEmail(email);
        u.setFullName(r.fullName().trim());
        u.setPassword(encoder.encode(DEFAULT_STAFF_PASSWORD));
        u.setRole(r.role());
        u.setEnabled(true); // created by an admin, so no email verification step
        u.setBlocked(false);
        // Only content managers must replace the default password on first login; admins keep it.
        u.setMustChangePassword(r.role() == UserRole.CONTENT_MANAGER);
        try {
            return toItem(users.saveAndFlush(u));
        } catch (DataIntegrityViolationException e) {
            // Two admins created the same email at the same time; the unique index caught it.
            throw err(HttpStatus.CONFLICT, "Email is already registered");
        }
    }

    /** Activate (unblock) or deactivate (block) users. An admin cannot deactivate their own account. */
    @Transactional
    public BulkResult setActive(String actingEmail, BulkStatusRequest r) {
        List<Long> ids = r.ids().stream().distinct().toList();
        List<User> found = users.findAllById(ids);
        if (found.size() != ids.size())
            throw err(HttpStatus.NOT_FOUND, "Some selected users no longer exist");
        if (!r.active() && found.stream().anyMatch(u -> u.getEmail().equalsIgnoreCase(actingEmail)))
            throw err(HttpStatus.BAD_REQUEST, "You cannot deactivate your own account");

        int affected = 0;
        for (User u : found) {
            if (u.isActive() != r.active()) {
                if (r.active()) {
                    u.setBlocked(false);
                    u.setEnabled(true); // activating by hand also counts as verifying the account
                } else {
                    u.setBlocked(true);
                }
                affected++;
            }
        }
        users.saveAll(found);
        return new BulkResult(affected);
    }
}
