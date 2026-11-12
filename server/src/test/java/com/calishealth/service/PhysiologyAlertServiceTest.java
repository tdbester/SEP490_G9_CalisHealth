package com.calishealth.service;

import com.calishealth.dtos.ExercisePhysiologyDTO;
import com.calishealth.dtos.PhysiologyAlertDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Kiểm thử luật cảnh báo sinh lý {@code R1_STATIC_ACCUMULATION}.
 *
 * <p>Luật này mô tả hiện tượng TÍCH LŨY nhiều bài co tĩnh trong một buổi
 * (theo {@code condition_desc} trong migration V76: từ 3 bài trở lên, hoặc có
 * bài đánh dấu SPIKE_RISK). Trước đây MỘT bài isometric đơn lẻ đã kích hoạt
 * luật mức DANGER và placeholder {@code {static_count}} bị hard-code là "1".
 */
class PhysiologyAlertServiceTest {

    private PhysiologyAlertService service;

    @BeforeEach
    void setUp() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(org.springframework.jdbc.core.RowMapper.class)))
                .thenAnswer(invocation -> List.of(
                        new PhysiologyAlertDTO(
                                "R1_STATIC_ACCUMULATION",
                                "Tích lũy bài giữ tĩnh trong một buổi",
                                "DANGER",
                                "Buổi này có {static_count} bài giữ tĩnh. Nghỉ 60-90 giây giữa các bài.")));
        service = new PhysiologyAlertService(jdbc);
    }

    private static ExercisePhysiologyDTO profile(String contractionType, String bpEffect) {
        return new ExercisePhysiologyDTO(
                contractionType, 3, 3, 60, 75, bpEffect, "MODERATE", "NONE", 3, "SPINE",
                "Thở đều", List.of(), "Ghi chú", List.of("EV_PLANK_2026"), List.of());
    }

    @Test
    @DisplayName("Một bài co tĩnh đơn lẻ KHÔNG kích hoạt luật DANGER")
    void singleStaticExerciseDoesNotTriggerDanger() {
        List<PhysiologyAlertDTO> alerts =
                service.evaluate(profile("ISOMETRIC", "RAISES"), 1);
        assertThat(alerts).isEmpty();
    }

    @Test
    @DisplayName("Hai bài co tĩnh vẫn chưa đủ ngưỡng 3 bài")
    void twoStaticExercisesDoNotTriggerDanger() {
        assertThat(service.evaluate(profile("ISOMETRIC", "RAISES"), 2)).isEmpty();
    }

    @Test
    @DisplayName("Từ 3 bài co tĩnh trở lên thì kích hoạt luật DANGER")
    void threeStaticExercisesTriggerDanger() {
        List<PhysiologyAlertDTO> alerts =
                service.evaluate(profile("ISOMETRIC", "RAISES"), 3);
        assertThat(alerts).hasSize(1);
        assertThat(alerts.get(0).ruleCode()).isEqualTo("R1_STATIC_ACCUMULATION");
        assertThat(alerts.get(0).severity()).isEqualTo("DANGER");
    }

    @Test
    @DisplayName("Placeholder {static_count} điền đúng số bài thực tế")
    void staticCountPlaceholderUsesRealCount() {
        List<PhysiologyAlertDTO> alerts =
                service.evaluate(profile("ISOMETRIC", "RAISES"), 5);
        assertThat(alerts).hasSize(1);
        assertThat(alerts.get(0).messageTemplate()).contains("có 5 bài giữ tĩnh");
    }

    @Test
    @DisplayName("Bài SPIKE_RISK kích hoạt luật dù chỉ có 1 bài trong buổi")
    void spikeRiskTriggersRegardlessOfCount() {
        List<PhysiologyAlertDTO> alerts =
                service.evaluate(profile("DYNAMIC", "SPIKE_RISK"), 1);
        assertThat(alerts).hasSize(1);
        assertThat(alerts.get(0).severity()).isEqualTo("DANGER");
    }

    @Test
    @DisplayName("Bài động bình thường không kích hoạt luật")
    void dynamicExerciseDoesNotTrigger() {
        assertThat(service.evaluate(profile("DYNAMIC", "NEUTRAL"), 5)).isEmpty();
    }
}
