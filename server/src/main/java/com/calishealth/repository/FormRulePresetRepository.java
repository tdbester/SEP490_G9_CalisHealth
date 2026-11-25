package com.calishealth.repository;

import com.calishealth.models.FormRulePreset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/** Truy cập bảng {@code form_rule_presets} — bộ ngưỡng mẫu cho member. */
public interface FormRulePresetRepository extends JpaRepository<FormRulePreset, Long> {

    /** Các preset đang bật, theo nhóm chuyển động và loại bài. */
    @Query("""
            SELECT p FROM FormRulePreset p
            WHERE p.active = true
              AND p.movementGroup = :movementGroup
              AND p.category = :category
            ORDER BY p.id
            """)
    List<FormRulePreset> findActiveByGroupAndCategory(
            @Param("movementGroup") String movementGroup,
            @Param("category") String category);

    /** Tất cả preset đang bật. */
    @Query("""
            SELECT p FROM FormRulePreset p
            WHERE p.active = true
            ORDER BY p.movementGroup, p.id
            """)
    List<FormRulePreset> findAllActive();

    /** Tìm preset theo mã. */
    @Query("""
            SELECT p FROM FormRulePreset p
            WHERE p.code = :code
            """)
    List<FormRulePreset> findByCode(@Param("code") String code);
}
