-- 删除失败的 V49 迁移记录，让 Flyway 重新执行
DELETE FROM flyway_schema_history WHERE version = 49;

-- 验证
SELECT version, description, success FROM flyway_schema_history WHERE version >= 48 ORDER BY version DESC;
