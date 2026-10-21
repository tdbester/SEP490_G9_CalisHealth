-- Seed data (from sql/V1__initial_schema.sql on main).
-- INSERT IGNORE: rows that already exist (same id or unique key) are skipped.

-- users first: upload_configs.updated_by references users.id = 1
-- Temporary admin login: admin@example.com / Admin@123456 (change it after the first login)
INSERT IGNORE INTO `users` (`id`, `full_name`, `email`, `password`, `role`, `enabled`, `created_at`) VALUES
(1,'System Admin','admin@example.com','$2a$10$NTiKc63OIX8hhFumzIf6NOtpFygZKgz2K1gFxQxnLBfQSsGaR2UKK','ADMIN',1,'2026-10-21 13:34:50');

INSERT IGNORE INTO `fitness_levels` (`id`, `name`, `description`, `status`, `min_score`, `max_score`, `formula_type`, `formula`) VALUES
(1,'Beginner','Mới bắt đầu','ACTIVE',0.00,39.99,'WEIGHTED_SUM','SUM(value/min_value * weight)'),
(2,'Intermediate','Đã có nền tảng','ACTIVE',40.00,74.99,'WEIGHTED_SUM','SUM(value/min_value * weight)'),
(3,'Advanced','Thành thạo kỹ năng','ACTIVE',75.00,100.00,'WEIGHTED_SUM','SUM(value/min_value * weight)');

INSERT IGNORE INTO `muscle_groups` (`id`, `name`) VALUES
(7,'Chân'),
(6,'Core'),
(2,'Lưng'),
(8,'Mông'),
(1,'Ngực'),
(5,'Tay sau'),
(4,'Tay trước'),
(3,'Vai');

INSERT IGNORE INTO `system_settings` (`id`, `name`, `type`, `value`, `priority`, `status`) VALUES
(1,'storage_quota_gb','INT','500',1,'ACTIVE');

INSERT IGNORE INTO `upload_configs` (`id`, `purpose`, `allowed_formats`, `max_size_mb`, `max_duration_seconds`, `retention_days`, `is_enabled`, `updated_by`, `updated_at`) VALUES
(1,'WORKOUT_VIDEO','mp4,mov',500,600,7,1,1,'2026-10-21 13:34:50'),
(2,'EXERCISE_VIDEO','mp4,mov',200,180,14,1,1,'2026-10-21 13:34:50'),
(3,'AVATAR','jpg,jpeg,png',5,NULL,3,1,1,'2026-10-21 13:34:50'),
(4,'ATTACHMENT','pdf,jpg,png',20,NULL,7,1,1,'2026-10-21 13:34:50');
