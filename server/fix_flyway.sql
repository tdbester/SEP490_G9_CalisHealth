-- 清理之前失败的 V49
DELETE FROM flyway_schema_history WHERE version = 49;

-- 插入 V49 成功记录（让 Flyway 知道这个版本已执行）
-- 然后手动运行 V49 的创建和 seed 逻辑
