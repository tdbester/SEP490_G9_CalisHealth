package com.calishealth.service;

import com.calishealth.dtos.PhysiologyEvidenceDTO;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Thư viện nguồn học thuật cho module sinh lý — đọc từ file tĩnh trong mã nguồn.
 *
 * <p>Trước V80, thư viện nằm trong bảng {@code physiology_evidence}. Bảng đó bị bỏ
 * vì không có màn hình nào hiển thị danh mục nguồn cho người dùng cuối — nó chỉ
 * là dữ liệu tra cứu tĩnh. Toàn bộ 21 nguồn được chuyển sang
 * {@code classpath:physiology-evidence-library.json}.
 *
 * <p>Lợi ích của việc chuyển sang file:
 * <ul>
 *   <li>Nguồn nằm trong git → trích dẫn được trong báo cáo đồ án và khi bảo vệ
 *       trước hội đồng.</li>
 *   <li>Bổ sung nguồn mới không cần viết migration.</li>
 *   <li>Không còn bảng "chết" trong schema, ERD gọn hơn.</li>
 * </ul>
 *
 * <p>Cơ chế kiểm chứng không đổi: mọi mã trong {@code evidence_refs} của hồ sơ
 * sinh lý và luật cảnh báo vẫn phải tồn tại trong thư viện này.
 */
@Service
@Slf4j
public class PhysiologyEvidenceLibrary {

    /** Đường dẫn file JSON chứa danh mục nguồn. */
    private static final String RESOURCE = "physiology-evidence-library.json";

    /** Jackson 3 là bản mặc định của Spring Boot 4; Jackson 2 không còn bean mặc định. */
    private final JsonMapper jsonMapper = JsonMapper.builder().build();

    /** Mã nguồn -> chi tiết nguồn. Giữ thứ tự như trong file. */
    private Map<String, PhysiologyEvidenceDTO> byCode = Map.of();

    /** Danh sách nguồn theo đúng thứ tự trong file. */
    private List<PhysiologyEvidenceDTO> ordered = List.of();

    @PostConstruct
    void load() {
        try (InputStream in = new ClassPathResource(RESOURCE).getInputStream()) {
            JsonNode root = jsonMapper.readTree(in);
            Map<String, PhysiologyEvidenceDTO> map = new LinkedHashMap<>();
            List<PhysiologyEvidenceDTO> list = new ArrayList<>();
            for (JsonNode node : root) {
                PhysiologyEvidenceDTO dto = new PhysiologyEvidenceDTO(
                        text(node, "code"),
                        text(node, "title"),
                        text(node, "authors"),
                        text(node, "journal"),
                        node.has("year") && !node.get("year").isNull() ? node.get("year").asInt() : null,
                        text(node, "doi"),
                        text(node, "url"),
                        text(node, "evidence_grade"),
                        text(node, "study_type"),
                        text(node, "summary"));
                list.add(dto);
                if (dto.code() != null) {
                    map.put(dto.code(), dto);
                }
            }
            this.byCode = Map.copyOf(map);
            this.ordered = List.copyOf(list);
            log.info("Physiology evidence library loaded: {} sources from {}", ordered.size(), RESOURCE);
        } catch (Exception ex) {
            log.error("Khong doc duoc thu vien bang chung sinh ly: {}", RESOURCE, ex);
            this.byCode = Map.of();
            this.ordered = List.of();
        }
    }

    /**
     * Thư viện nguồn theo danh sách mã, giữ đúng thứ tự đã khai báo.
     *
     * @param codes mã nguồn (vd. {@code EV_PLANK_2026}); null/rỗng -> danh sách rỗng
     * @return các nguồn tìm thấy, bỏ qua mã không tồn tại
     */
    public List<PhysiologyEvidenceDTO> loadByCodes(List<String> codes) {
        if (codes == null || codes.isEmpty()) {
            return List.of();
        }
        List<PhysiologyEvidenceDTO> out = new ArrayList<>();
        for (String code : codes) {
            PhysiologyEvidenceDTO dto = byCode.get(code);
            if (dto != null) {
                out.add(dto);
            }
        }
        return out;
    }

    /**
     * Danh mục nguồn cho Content Manager tra cứu, lọc theo từ khoá.
     *
     * @param keyword tìm trong tiêu đề, tác giả hoặc loại nghiên cứu; null -> tất cả
     */
    public List<PhysiologyEvidenceDTO> list(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return ordered;
        }
        String needle = keyword.trim().toLowerCase();
        List<PhysiologyEvidenceDTO> out = new ArrayList<>();
        for (PhysiologyEvidenceDTO dto : ordered) {
            if (contains(dto.title(), needle)
                    || contains(dto.authors(), needle)
                    || contains(dto.studyType(), needle)) {
                out.add(dto);
            }
        }
        return out;
    }

    /**
     * Kiểm tra các mã nguồn có tồn tại trong thư viện không.
     *
     * @return danh sách mã không tồn tại (rỗng = hợp lệ)
     */
    public List<String> missingCodes(List<String> codes) {
        if (codes == null || codes.isEmpty()) {
            return List.of();
        }
        List<String> missing = new ArrayList<>();
        for (String code : codes) {
            if (code == null || code.isBlank() || !byCode.containsKey(code)) {
                missing.add(code == null ? "" : code);
            }
        }
        return missing;
    }

    /** Số nguồn trong thư viện. */
    public int size() {
        return ordered.size();
    }

    private static boolean contains(String value, String needle) {
        return value != null && value.toLowerCase().contains(needle);
    }

    private static String text(JsonNode node, String field) {
        JsonNode v = node.get(field);
        if (v == null || v.isNull()) {
            return null;
        }
        String s = v.asString();
        return s.isEmpty() ? null : s;
    }
}
