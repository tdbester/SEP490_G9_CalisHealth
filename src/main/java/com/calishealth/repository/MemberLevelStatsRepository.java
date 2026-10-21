package com.calishealth.repository;

import com.calishealth.dtos.MemberLevelStat;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class MemberLevelStatsRepository {
    private final JdbcTemplate jdbcTemplate;

    public MemberLevelStatsRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<MemberLevelStat> findMemberCountsByLevel() {
        return jdbcTemplate.query("""
                SELECT fl.name AS level_name,
                       COUNT(DISTINCT CASE WHEN u.id IS NOT NULL THEN mp.user_id END) AS member_count
                FROM fitness_levels fl
                LEFT JOIN member_profiles mp ON mp.fitness_level_id = fl.id
                LEFT JOIN users u
                    ON u.id = mp.user_id
                    AND u.enabled = TRUE
                    AND u.role = 'MEMBER'
                GROUP BY fl.id, fl.name
                ORDER BY fl.id
                """,
                (resultSet, rowNumber) -> new MemberLevelStat(
                        resultSet.getString("level_name"),
                        resultSet.getLong("member_count")
                ));
    }
}
