package com.calishealth.service;

import com.calishealth.dtos.ExercisePhysiologyDTO;
import com.calishealth.dtos.ExercisePhysiologyInputDTO;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Unit test cho {@link ExercisePhysiologyService}. */
@ExtendWith(MockitoExtension.class)
class ExercisePhysiologyServiceTest {
    @Mock private JdbcTemplate jdbcTemplate;
    @InjectMocks private ExercisePhysiologyService service;

    private static ExercisePhysiologyInputDTO validInput() {
        return new ExercisePhysiologyInputDTO(
                "DYNAMIC",
                3,
                3,
                60,
                80,
                "NEUTRAL",
                "LOW",
                "NONE",
                3,
                "KNEE",
                "Exhale on effort",
                List.of("hypertension"),
                "Standard push-up physiology");
    }

    // ---------------------------------------------------------------- upsert

    @Test
    @DisplayName("upsert: exerciseId null -> khong lam gi")
    void upsertIgnoresNullExerciseId() {
        service.upsert(null, "SYSTEM", validInput());

        verify(jdbcTemplate, never()).update(anyString(), any(Object[].class));
    }

    @Test
    @DisplayName("upsert: bai CUSTOM -> 403")
    void upsertRejectsCustomExercise() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.upsert(1L, "CUSTOM", validInput()));
        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
    }

    @Test
    @DisplayName("upsert: input null -> xoa ho so")
    void upsertDeletesWhenInputNull() {
        service.upsert(7L, "SYSTEM", null);

        verify(jdbcTemplate).update(eq("DELETE FROM exercise_physiology_profiles WHERE exercise_id = ?"), eq(7L));
    }

    @Test
    @DisplayName("upsert: luu ho so sinh lý cho bai he thong")
    void upsertStoresProfile() {
        service.upsert(1L, "SYSTEM", validInput());

        ArgumentCaptor<Object[]> captor = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate).update(anyString(), captor.capture());
        Object[] args = captor.getValue();
        assertEquals(1L, args[0]);
        assertEquals("DYNAMIC", args[1]);
        assertEquals(3, args[2]);
        assertEquals("NEUTRAL", args[6]);
        assertEquals("KNEE", args[10]);
    }

    @Test
    @DisplayName("upsert: khong ghi cot trich dan nguon")
    void upsertDoesNotWriteEvidenceColumn() {
        service.upsert(1L, "SYSTEM", validInput());

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).update(sql.capture(), any(Object[].class));
        assertEquals(false, sql.getValue().contains("evidence_refs"));
    }

    @Test
    @DisplayName("upsert: chuan hoa contraindications - trim, bo rong, khu trung lap")
    void upsertCleansContraindications() {
        ExercisePhysiologyInputDTO input = new ExercisePhysiologyInputDTO(
                "DYNAMIC", 3, 3, 60, 80, "NEUTRAL", "LOW", "NONE", 3, "KNEE", "breathe",
                List.of("  hypertension  ", "", "HYPERTENSION", "glaucoma"), "note");

        service.upsert(1L, "SYSTEM", input);

        ArgumentCaptor<Object[]> captor = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate).update(anyString(), captor.capture());
        Object[] args = captor.getValue();
        assertEquals("[\"hypertension\",\"glaucoma\"]", args[12]);
    }

    @Test
    @DisplayName("upsert: contraindications null -> mang rong")
    void upsertHandlesNullContraindications() {
        ExercisePhysiologyInputDTO input = new ExercisePhysiologyInputDTO(
                "DYNAMIC", 3, 3, 60, 80, "NEUTRAL", "LOW", "NONE", 3, "KNEE", "breathe",
                null, "note");

        service.upsert(1L, "SYSTEM", input);

        ArgumentCaptor<Object[]> captor = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate).update(anyString(), captor.capture());
        Object[] args = captor.getValue();
        assertEquals("[]", args[12]);
    }

    @Test
    @DisplayName("upsert: contraindications qua 120 ky tu -> bi validate chan truoc")
    void upsertRejectsLongContraindicationsBeforeStoring() {
        ExercisePhysiologyInputDTO input = new ExercisePhysiologyInputDTO(
                "DYNAMIC", 3, 3, 60, 80, "NEUTRAL", "LOW", "NONE", 3, "KNEE", "breathe",
                List.of("x".repeat(200)), "note");

        assertThrows(ResponseStatusException.class, () -> service.upsert(1L, "SYSTEM", input));
        verify(jdbcTemplate, never()).update(anyString(), any(Object[].class));
    }

    // ------------------------------------------------------------ validation

    @Test
    @DisplayName("validate: contraction type sai -> 400")
    void upsertRejectsInvalidContractionType() {
        ExercisePhysiologyInputDTO input = new ExercisePhysiologyInputDTO(
                "TWIST", 3, 3, 60, 80, "NEUTRAL", "LOW", "NONE", 3, "KNEE", "breathe",
                List.of(), "note");

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.upsert(1L, "SYSTEM", input));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("validate: blood pressure effect sai -> 400")
    void upsertRejectsInvalidBloodPressureEffect() {
        ExercisePhysiologyInputDTO input = new ExercisePhysiologyInputDTO(
                "DYNAMIC", 3, 3, 60, 80, "DROPS", "LOW", "NONE", 3, "KNEE", "breathe",
                List.of(), "note");

        assertThrows(ResponseStatusException.class, () -> service.upsert(1L, "SYSTEM", input));
    }

    @Test
    @DisplayName("validate: valsalva risk sai -> 400")
    void upsertRejectsInvalidValsalvaRisk() {
        ExercisePhysiologyInputDTO input = new ExercisePhysiologyInputDTO(
                "DYNAMIC", 3, 3, 60, 80, "NEUTRAL", "EXTREME", "NONE", 3, "KNEE", "breathe",
                List.of(), "note");

        assertThrows(ResponseStatusException.class, () -> service.upsert(1L, "SYSTEM", input));
    }

    @Test
    @DisplayName("validate: gi risk sai -> 400")
    void upsertRejectsInvalidGiRisk() {
        ExercisePhysiologyInputDTO input = new ExercisePhysiologyInputDTO(
                "DYNAMIC", 3, 3, 60, 80, "NEUTRAL", "LOW", "SEVERE", 3, "KNEE", "breathe",
                List.of(), "note");

        assertThrows(ResponseStatusException.class, () -> service.upsert(1L, "SYSTEM", input));
    }

    @Test
    @DisplayName("validate: joint sai -> 400")
    void upsertRejectsInvalidJoint() {
        ExercisePhysiologyInputDTO input = new ExercisePhysiologyInputDTO(
                "DYNAMIC", 3, 3, 60, 80, "NEUTRAL", "LOW", "NONE", 3, "THUMB", "breathe",
                List.of(), "note");

        assertThrows(ResponseStatusException.class, () -> service.upsert(1L, "SYSTEM", input));
    }

    @Test
    @DisplayName("validate: lever grade ngoai 1..5 -> 400")
    void upsertRejectsInvalidLeverGrade() {
        ExercisePhysiologyInputDTO input = new ExercisePhysiologyInputDTO(
                "DYNAMIC", 9, 3, 60, 80, "NEUTRAL", "LOW", "NONE", 3, "KNEE", "breathe",
                List.of(), "note");

        assertThrows(ResponseStatusException.class, () -> service.upsert(1L, "SYSTEM", input));
    }

    @Test
    @DisplayName("validate: cardiovascular load null -> 400")
    void upsertRejectsNullCardiovascularLoad() {
        ExercisePhysiologyInputDTO input = new ExercisePhysiologyInputDTO(
                "DYNAMIC", 3, null, 60, 80, "NEUTRAL", "LOW", "NONE", 3, "KNEE", "breathe",
                List.of(), "note");

        assertThrows(ResponseStatusException.class, () -> service.upsert(1L, "SYSTEM", input));
    }

    @Test
    @DisplayName("validate: tendon load ngoai 1..5 -> 400")
    void upsertRejectsInvalidTendonLoad() {
        ExercisePhysiologyInputDTO input = new ExercisePhysiologyInputDTO(
                "DYNAMIC", 3, 3, 60, 80, "NEUTRAL", "LOW", "NONE", 0, "KNEE", "breathe",
                List.of(), "note");

        assertThrows(ResponseStatusException.class, () -> service.upsert(1L, "SYSTEM", input));
    }

    @Test
    @DisplayName("validate: vung HR thap ngoai 30..95 -> 400")
    void upsertRejectsInvalidHrZoneLow() {
        ExercisePhysiologyInputDTO input = new ExercisePhysiologyInputDTO(
                "DYNAMIC", 3, 3, 10, 80, "NEUTRAL", "LOW", "NONE", 3, "KNEE", "breathe",
                List.of(), "note");

        assertThrows(ResponseStatusException.class, () -> service.upsert(1L, "SYSTEM", input));
    }

    @Test
    @DisplayName("validate: vung HR cao null -> 400")
    void upsertRejectsNullHrZoneHigh() {
        ExercisePhysiologyInputDTO input = new ExercisePhysiologyInputDTO(
                "DYNAMIC", 3, 3, 60, null, "NEUTRAL", "LOW", "NONE", 3, "KNEE", "breathe",
                List.of(), "note");

        assertThrows(ResponseStatusException.class, () -> service.upsert(1L, "SYSTEM", input));
    }

    @Test
    @DisplayName("validate: vung HR cao nho hon vung thap -> 400")
    void upsertRejectsInvertedHrZone() {
        ExercisePhysiologyInputDTO input = new ExercisePhysiologyInputDTO(
                "DYNAMIC", 3, 3, 80, 60, "NEUTRAL", "LOW", "NONE", 3, "KNEE", "breathe",
                List.of(), "note");

        assertThrows(ResponseStatusException.class, () -> service.upsert(1L, "SYSTEM", input));
    }

    @Test
    @DisplayName("validate: qua 20 benh can luu y -> 400")
    void upsertRejectsTooManyContraindications() {
        List<String> many = new ArrayList<>();
        for (int i = 0; i < 21; i++) {
            many.add("condition-" + i);
        }
        ExercisePhysiologyInputDTO input = new ExercisePhysiologyInputDTO(
                "DYNAMIC", 3, 3, 60, 80, "NEUTRAL", "LOW", "NONE", 3, "KNEE", "breathe",
                many, "note");

        assertThrows(ResponseStatusException.class, () -> service.upsert(1L, "SYSTEM", input));
    }

    @Test
    @DisplayName("validate: benh can luu y qua 120 ky tu -> 400")
    void upsertRejectsTooLongConditionText() {
        ExercisePhysiologyInputDTO input = new ExercisePhysiologyInputDTO(
                "DYNAMIC", 3, 3, 60, 80, "NEUTRAL", "LOW", "NONE", 3, "KNEE", "breathe",
                List.of("y".repeat(130)), "note");

        assertThrows(ResponseStatusException.class, () -> service.upsert(1L, "SYSTEM", input));
    }

    // ---------------------------------------------------------------- delete

    @Test
    @DisplayName("delete: exerciseId null -> khong lam gi")
    void deleteIgnoresNullExerciseId() {
        service.delete(null);

        verify(jdbcTemplate, never()).update(anyString(), any(Object[].class));
    }

    @Test
    @DisplayName("delete: xoa ho so theo exercise id")
    void deleteRemovesProfile() {
        service.delete(3L);

        verify(jdbcTemplate).update(eq("DELETE FROM exercise_physiology_profiles WHERE exercise_id = ?"), eq(3L));
    }

    @Test
    @DisplayName("delete: bang chua migrate -> nem loi thi khong nem loi ra ngoai")
    void deleteSwallowsMigrationError() {
        doThrow(new RuntimeException("table missing")).when(jdbcTemplate)
                .update(eq("DELETE FROM exercise_physiology_profiles WHERE exercise_id = ?"), eq(3L));

        service.delete(3L);
    }

    // ---------------------------------------------------------- loadProfile

    @Test
    @DisplayName("loadProfile: exerciseId null -> null")
    void loadProfileReturnsNullForNullId() {
        assertNull(service.loadProfile(null));
    }

    @Test
    @DisplayName("loadProfile: khong co dong -> null")
    void loadProfileReturnsNullWhenNoRow() {
        when(jdbcTemplate.queryForList(anyString(), eq(1L))).thenReturn(List.of());

        assertNull(service.loadProfile(1L));
    }

    @Test
    @DisplayName("loadProfile: bang chua migrate -> null")
    void loadProfileReturnsNullOnQueryError() {
        when(jdbcTemplate.queryForList(anyString(), eq(1L)))
                .thenThrow(new RuntimeException("table missing"));

        assertNull(service.loadProfile(1L));
    }

    @Test
    @DisplayName("loadProfile: doc duoc ho so sinh ly")
    void loadProfileReadsProfile() {
        Map<String, Object> row = new HashMap<>();
        row.put("contraction_type", "DYNAMIC");
        row.put("lever_grade", 3);
        row.put("cardiovascular_load", 4);
        row.put("hr_zone_low", 60);
        row.put("hr_zone_high", 80);
        row.put("blood_pressure_effect", "NEUTRAL");
        row.put("valsalva_risk", "LOW");
        row.put("gi_risk", "NONE");
        row.put("tendon_load", 2);
        row.put("primary_joint", "KNEE");
        row.put("breathing_cue", "Exhale on effort");
        row.put("contraindications", "[\"hypertension\"]");
        row.put("physiology_note", "note");

        when(jdbcTemplate.queryForList(anyString(), eq(1L))).thenReturn(List.of(row));

        ExercisePhysiologyDTO profile = service.loadProfile(1L);

        assertNotNull(profile);
        assertEquals("DYNAMIC", profile.contractionType());
        assertEquals(3, profile.leverGrade());
        assertEquals(4, profile.cardiovascularLoad());
        assertEquals(60, profile.hrZoneLow());
        assertEquals(80, profile.hrZoneHigh());
        assertEquals("KNEE", profile.primaryJoint());
        assertEquals(List.of("hypertension"), profile.contraindications());
        assertEquals("note", profile.physiologyNote());
    }

    @Test
    @DisplayName("loadProfile: khong con cot trich dan nguon trong cau hoi")
    void loadProfileDoesNotSelectEvidenceColumn() {
        when(jdbcTemplate.queryForList(anyString(), eq(1L))).thenReturn(List.of());

        service.loadProfile(1L);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).queryForList(sql.capture(), eq(1L));
        assertEquals(false, sql.getValue().contains("evidence_refs"));
    }

    @Test
    @DisplayName("loadProfile: cot JSON dang byte[] -> doc van xuat")
    void loadProfileHandlesByteArrayJson() {
        Map<String, Object> row = new HashMap<>();
        row.put("contraction_type", "STATIC");
        row.put("contraindications", "[\"a\",\"b\"]".getBytes(java.nio.charset.StandardCharsets.UTF_8));

        when(jdbcTemplate.queryForList(anyString(), eq(1L))).thenReturn(List.of(row));

        ExercisePhysiologyDTO profile = service.loadProfile(1L);

        assertNotNull(profile);
        assertEquals("STATIC", profile.contractionType());
        assertEquals(List.of("a", "b"), profile.contraindications());
    }

    @Test
    @DisplayName("loadProfile: cot JSON khong hop le -> danh sach rong")
    void loadProfileHandlesInvalidJson() {
        Map<String, Object> row = new HashMap<>();
        row.put("contraction_type", "DYNAMIC");
        row.put("contraindications", "not-json");

        when(jdbcTemplate.queryForList(anyString(), eq(1L))).thenReturn(List.of(row));

        ExercisePhysiologyDTO profile = service.loadProfile(1L);

        assertNotNull(profile);
        assertEquals(List.of("not-json"), profile.contraindications());
    }

    @Test
    @DisplayName("loadProfile: gia tri null -> null")
    void loadProfileHandlesNullValues() {
        Map<String, Object> row = new HashMap<>();
        row.put("contraction_type", null);
        row.put("lever_grade", null);
        row.put("contraindications", null);

        when(jdbcTemplate.queryForList(anyString(), eq(1L))).thenReturn(List.of(row));

        ExercisePhysiologyDTO profile = service.loadProfile(1L);

        assertNotNull(profile);
        assertNull(profile.contractionType());
        assertNull(profile.leverGrade());
        assertEquals(List.of(), profile.contraindications());
    }

    @Test
    @DisplayName("loadProfile: so khong phai Number -> chuyen doi hoac null")
    void loadProfileConvertsNumericStrings() {
        Map<String, Object> row = new HashMap<>();
        row.put("contraction_type", "DYNAMIC");
        row.put("lever_grade", "3");
        row.put("cardiovascular_load", "abc");
        row.put("contraindications", "[]");

        when(jdbcTemplate.queryForList(anyString(), eq(1L))).thenReturn(List.of(row));

        ExercisePhysiologyDTO profile = service.loadProfile(1L);

        assertNotNull(profile);
        assertEquals(3, profile.leverGrade());
        assertNull(profile.cardiovascularLoad());
    }
}
