package com.calishealth.service;

import com.calishealth.dtos.ExercisePhysiologyDTO;
import com.calishealth.dtos.ExercisePhysiologyInputDTO;
import com.calishealth.dtos.PhysiologyEvidenceDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Quản lý hồ sơ sinh lý của bài tập hệ thống (bảng {@code exercise_physiology_profiles},
 * migration V76).
 *
 * <p>Quy tắc bất di bất dịch: CHỈ bài có {@code source = 'SYSTEM'} mới được có hồ sơ.
 * Bài do Member tải lên ({@code CUSTOM}) không bao giờ được gán hồ sơ vì không có
 * tuyên bố sinh lý nào được duyệt bằng chứng học thuật cho bài đó.
 */
@Service
@RequiredArgsConstructor
public class ExercisePhysiologyService {

    private static final Set<String> CONTRACTION_TYPES = Set.of("DYNAMIC", "ISOMETRIC", "STATIC");
    private static final Set<String> BP_EFFECTS = Set.of("LOWERS", "NEUTRAL", "RAISES", "SPIKE_RISK");
    private static final Set<String> RISK_LEVELS = Set.of("NONE", "LOW", "MODERATE", "HIGH");
    private static final Set<String> JOINTS = Set.of(
            "WRIST", "ELBOW", "SHOULDER", "SPINE", "HIP", "KNEE", "ANKLE");

    /** Mỗi mục trong {@code contraindications} là 1 bệnh / tình trạng do CM tự nhập (tối đa 120 ký tự). */

    private final JdbcTemplate jdbcTemplate;

    /**
     * Tạo hoặc cập nhật hồ sơ sinh lý cho một bài tập hệ thống.
     * Nếu {@code input} null -> xoá hồ sơ cũ (CM bỏ hết field sinh lý).
     */
    @Transactional
    public void upsert(Long exerciseId, String exerciseSource, ExercisePhysiologyInputDTO input) {
        if (exerciseId == null) {
            return;
        }
        if (!ExerciseService.SOURCE_SYSTEM.equalsIgnoreCase(exerciseSource)) {
            // Chặn cứng: bài CUSTOM không được có hồ sơ sinh lý.
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Physiology profiles are only available for system exercises");
        }
        if (input == null) {
            delete(exerciseId);
            return;
        }
        validate(input);

        jdbcTemplate.update(
                "INSERT INTO exercise_physiology_profiles"
                        + " (exercise_id, contraction_type, lever_grade, cardiovascular_load,"
                        + " hr_zone_low, hr_zone_high, blood_pressure_effect, valsalva_risk, gi_risk,"
                        + " tendon_load, primary_joint, breathing_cue, contraindications, physiology_note, evidence_refs)"
                        + " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,CAST(? AS JSON),?,CAST(? AS JSON))"
                        + " ON DUPLICATE KEY UPDATE contraction_type = VALUES(contraction_type),"
                        + " lever_grade = VALUES(lever_grade), cardiovascular_load = VALUES(cardiovascular_load),"
                        + " hr_zone_low = VALUES(hr_zone_low), hr_zone_high = VALUES(hr_zone_high),"
                        + " blood_pressure_effect = VALUES(blood_pressure_effect),"
                        + " valsalva_risk = VALUES(valsalva_risk), gi_risk = VALUES(gi_risk),"
                        + " tendon_load = VALUES(tendon_load), primary_joint = VALUES(primary_joint),"
                        + " breathing_cue = VALUES(breathing_cue), contraindications = VALUES(contraindications),"
                        + " physiology_note = VALUES(physiology_note), evidence_refs = VALUES(evidence_refs)",
                exerciseId,
                input.contractionType(),
                input.leverGrade(),
                input.cardiovascularLoad(),
                input.hrZoneLow(),
                input.hrZoneHigh(),
                input.bloodPressureEffect(),
                input.valsalvaRisk(),
                input.giRisk(),
                input.tendonLoad(),
                input.primaryJoint(),
                input.breathingCue(),
                toJsonArray(cleanContraindications(input.contraindications())),
                input.physiologyNote(),
                toJsonArray(input.evidenceRefs()));
    }

    /** Chuẩn hoá danh sách bệnh cần lưu ý do CM tự nhập: trim, bỏ rỗng, khử trùng lặp. */
    private static List<String> cleanContraindications(List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        java.util.LinkedHashSet<String> seenLower = new java.util.LinkedHashSet<>();
        List<String> out = new java.util.ArrayList<>();
        for (String raw : values) {
            if (raw == null) {
                continue;
            }
            String text = raw.trim();
            if (text.isEmpty()) {
                continue;
            }
            if (text.length() > 120) {
                text = text.substring(0, 120);
            }
            String key = text.toLowerCase(Locale.ROOT);
            if (seenLower.add(key)) {
                out.add(text);
            }
        }
        return out;
    }

