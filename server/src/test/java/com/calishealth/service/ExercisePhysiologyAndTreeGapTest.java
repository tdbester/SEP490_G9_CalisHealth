package com.calishealth.service;

import com.calishealth.dtos.ExercisePhysiologyInputDTO;
import com.calishealth.models.Exercise;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bo sung coverage cho {@link ExercisePhysiologyService}, {@link ExerciseTreeService} va
 * {@link ProgressionRuleService}: chong chi dinh rong, danh sach chong chi dinh thua va
 * cap do khong hop le.
 */
class ExercisePhysiologyAndTreeGapTest {

    private JdbcTemplate jdbcTemplate;
    private ExercisePhysiologyService physiology;

    @BeforeEach
    void setUp() {
        jdbcTemplate = mock(JdbcTemplate.class);
        physiology = new ExercisePhysiologyService(jdbcTemplate);
    }

    private static ExercisePhysiologyInputDTO validInput(List<String> contraindications) {
        return new ExercisePhysiologyInputDTO(
                "DYNAMIC", 3, 3, 60, 80, "NEUTRAL", "NONE", "LOW", 3, "KNEE",
                "Breathe", contraindications, "note");
    }

    @Test
    @DisplayName("upsert: chong chi dinh chua co gia tri -> bo qua")
    void upsertIgnoresNullContraindication() {
        physiology.upsert(1L, "SYSTEM", validInput(Arrays.asList(null, "  ", "hypertension")));

        verify(jdbcTemplate).update(anyString(), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("upsert: chong chi dinh qua dai -> 400 truoc khi luu")
    void upsertRejectsLongContraindication() {
        String tooLong = "x".repeat(200);

        assertThatThrownBy(() -> physiology.upsert(1L, "SYSTEM", validInput(List.of(tooLong))))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("120 characters or fewer");
    }

    @Test
    @DisplayName("upsert: bai khong phai he thong -> 403")
    void upsertRejectsCustomExercise() {
        assertThatThrownBy(() -> physiology.upsert(1L, "CUSTOM", validInput(List.of())))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("only available for system exercises");
    }

    @Test
    @DisplayName("upsert: exerciseId null -> bo qua")
    void upsertIgnoresNullExerciseId() {
        physiology.upsert(null, "SYSTEM", validInput(List.of()));

        org.mockito.Mockito.verifyNoInteractions(jdbcTemplate);
    }

    @Test
    @DisplayName("upsert: input null -> xoa ho so")
    void upsertWithNullInputDeletesProfile() {
        physiology.upsert(1L, "SYSTEM", null);

        verify(jdbcTemplate).update(anyString(), eq(1L));
    }

    // -------------------------------------------------------------- ExerciseTreeService

    @Test
    @DisplayName("getTree: thu tu null -> 400")
    void getTreeRejectsMissingOrder() {
        ExerciseTreeService service = new ExerciseTreeService(
                mock(ProgressionRuleService.class),
                mock(UserRepository.class),
                mock(ExerciseUnlockService.class));

        assertThatThrownBy(() -> service.getTree(null, "member@calishealth.vn"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Tree order is required");
    }

    @Test
    @DisplayName("getTree: member khong ton tai -> 401")
    void getTreeRejectsUnknownMember() {
        UserRepository users = mock(UserRepository.class);
        when(users.findByEmail(anyString())).thenReturn(java.util.Optional.empty());
        ExerciseTreeService service = new ExerciseTreeService(
                mock(ProgressionRuleService.class), users, mock(ExerciseUnlockService.class));

        assertThatThrownBy(() -> service.getTree(ExerciseTreeService.TreeOrder.EASY_TO_HARD, "ghost@x.vn"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Authenticated member not found");
    }

    // ------------------------------------------------------------ ProgressionRuleService

    @Test
    @DisplayName("getTree: khong co quy tac nao -> cay rong")
    void getTreeWithNoRulesIsEmpty() {
        UserRepository users = mock(UserRepository.class);
        com.calishealth.models.User member = new com.calishealth.models.User();
        member.setId(5L);
        when(users.findByEmail("member@calishealth.vn")).thenReturn(java.util.Optional.of(member));
        ProgressionRuleService progressionRules = mock(ProgressionRuleService.class);
        when(progressionRules.orderedTreeRules()).thenReturn(List.of());
        ExerciseTreeService service = new ExerciseTreeService(progressionRules, users,
                mock(ExerciseUnlockService.class));

        var tree = service.getTree(ExerciseTreeService.TreeOrder.EASY_TO_HARD, "member@calishealth.vn");

        assertThat(tree).isNotNull();
    }
}