package com.calishealth.repository;

import com.calishealth.dtos.ExerciseDtos.ExerciseModerationHistoryResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
@RequiredArgsConstructor
public class ExerciseModerationHistoryRepository {
    private final JdbcTemplate jdbcTemplate;

    public List<ExerciseModerationHistoryResponse> findAll() {
        return jdbcTemplate.query(
                "SELECT h.id, h.exercise_code, h.exercise_name, h.type, h.muscle_group, h.level, "
                        + "h.description, h.category, h.guide, h.demo_video_url, h.anatomy_image_url, "
                        + "h.created_by_name, h.decision, h.rejection_reason, h.reviewed_at "
                        + "FROM exercise_moderation_history h "
                        + "ORDER BY h.reviewed_at DESC, h.id DESC", 
                (rs, rowNum) -> new ExerciseModerationHistoryResponse(
                        rs.getLong("id"), rs.getString("exercise_code"), rs.getString("exercise_name"),
                        rs.getString("type"), rs.getString("muscle_group"), rs.getString("level"),
                        rs.getString("description"), rs.getString("category"), rs.getString("guide"),
                        rs.getString("demo_video_url"), rs.getString("anatomy_image_url"),
                        rs.getString("created_by_name"), rs.getString("decision"),
                        rs.getString("rejection_reason"), rs.getTimestamp("reviewed_at").toLocalDateTime()
                )
        );
    }

    public void insert(String code, String name, String type, String muscleGroup, String level,
                       String description, String category, String guide, String demoVideoUrl,
                       String anatomyImageUrl, String createdByName, String decision, String rejectionReason) {
        jdbcTemplate.update(
                "INSERT INTO exercise_moderation_history "
                        + "(exercise_code, exercise_name, type, muscle_group, level, description, category, "
                        + "guide, demo_video_url, anatomy_image_url, created_by_name, decision, rejection_reason, reviewed_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6))",
                code, name, type, muscleGroup, level, description, category, guide,
                demoVideoUrl, anatomyImageUrl, createdByName, decision, rejectionReason
        );
    }

}