    @Transactional
    public void delete(Long exerciseId) {
        if (exerciseId == null) {
            return;
        }
        try {
            jdbcTemplate.update("DELETE FROM exercise_physiology_profiles WHERE exercise_id = ?", exerciseId);
        } catch (Exception ex) {
            // Bảng V76 chưa migrate ở môi trường cũ -> không có gì để xoá.
        }
    }

    /**
     * Đọc hồ sơ sinh lý của một bài tập kèm thư viện bằng chứng.
     *
     * <p>CHỈ bài của hệ thống ({@code source = 'SYSTEM'}) mới có hồ sơ sinh lý.
     * Bài do Member tải lên không có hồ sơ được đối chiếu với nguồn học thuật
     * nên tuyệt đối không được gán sẵn.
     *
     * @param exerciseId id bài tập (null -> null)
     * @return hồ sơ sinh lý, hoặc null nếu bài không có hồ sơ
     */
    @Transactional(readOnly = true)
    public ExercisePhysiologyDTO loadProfile(Long exerciseId) {
        if (exerciseId == null) {
            return null;
        }
        List<Map<String, Object>> rows;
        try {
            rows = jdbcTemplate.queryForList(
                    "SELECT p.contraction_type, p.lever_grade, p.cardiovascular_load,"
                            + " p.hr_zone_low, p.hr_zone_high, p.blood_pressure_effect,"
                            + " p.valsalva_risk, p.gi_risk, p.tendon_load, p.primary_joint,"
                            + " p.breathing_cue, p.contraindications, p.physiology_note, p.evidence_refs"
                            + " FROM exercise_physiology_profiles p"
                            + " JOIN exercises e ON e.id = p.exercise_id"
                            + " WHERE p.exercise_id = ? AND e.source = 'SYSTEM'",
                    exerciseId);
        } catch (Exception ex) {
            // Bảng V76 chưa migrate ở môi trường cũ -> coi như chưa có dữ liệu.
            return null;
        }
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> row = rows.get(0);
        List<String> evidenceRefs = parseJsonArray(row.get("evidence_refs"));
        List<String> contraindications = parseJsonArray(row.get("contraindications"));
        return new ExercisePhysiologyDTO(
                str(row.get("contraction_type")),
                num(row.get("lever_grade")),
                num(row.get("cardiovascular_load")),
                num(row.get("hr_zone_low")),
                num(row.get("hr_zone_high")),
                str(row.get("blood_pressure_effect")),
                str(row.get("valsalva_risk")),
                str(row.get("gi_risk")),
                num(row.get("tendon_load")),
                str(row.get("primary_joint")),
                str(row.get("breathing_cue")),
                contraindications,
                str(row.get("physiology_note")),
                evidenceRefs,
                loadEvidences(evidenceRefs));
    }

    /** Thư viện bằng chứng theo danh sách mã nguồn, giữ đúng thứ tự đã khai báo. */
    @Transactional(readOnly = true)
    public List<PhysiologyEvidenceDTO> loadEvidences(List<String> codes) {
        if (codes == null || codes.isEmpty()) {
            return List.of();
        }
        String placeholders = String.join(",", java.util.Collections.nCopies(codes.size(), "?"));
        List<Map<String, Object>> rows;
        try {
            rows = jdbcTemplate.queryForList(
                    "SELECT code, title, authors, journal, year, doi, url, evidence_grade, study_type, summary"
                            + " FROM physiology_evidence WHERE code IN (" + placeholders + ")",
                    codes.toArray());
        } catch (Exception ex) {
            return List.of();
        }
        Map<String, Map<String, Object>> byCode = new HashMap<>();
        for (Map<String, Object> row : rows) {
            byCode.put(str(row.get("code")), row);
        }
        return codes.stream()
                .map(byCode::get)
                .filter(java.util.Objects::nonNull)
                .map(row -> new PhysiologyEvidenceDTO(
                        str(row.get("code")),
                        str(row.get("title")),
                        str(row.get("authors")),
                        str(row.get("journal")),
                        num(row.get("year")),
                        str(row.get("doi")),
                        str(row.get("url")),
                        str(row.get("evidence_grade")),
                        str(row.get("study_type")),
                        str(row.get("summary"))))
                .toList();
    }

    /** Thư viện nguồn trích dẫn cho Content Manager chọn. */
    @Transactional(readOnly = true)
    public List<PhysiologyEvidenceDTO> listEvidence(String keyword) {
        String sql = "SELECT code, title, authors, journal, year, doi, url, evidence_grade, study_type, summary"
                + " FROM physiology_evidence";
        List<Object> params = new java.util.ArrayList<>();
        if (keyword != null && !keyword.isBlank()) {
            sql += " WHERE title LIKE ? OR authors LIKE ? OR study_type LIKE ?";
            String like = "%" + keyword.trim() + "%";
            params.add(like);
            params.add(like);
            params.add(like);
        }
        sql += " ORDER BY evidence_grade ASC, year DESC";
        try {
            return jdbcTemplate.query(sql, (rs, rowNum) -> new PhysiologyEvidenceDTO(
                    rs.getString("code"),
                    rs.getString("title"),
                    rs.getString("authors"),
                    rs.getString("journal"),
                    (Integer) rs.getObject("year"),
                    rs.getString("doi"),
                    rs.getString("url"),
                    rs.getString("evidence_grade"),
                    rs.getString("study_type"),
                    rs.getString("summary")), params.toArray());
        } catch (Exception ex) {
            return List.of();
        }
    }

