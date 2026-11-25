package com.calishealth.service;

import com.calishealth.dtos.ExercisePhysiologyDTO;
import com.calishealth.dtos.PhysiologyAlertDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho {@link PhysiologyAlertService}: các luật R2/R3/R4,
 * fallback khi bảng chưa migrate, ACR và nhãn khớp.
 */
class PhysiologyAlertServiceCoverageTest {

    private JdbcTemplate jdbc;
    private PhysiologyAlertService service;

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        service = new PhysiologyAlertService(jdbc);
    }

    /** Dựng 1 ResultSet giả để RowMapper của service được gọi thật. */
    private static java.sql.ResultSet resultSet(String ruleCode, String title, String severity, String message) {
        java.sql.ResultSet rs = mock(java.sql.ResultSet.class);
        try {
            when(rs.getString("rule_code")).thenReturn(ruleCode);
            when(rs.getString("title")).thenReturn(title);
            when(rs.getString("severity")).thenReturn(severity);
            when(rs.getString("message_template")).thenReturn(message);
        } catch (java.sql.SQLException exception) {
            throw new RuntimeException(exception);
        }
        return rs;
    }

    private void stubRules(List<PhysiologyAlertDTO> rules) {
        when(jdbc.query(anyString(), any(RowMapper.class))).thenAnswer(invocation -> {
            RowMapper<PhysiologyAlertDTO> mapper = invocation.getArgument(1);
            java.sql.ResultSet rs = resultSet(rules.get(0).ruleCode(), rules.get(0).title(),
                    rules.get(0).severity(), rules.get(0).messageTemplate());
            return rules.stream().map(r -> {
                try {
                    return mapper.mapRow(rs, 0);
                } catch (java.sql.SQLException exception) {
                    throw new RuntimeException(exception);
                }
            }).toList();
        });
    }

    private static ExercisePhysiologyDTO profile(String contractionType, String bpEffect, String giRisk,
            Integer tendonLoad, String joint) {
        return new ExercisePhysiologyDTO(
                contractionType, 3, 3, 60, 75, bpEffect, "MODERATE", giRisk, tendonLoad, joint,
                "Thở đều", List.of(), "Ghi chú");
    }

    @Test
    @DisplayName("listActiveRules: doc tuong doi va sap xep theo severity")
    void listActiveRulesReadsRows() {
        when(jdbc.query(anyString(), any(RowMapper.class))).thenAnswer(invocation -> {
            RowMapper<PhysiologyAlertDTO> mapper = invocation.getArgument(1);
            java.sql.ResultSet rs = resultSet("R1_STATIC_ACCUMULATION", "Tich luy", "DANGER",
                    "Buoi nay co {static_count} bai giu tinh va {joint} can nghi.");
            try {
                return List.of(mapper.mapRow(rs, 0));
            } catch (java.sql.SQLException exception) {
                throw new RuntimeException(exception);
            }
        });

        List<PhysiologyAlertDTO> rules = service.listActiveRules();

        assertThat(rules).singleElement().satisfies(rule -> {
            assertThat(rule.ruleCode()).isEqualTo("R1_STATIC_ACCUMULATION");
            assertThat(rule.severity()).isEqualTo("DANGER");
        });
    }

    @Test
    @DisplayName("listActiveRules: bang chua migrate -> tra ve danh sach rong")
    void listActiveRulesFailsSoft() {
        when(jdbc.query(anyString(), any(RowMapper.class))).thenThrow(new RuntimeException("no table"));

        assertThat(service.listActiveRules()).isEmpty();
    }

    @Test
    @DisplayName("evaluate: profile null -> khong co canh bao")
    void evaluateWithoutProfile() {
        assertThat(service.evaluate(null)).isEmpty();
    }

    @Test
    @DisplayName("evaluate: rule code null -> bo qua")
    void evaluateIgnoresNullRuleCode() {
        stubRules(List.of(new PhysiologyAlertDTO(null, "T", "INFO", "m")));

        assertThat(service.evaluate(profile("DYNAMIC", "NEUTRAL", "NONE", 1, "SPINE"))).isEmpty();
    }

    @Test
    @DisplayName("evaluate: rule la -> bo qua")
    void evaluateIgnoresUnknownRule() {
        stubRules(List.of(new PhysiologyAlertDTO("R9_UNKNOWN", "T", "INFO", "m")));

        assertThat(service.evaluate(profile("DYNAMIC", "NEUTRAL", "NONE", 1, "SPINE"))).isEmpty();
    }

    @Test
    @DisplayName("evaluate: R2 tendon load cao -> canh bao")
    void evaluateTendonRecovery() {
        stubRules(List.of(new PhysiologyAlertDTO("R2_TENDON_RECOVERY", "Gân", "WARN",
                "Tải gân {joint} cao")));

        List<PhysiologyAlertDTO> alerts = service.evaluate(profile("DYNAMIC", "NEUTRAL", "NONE", 5, "KNEE"));

        assertThat(alerts).singleElement().satisfies(alert -> {
            assertThat(alert.ruleCode()).isEqualTo("R2_TENDON_RECOVERY");
            assertThat(alert.messageTemplate()).contains("gối");
        });
    }

    @Test
    @DisplayName("evaluate: R4 gi risk cao -> canh bao")
    void evaluateDigestiveDiscomfort() {
        stubRules(List.of(new PhysiologyAlertDTO("R4_DIGESTIVE_DISCOMFORT", "Tiêu", "INFO", "m")));

        assertThat(service.evaluate(profile("DYNAMIC", "NEUTRAL", "HIGH", 1, "SPINE"))).hasSize(1);
        assertThat(service.evaluate(profile("DYNAMIC", "NEUTRAL", "MODERATE", 1, "SPINE"))).hasSize(1);
        assertThat(service.evaluate(profile("DYNAMIC", "NEUTRAL", "LOW", 1, "SPINE"))).isEmpty();
    }

    @Test
    @DisplayName("evaluate: R3 ACR >= 1.5 -> canh bao")
    void evaluateAcuteChronicLoad() {
        stubRules(List.of(new PhysiologyAlertDTO("R3_ACUTE_CHRONIC_LOAD", "Tải", "DANGER",
                "Tải 7 ngày cao hơn {ratio_pct}")));

        Map<String, Object> row = new HashMap<>();
        row.put("session_count", 8L);
        row.put("acute_load", 120L);
        row.put("total_load", 160L);
        when(jdbc.queryForMap(anyString(), eq(7L))).thenReturn(row);

        List<PhysiologyAlertDTO> alerts = service.evaluate(
                profile("DYNAMIC", "NEUTRAL", "NONE", 1, "SPINE"), 1, 7L);

        assertThat(alerts).singleElement().satisfies(alert -> {
            assertThat(alert.ruleCode()).isEqualTo("R3_ACUTE_CHRONIC_LOAD");
            assertThat(alert.messageTemplate()).contains("+200%");
        });
    }

    @Test
    @DisplayName("evaluate: khong co userId -> bo qua luat R3")
    void evaluateWithoutUserSkipsAcuteChronicRule() {
        stubRules(List.of(new PhysiologyAlertDTO("R3_ACUTE_CHRONIC_LOAD", "Tải", "DANGER", "m")));

        assertThat(service.evaluate(profile("DYNAMIC", "NEUTRAL", "NONE", 1, "SPINE"))).isEmpty();
    }

    @Test
    @DisplayName("countStaticExercisesInLatestSession: user null -> 0")
    void countStaticWithNullUser() {
        assertThat(service.countStaticExercisesInLatestSession(null)).isZero();
    }

    @Test
    @DisplayName("countStaticExercisesInLatestSession: co du lieu -> tra ve so bai")
    void countStaticWithData() {
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(7L), eq(7L))).thenReturn(4);

        assertThat(service.countStaticExercisesInLatestSession(7L)).isEqualTo(4);
    }

    @Test
    @DisplayName("countStaticExercisesInLatestSession: null -> 0")
    void countStaticWithNullCount() {
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(7L), eq(7L))).thenReturn(null);

        assertThat(service.countStaticExercisesInLatestSession(7L)).isZero();
    }

    @Test
    @DisplayName("countStaticExercisesInLatestSession: loi -> 0")
    void countStaticFailsSoft() {
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(7L), eq(7L)))
                .thenThrow(new RuntimeException("no table"));

        assertThat(service.countStaticExercisesInLatestSession(7L)).isZero();
    }

    @Test
    @DisplayName("acuteChronicRatio: user null -> rong")
    void acuteChronicRatioWithoutUser() {
        assertThat(service.acuteChronicRatio(null)).isEmpty();
    }

    @Test
    @DisplayName("acuteChronicRatio: it buoi tap -> rong")
    void acuteChronicRatioWithTooFewSessions() {
        Map<String, Object> row = new HashMap<>();
        row.put("session_count", 2L);
        row.put("acute_load", 10L);
        row.put("total_load", 20L);
        when(jdbc.queryForMap(anyString(), eq(7L))).thenReturn(row);

        assertThat(service.acuteChronicRatio(7L)).isEmpty();
    }

    @Test
    @DisplayName("acuteChronicRatio: mau so bang 0 -> rong")
    void acuteChronicRatioWithZeroChronicLoad() {
        Map<String, Object> row = new HashMap<>();
        row.put("session_count", 8L);
        row.put("acute_load", 0L);
        row.put("total_load", 0L);
        when(jdbc.queryForMap(anyString(), eq(7L))).thenReturn(row);

        assertThat(service.acuteChronicRatio(7L)).isEmpty();
    }

    @Test
    @DisplayName("acuteChronicRatio: du du lieu -> tra ve ti le")
    void acuteChronicRatioWithData() {
        Map<String, Object> row = new HashMap<>();
        row.put("session_count", 8L);
        row.put("acute_load", 100L);
        row.put("total_load", 200L);
        when(jdbc.queryForMap(anyString(), eq(7L))).thenReturn(row);

        Optional<Double> ratio = service.acuteChronicRatio(7L);

        assertThat(ratio).isPresent();
        assertThat(ratio.get()).isEqualTo(2.0);
    }

    @Test
    @DisplayName("acuteChronicRatio: loi -> rong")
    void acuteChronicRatioFailsSoft() {
        when(jdbc.queryForMap(anyString(), eq(7L))).thenThrow(new RuntimeException("no table"));

        assertThat(service.acuteChronicRatio(7L)).isEmpty();
    }

    @Test
    @DisplayName("acuteChronicRatio: gia tri khong phai so -> 0")
    void acuteChronicRatioWithNonNumericValue() {
        Map<String, Object> row = new HashMap<>();
        row.put("session_count", 8L);
        row.put("acute_load", "abc");
        row.put("total_load", 200L);
        when(jdbc.queryForMap(anyString(), eq(7L))).thenReturn(row);

        assertThat(service.acuteChronicRatio(7L)).get().isEqualTo(0.0);
    }

    @Test
    @DisplayName("evaluate: message template null -> thong diep rong")
    void evaluateHandlesNullMessageTemplate() {
        stubRules(List.of(new PhysiologyAlertDTO("R2_TENDON_RECOVERY", "Gân", "WARN", null)));

        assertThat(service.evaluate(profile("DYNAMIC", "NEUTRAL", "NONE", 5, "SPINE")).get(0)
                .messageTemplate()).isEmpty();
    }

    @Test
    @DisplayName("evaluate: khớp rong -> nhan 'khớp'")
    void evaluateHandlesBlankJoint() {
        stubRules(List.of(new PhysiologyAlertDTO("R2_TENDON_RECOVERY", "Gân", "WARN", "Tai {joint}")));

        assertThat(service.evaluate(profile("DYNAMIC", "NEUTRAL", "NONE", 5, "  ")).get(0)
                .messageTemplate()).contains("khớp");
    }

    @Test
    @DisplayName("evaluate: các khớp khac -> nhan tieng Viet")
    void evaluateMapsJointLabels() {
        Map<String, String> expected = Map.of(
                "WRIST", "cổ tay",
                "ELBOW", "khuỷu tay",
                "SHOULDER", "vai",
                "SPINE", "cột sống",
                "HIP", "hông",
                "KNEE", "gối",
                "ANKLE", "cổ chân");

        expected.forEach((joint, label) -> {
            stubRules(List.of(new PhysiologyAlertDTO("R2_TENDON_RECOVERY", "Gân", "WARN", "Tai {joint}")));
            assertThat(service.evaluate(profile("DYNAMIC", "NEUTRAL", "NONE", 5, joint)).get(0)
                    .messageTemplate()).contains(label);
        });
    }

    @Test
    @DisplayName("evaluate: khớp la -> chu thuong")
    void evaluateFallsBackToRawJoint() {
        stubRules(List.of(new PhysiologyAlertDTO("R2_TENDON_RECOVERY", "Gân", "WARN", "Tai {joint}")));

        assertThat(service.evaluate(profile("DYNAMIC", "NEUTRAL", "NONE", 5, "Cervical")).get(0)
                .messageTemplate()).contains("cervical");
    }

    @Test
    @DisplayName("evaluate: ACR khong xac dinh -> ratio '—'")
    void evaluateRendersUnknownRatio() {
        stubRules(List.of(new PhysiologyAlertDTO("R3_ACUTE_CHRONIC_LOAD", "Tải", "DANGER",
                "Tải cao hơn {ratio_pct}")));

        Map<String, Object> row = new HashMap<>();
        row.put("session_count", 8L);
        row.put("acute_load", 0L);
        row.put("total_load", 200L);
        when(jdbc.queryForMap(anyString(), eq(7L))).thenReturn(row);

        assertThat(service.evaluate(profile("DYNAMIC", "NEUTRAL", "NONE", 1, "SPINE"), 1, 7L)).isEmpty();
    }
}
