package com.calishealth.models;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Bộ ngưỡng chấm form mẫu dùng cho gợi ý khi member tạo bài tập custom.
 *
 * <p>Mỗi preset thuộc một nhóm chuyển động ({@code movementGroup}) và một loại
 * bài ({@code category} = REPS | HOLD). Danh sách ngưỡng của preset được lưu dạng
 * JSON trong {@code rulesJson} để không cần bảng con.
 */
@Entity
@Table(name = "form_rule_presets")
@Getter
@Setter
@NoArgsConstructor
public class FormRulePreset {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Mã preset duy nhất, ví dụ {@code PUSHUP_STANDARD}. */
    @Column(name = "code", length = 60, nullable = false, unique = true)
    private String code;

    /** Tên hiển thị cho member (có thể đã kèm i18n ở client). */
    @Column(name = "name", length = 120, nullable = false)
    private String name;

    /** REPS | HOLD — cùng ngữ nghĩa với {@code exercises.category}. */
    @Column(name = "category", length = 40, nullable = false)
    private String category;

    /** Nhóm chuyển động: PUSH | PULL | LEGS | CORE. */
    @Column(name = "movement_group", length = 20, nullable = false)
    private String movementGroup;

    /** Danh sách ngưỡng của preset, mỗi phần tử là 1 JSON object. */
    @Column(name = "rules_json", columnDefinition = "TEXT", nullable = false)
    private String rulesJson;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "active", nullable = false)
    private boolean active = true;
}