    /** Kiểm tra các mã nguồn có tồn tại trong thư viện không (tuỳ chọn — CM có thể bỏ trống). */
    private void assertEvidenceExists(List<String> codes) {
        if (codes == null || codes.isEmpty()) {
            // Không bắt buộc nguồn tham khảo nữa.
            return;
        }
        String placeholders = String.join(",", java.util.Collections.nCopies(codes.size(), "?"));
        List<Map<String, Object>> rows;
        try {
            rows = jdbcTemplate.queryForList(
                    "SELECT code FROM physiology_evidence WHERE code IN (" + placeholders + ")",
                    codes.toArray());
        } catch (Exception ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Evidence library is not available");
        }
        Set<String> existing = new java.util.HashSet<>();
        for (Map<String, Object> row : rows) {
            Object value = row.get("code");
            existing.add(value == null ? "" : String.valueOf(value));
        }
        List<String> missing = codes.stream().filter(code -> !existing.contains(code)).toList();
        if (!missing.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Unknown evidence source(s): " + String.join(", ", missing));
        }
    }

    private void validate(ExercisePhysiologyInputDTO input) {
        if (!CONTRACTION_TYPES.contains(upper(input.contractionType()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid contraction type");
        }
        if (!BP_EFFECTS.contains(upper(input.bloodPressureEffect()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid blood pressure effect");
        }
        if (!RISK_LEVELS.contains(upper(input.valsalvaRisk()))
                || !RISK_LEVELS.contains(upper(input.giRisk()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid risk level");
        }
        if (!JOINTS.contains(upper(input.primaryJoint()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid primary joint");
        }
        requireRange(input.leverGrade(), 1, 5, "Lever grade");
        requireRange(input.cardiovascularLoad(), 1, 5, "Cardiovascular load");
        requireRange(input.tendonLoad(), 1, 5, "Tendon load");
        requireRange(input.hrZoneLow(), 30, 95, "Lower heart-rate zone");
        Integer hrHigh = input.hrZoneHigh();
        if (hrHigh == null || hrHigh < 30 || hrHigh > 100) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Upper heart-rate zone must be between 30 and 100");
        }
        if (hrHigh < input.hrZoneLow()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Upper heart-rate zone must not be lower than the lower zone");
        }
        if (input.contraindications() != null) {
            List<String> cleaned = input.contraindications().stream()
                    .filter(java.util.Objects::nonNull)
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .toList();
            if (cleaned.size() > 20) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "A maximum of 20 conditions can be listed in contraindications");
            }
            List<String> tooLong = cleaned.stream().filter(s -> s.length() > 120).toList();
            if (!tooLong.isEmpty()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Each condition in contraindications must be 120 characters or fewer");
            }
        }
        assertEvidenceExists(input.evidenceRefs());
    }

    private static void requireRange(Integer value, int min, int max, String label) {
        if (value == null || value < min || value > max) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, label + " must be between " + min + " and " + max);
        }
    }

    private static String upper(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof byte[] bytes) {
            return new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
        }
        return String.valueOf(value);
    }

    private static Integer num(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number n) {
            return n.intValue();
        }
        try {
            return Integer.valueOf(String.valueOf(value).trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    /** Đọc cột JSON dạng mảng chuỗi (MySQL trả về byte[] hoặc String tùy driver). */
    private static List<String> parseJsonArray(Object value) {
        String raw = str(value);
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        raw = raw.trim();
        if (!raw.startsWith("[")) {
            return List.of(raw);
        }
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper =
                    new com.fasterxml.jackson.databind.ObjectMapper();
            List<?> list = mapper.readValue(raw, List.class);
            return list.stream()
                    .filter(java.util.Objects::nonNull)
                    .map(item -> String.valueOf(item).trim())
                    .filter(item -> !item.isEmpty())
                    .toList();
        } catch (Exception ex) {
            return List.of();
        }
    }

    private static String toJsonArray(List<String> values) {
        if (values == null || values.isEmpty()) {
            return "[]";
        }
        StringBuilder builder = new StringBuilder("[");
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                builder.append(",");
            }
            builder.append("\"").append(values.get(i).replace("\\", "\\\\").replace("\"", "\\\"")).append("\"");
        }
        return builder.append("]").toString();
    }
}
