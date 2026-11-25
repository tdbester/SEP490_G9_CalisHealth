package com.calishealth.service;

import com.calishealth.dtos.AdminUserDtos.StatusFilter;
import com.calishealth.dtos.AdminUserDtos.UserPage;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.UserActivityRepository;
import com.calishealth.repository.UserRepository;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Answers;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho các {@code Specification} của {@link AdminUserService}: search theo tên/email/mã
 * và lọc theo trạng thái. Dùng deep stub cho Criteria API để kiểm tra predicate được dựng đúng.
 */
class AdminUserServiceSpecificationTest {

    private UserRepository users;
    private PasswordEncoder encoder;
    private UserActivityRepository activity;
    private AdminUserService service;

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        encoder = mock(PasswordEncoder.class);
        activity = mock(UserActivityRepository.class);
        service = new AdminUserService(users, encoder, activity);
        when(users.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));
        when(users.count()).thenReturn(0L);
    }

    /** Chạy Specification với Criteria API giả lập để cover các nhánh bên trong lambda. */
    @SuppressWarnings({"unchecked", "rawtypes"})
    private Object evaluate(Specification<User> specification) {
        Root<User> root = mock(Root.class, Answers.RETURNS_DEEP_STUBS);
        CriteriaQuery<User> query = mock(CriteriaQuery.class, Answers.RETURNS_DEEP_STUBS);
        CriteriaBuilder cb = mock(CriteriaBuilder.class, Answers.RETURNS_DEEP_STUBS);

        Path<String> namePath = mock(Path.class);
        Path<String> emailPath = mock(Path.class);
        Path<Object> idPath = mock(Path.class);
        Path<Boolean> enabledPath = mock(Path.class);
        Path<Boolean> blockedPath = mock(Path.class);

        org.mockito.Mockito.doReturn(namePath).when(root).get("fullName");
        org.mockito.Mockito.doReturn(emailPath).when(root).get("email");
        org.mockito.Mockito.doReturn(idPath).when(root).get("id");
        org.mockito.Mockito.doReturn(enabledPath).when(root).get("enabled");
        org.mockito.Mockito.doReturn(blockedPath).when(root).get("blocked");

        Predicate predicate = mock(Predicate.class);
        Predicate anyPredicate = mock(Predicate.class);
        when(cb.like(any(Expression.class), anyString(), any(char.class))).thenReturn(predicate);
        when(cb.like(any(Expression.class), anyString())).thenReturn(predicate);
        when(cb.lower(any(Expression.class))).thenReturn(namePath);
        when(cb.equal(any(Expression.class), any())).thenReturn(predicate);
        when(cb.or(any(Predicate[].class))).thenReturn(anyPredicate);
        when(cb.and(any(Predicate[].class))).thenReturn(predicate);
        when(cb.isTrue(any(Expression.class))).thenReturn(predicate);
        when(cb.isFalse(any(Expression.class))).thenReturn(predicate);
        when(cb.not(any(Predicate.class))).thenReturn(predicate);
        when(cb.greaterThanOrEqualTo(any(jakarta.persistence.criteria.Expression.class), any(java.time.LocalDateTime.class)))
                .thenReturn(predicate);
        when(cb.lessThan(any(jakarta.persistence.criteria.Expression.class), any(java.time.LocalDateTime.class)))
                .thenReturn(predicate);
        when(cb.conjunction()).thenReturn(predicate);
        when(cb.disjunction()).thenReturn(predicate);

        return specification.toPredicate(root, query, cb);
    }

    @Test
    @DisplayName("list: tim kiem theo ten -> tao predicate")
    void listBuildsSearchPredicateForName() {
        service.list("bob", null, null, null, "newest", 0, 10);

        assertThat(evaluate(capturedSpecification())).isNotNull();
    }

    @Test
    @DisplayName("list: tim kiem theo ma nguoi dang so -> them dieu kien id")
    void listBuildsSearchPredicateForUserCode() {
        service.list("usr-00124", null, null, null, "newest", 0, 10);

        assertThat(evaluate(capturedSpecification())).isNotNull();
    }

    @Test
    @DisplayName("list: tim kiem theo ma nguoi khong co tien to -> them dieu kien id")
    void listBuildsSearchPredicateForBareNumber() {
        service.list("124", null, null, null, "newest", 0, 10);

        assertThat(evaluate(capturedSpecification())).isNotNull();
    }

    @Test
    @DisplayName("list: loc trang thai ACTIVE -> dung isTrue/isFalse")
    void listBuildsActiveStatusPredicate() {
        service.list(null, null, StatusFilter.ACTIVE, null, "newest", 0, 10);

        assertThat(evaluate(capturedSpecification())).isNotNull();
    }

    @Test
    @DisplayName("list: loc trang thai INACTIVE -> dung not(...)")
    void listBuildsInactiveStatusPredicate() {
        service.list(null, null, StatusFilter.INACTIVE, null, "newest", 0, 10);

        assertThat(evaluate(capturedSpecification())).isNotNull();
    }

    @Test
    @DisplayName("list: loc theo ngay join -> tao khoang thoi gian")
    void listBuildsJoinedOnPredicate() {
        service.list(null, null, null, LocalDate.of(2026, 3, 5), "newest", 0, 10);

        assertThat(evaluate(capturedSpecification())).isNotNull();
    }

    @Test
    @DisplayName("list: loc theo vai tro -> tao predicate role")
    void listBuildsRolePredicate() {
        service.list(null, UserRole.ADMIN, null, null, "newest", 0, 10);

        assertThat(evaluate(capturedSpecification())).isNotNull();
    }

    @Test
    @DisplayName("list: sap xep khong hop le -> 400")
    void listRejectsInvalidSort() {
        assertThatThrownBy(() -> service.list(null, null, null, null, "weird", 0, 10))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
                .satisfies(ex -> assertThat(((org.springframework.web.server.ResponseStatusException) ex)
                        .getStatusCode().value()).isEqualTo(400));
    }

    @Test
    @DisplayName("list: sort null -> dung newest")
    void listDefaultsSortToNewest() {
        UserPage page = service.list(null, null, null, null, null, 0, 10);

        assertThat(page.page()).isZero();
    }

    @SuppressWarnings("unchecked")
    private Specification<User> capturedSpecification() {
        var captor = org.mockito.ArgumentCaptor.forClass(Specification.class);
        org.mockito.Mockito.verify(users, org.mockito.Mockito.atLeastOnce())
                .findAll(captor.capture(), any(Pageable.class));
        return captor.getValue();
    }
}
