package com.calishealth.service;

import com.calishealth.dtos.ExercisePhysiologyDTO;
import com.calishealth.dtos.PhysiologyAlertDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Kiểm thử luật {@code R3_ACUTE_CHRONIC_LOAD}.
 *
 * <p>Luật này không suy ra được từ hồ sơ một bài tập mà cần lịch sử tải tập:
 * tải 7 ngày gần nhất so với trung bình tuần trong 28 ngày. Trước đây luật có
 * trong DB nhưng không bao giờ khớp được, nên member không hề được cảnh báo.</p>
 */
class PhysiologyAlertServiceAcuteChronicTest {

    private JdbcTemplate jdbc;
    private PhysiologyAlertService service;

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(org.springframework.jdbc.core.RowMapper.class)))
                .thenAnswer(invocation -> List.of(new PhysiologyAlertDTO(
                        "R3_ACUTE_CHRONIC_LOAD",
                        "Tải tập 7 ngày tăng vượt nền 4 tuần",
                        "WARN",
                        "Tải tập 7 ngày của bạn cao hơn {ratio_pct} so với mức nền 4 tuần.")));
        service = new PhysiologyAlertService(jdbc);
    }

    /** Hồ sơ bài tập bình thường: không khớp R1/R2/R4 nên chỉ R3 có thể khớp. */
    private static ExercisePhysiologyDTO neutralProfile() {
        return new ExercisePhysiologyDTO(
                "DYNAMIC", 2, 3, 60, 75, "NEUTRAL", "NONE", "LOW", 1, "SPINE",
                "Thở đều", List.of(), "Ghi chú", List.of("EV_PLANK_2026"), List.of());
    }

    private void stubWorkload(long acuteLoad, long totalLoad, long sessionCount) {
        Map<String, Object> row = new HashMap<>();
        row.put("acute_load", acuteLoad);
        row.put("total_load", totalLoad);
        row.put("session_count", sessionCount);
        when(jdbc.queryForMap(anyString(), any(Object[].class))).thenReturn(row);
    }

    @Test
    @DisplayName("Tỉ lệ acute:chronic >= 1.5 thì kích hoạt luật R3")
    void highRatioTriggersRule() {
        // 7 ngày gần nhất: 1000 đơn vị tải; 28 ngày: 3000 -> trung bình tuần 750 -> ACR ~1.33
        // Dùng tổng 2400 -> trung bình tuần 600 -> ACR 1000/600 = 1.67
        stubWorkload(1000L, 2400L, 12L);

        List<PhysiologyAlertDTO> alerts =
                service.evaluate(neutralProfile(), 1, 42L);

        assertThat(alerts).hasSize(1);
        assertThat(alerts.get(0).ruleCode()).isEqualTo("R3_ACUTE_CHRONIC_LOAD");
        assertThat(alerts.get(0).severity()).isEqualTo("WARN");
    }

    @Test
    @DisplayName("Placeholder {ratio_pct} hiển thị phần trăm tăng so với nền")
    void ratioPlaceholderShowsPercent() {
        stubWorkload(1200L, 2400L, 12L); // ACR = 1200/600 = 2.0 -> +100%

        List<PhysiologyAlertDTO> alerts =
                service.evaluate(neutralProfile(), 1, 42L);

        assertThat(alerts).hasSize(1);
        assertThat(alerts.get(0).messageTemplate()).contains("+100%");
    }

    @Test
    @DisplayName("Tỉ lệ nằm trong vùng an toàn thì không kích hoạt luật")
    void safeRatioDoesNotTrigger() {
        stubWorkload(600L, 2400L, 12L); // ACR = 600/600 = 1.0

        assertThat(service.evaluate(neutralProfile(), 1, 42L)).isEmpty();
    }

    @Test
    @DisplayName("Chưa đủ số buổi tập tối thiểu thì không kích hoạt luật")
    void insufficientSessionsDoesNotTrigger() {
        stubWorkload(1000L, 1000L, 2L); // chỉ 2 buổi -> mẫu số nhiễu

        assertThat(service.evaluate(neutralProfile(), 1, 42L)).isEmpty();
    }

    @Test
    @DisplayName("Không có userId thì bỏ qua luật dựa trên lịch sử tập")
    void withoutUserIdRuleIsSkipped() {
        stubWorkload(5000L, 5000L, 20L);

        assertThat(service.evaluate(neutralProfile(), 1, null)).isEmpty();
    }
}
