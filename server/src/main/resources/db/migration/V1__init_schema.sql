-- Baseline schema: structure of calisthenics_db (team ERD).
-- Tables are in alphabetical order, so foreign key checks are off while creating them.

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE `activity_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `action` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_activity_logs_user_time` (`user_id`,`created_at`),
  CONSTRAINT `fk_activity_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `auth_tokens` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `type` enum('VERIFY_EMAIL','RESET_PASSWORD','REFRESH') COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_auth_tokens_token` (`token`),
  KEY `fk_auth_tokens_user` (`user_id`),
  KEY `idx_auth_tokens_expires` (`expires_at`),
  CONSTRAINT `fk_auth_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `benchmark_criteria` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `fitness_level_id` bigint NOT NULL,
  `exercise_id` bigint NOT NULL,
  `min_value` int DEFAULT NULL,
  `criterion_weight` decimal(4,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_benchmark_criteria` (`fitness_level_id`,`exercise_id`),
  KEY `fk_benchmark_exercise` (`exercise_id`),
  CONSTRAINT `fk_benchmark_exercise` FOREIGN KEY (`exercise_id`) REFERENCES `exercises` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_benchmark_level` FOREIGN KEY (`fitness_level_id`) REFERENCES `fitness_levels` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `body_measurements` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `member_profile_id` bigint NOT NULL,
  `weight` decimal(5,2) NOT NULL,
  `height` decimal(5,2) NOT NULL,
  `bmi` decimal(4,1) GENERATED ALWAYS AS (round((`weight` / pow((`height` / 100),2)),1)) STORED,
  `measured_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_body_measurements_member_time` (`member_profile_id`,`measured_at`),
  CONSTRAINT `fk_body_measurements_member` FOREIGN KEY (`member_profile_id`) REFERENCES `member_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ck_body_measurements_values` CHECK (((`weight` > 0) and (`height` > 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cleanup_runs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `triggered_by` bigint DEFAULT NULL COMMENT 'NULL = job tự động',
  `job_type` enum('ORPHAN_FILES','REJECTED_UPLOADS','EXPIRED_TOKENS','TEMP_FILES','OLD_LOGS') COLLATE utf8mb4_unicode_ci NOT NULL,
  `started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `finished_at` datetime DEFAULT NULL,
  `status` enum('RUNNING','COMPLETED','FAILED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'RUNNING',
  `files_deleted` int NOT NULL DEFAULT '0',
  `freed_mb` decimal(10,2) NOT NULL DEFAULT '0.00',
  `error_message` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `fk_cleanup_runs_user` (`triggered_by`),
  CONSTRAINT `fk_cleanup_runs_user` FOREIGN KEY (`triggered_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `content_reviews` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `exercise_id` bigint DEFAULT NULL,
  `training_plan_id` bigint DEFAULT NULL,
  `submitted_by` bigint NOT NULL,
  `reviewer_id` bigint DEFAULT NULL COMMENT 'Chỉ CONTENT_MANAGER/ADMIN: kiểm tra ở tầng ứng dụng',
  `content_type` enum('EXERCISE','CUSTOM_WORKOUT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PENDING_SCAN','SCAN_FAILED','PENDING_REVIEW','APPROVED','REJECTED','NEEDS_CHANGES') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING_SCAN',
  `reject_reason` text COLLATE utf8mb4_unicode_ci,
  `submitted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_reviews_exercise` (`exercise_id`),
  KEY `fk_reviews_plan` (`training_plan_id`),
  KEY `fk_reviews_submitter` (`submitted_by`),
  KEY `fk_reviews_reviewer` (`reviewer_id`),
  KEY `idx_reviews_queue` (`status`,`submitted_at`),
  CONSTRAINT `fk_reviews_exercise` FOREIGN KEY (`exercise_id`) REFERENCES `exercises` (`id`),
  CONSTRAINT `fk_reviews_plan` FOREIGN KEY (`training_plan_id`) REFERENCES `training_plans` (`id`),
  CONSTRAINT `fk_reviews_reviewer` FOREIGN KEY (`reviewer_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_reviews_submitter` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`),
  CONSTRAINT `ck_reviews_target` CHECK ((((`content_type` = _utf8mb4'EXERCISE') and (`exercise_id` is not null) and (`training_plan_id` is null)) or ((`content_type` = _utf8mb4'CUSTOM_WORKOUT') and (`training_plan_id` is not null) and (`exercise_id` is null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `content_scans` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `content_review_id` bigint NOT NULL,
  `media_file_id` bigint DEFAULT NULL,
  `scan_type` enum('PROFANITY_TEXT','MEDIAPIPE_POSE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PENDING','PASSED','FLAGGED','FAILED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `score` decimal(5,2) DEFAULT NULL,
  `flagged_terms` text COLLATE utf8mb4_unicode_ci,
  `details` json DEFAULT NULL,
  `scanned_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_scans_review` (`content_review_id`),
  KEY `fk_scans_media` (`media_file_id`),
  CONSTRAINT `fk_scans_media` FOREIGN KEY (`media_file_id`) REFERENCES `media_files` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_scans_review` FOREIGN KEY (`content_review_id`) REFERENCES `content_reviews` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `exercise_muscle_groups` (
  `exercise_id` bigint NOT NULL,
  `muscle_group_id` bigint NOT NULL,
  PRIMARY KEY (`exercise_id`,`muscle_group_id`),
  KEY `fk_emg_muscle_group` (`muscle_group_id`),
  CONSTRAINT `fk_emg_exercise` FOREIGN KEY (`exercise_id`) REFERENCES `exercises` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_emg_muscle_group` FOREIGN KEY (`muscle_group_id`) REFERENCES `muscle_groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `exercise_variations` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `exercise_id` bigint NOT NULL,
  `variant_exercise_id` bigint NOT NULL,
  `type` enum('PROGRESSION','REGRESSION','ALTERNATIVE') COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_exercise_variations` (`exercise_id`,`variant_exercise_id`),
  KEY `fk_variations_variant` (`variant_exercise_id`),
  CONSTRAINT `fk_variations_exercise` FOREIGN KEY (`exercise_id`) REFERENCES `exercises` (`id`),
  CONSTRAINT `fk_variations_variant` FOREIGN KEY (`variant_exercise_id`) REFERENCES `exercises` (`id`),
  CONSTRAINT `ck_variations_not_self` CHECK ((`exercise_id` <> `variant_exercise_id`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `exercises` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('EXERCISE','SKILL') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'EXERCISE',
  `category` enum('STRENGTH','CARDIO') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'STRENGTH',
  `difficulty_level` tinyint unsigned DEFAULT NULL,
  `instructions` text COLLATE utf8mb4_unicode_ci,
  `execution_steps` text COLLATE utf8mb4_unicode_ci,
  `safety_tips` text COLLATE utf8mb4_unicode_ci,
  `anatomy_theory` text COLLATE utf8mb4_unicode_ci,
  `video_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `demo_media_id` bigint DEFAULT NULL,
  `default_sets` tinyint unsigned DEFAULT NULL,
  `default_reps` smallint unsigned DEFAULT NULL,
  `default_rest` smallint unsigned DEFAULT NULL COMMENT 'giây',
  `source` enum('SYSTEM','MEMBER') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SYSTEM',
  `created_by` bigint NOT NULL,
  `status` enum('DRAFT','PENDING_REVIEW','ACTIVE','REJECTED','INACTIVE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_exercises_name` (`name`),
  KEY `fk_exercises_demo_media` (`demo_media_id`),
  KEY `fk_exercises_creator` (`created_by`),
  KEY `idx_exercises_status` (`status`,`source`),
  CONSTRAINT `fk_exercises_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_exercises_demo_media` FOREIGN KEY (`demo_media_id`) REFERENCES `media_files` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `fitness_levels` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `status` enum('ACTIVE','INACTIVE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `min_score` decimal(5,2) DEFAULT NULL,
  `max_score` decimal(5,2) DEFAULT NULL,
  `formula_type` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `formula` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fitness_levels_name` (`name`),
  CONSTRAINT `ck_fitness_levels_score` CHECK (((`min_score` is null) or (`max_score` is null) or (`min_score` <= `max_score`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `form_error_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_exercise_result_id` bigint NOT NULL,
  `form_rule_id` bigint NOT NULL,
  `rep_number` int DEFAULT NULL,
  `joint_angle` decimal(5,2) DEFAULT NULL,
  `occurred_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_form_errors_result` (`session_exercise_result_id`),
  KEY `fk_form_errors_rule` (`form_rule_id`),
  CONSTRAINT `fk_form_errors_result` FOREIGN KEY (`session_exercise_result_id`) REFERENCES `session_exercise_results` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_form_errors_rule` FOREIGN KEY (`form_rule_id`) REFERENCES `form_rules` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `form_rules` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `exercise_id` bigint NOT NULL,
  `joint` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `angle_threshold` decimal(5,2) DEFAULT NULL,
  `rom_depth` decimal(5,2) DEFAULT NULL,
  `feedback_message` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_form_rules` (`exercise_id`,`joint`),
  CONSTRAINT `fk_form_rules_exercise` FOREIGN KEY (`exercise_id`) REFERENCES `exercises` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `maintenance_schedules` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_by` bigint NOT NULL,
  `notification_id` bigint DEFAULT NULL,
  `title` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `maintenance_type` enum('PLANNED','EMERGENCY') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PLANNED',
  `affected_scope` enum('ALL','AI_ANALYSIS','UPLOAD','ADMIN_ONLY') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ALL',
  `start_at` datetime NOT NULL,
  `end_at` datetime NOT NULL,
  `status` enum('SCHEDULED','ACTIVE','COMPLETED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SCHEDULED',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_maintenance_creator` (`created_by`),
  KEY `fk_maintenance_notification` (`notification_id`),
  KEY `idx_maintenance_window` (`status`,`start_at`,`end_at`),
  CONSTRAINT `fk_maintenance_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_maintenance_notification` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE SET NULL,
  CONSTRAINT `ck_maintenance_time` CHECK ((`end_at` > `start_at`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `media_files` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `uploader_id` bigint NOT NULL,
  `file_url` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_type` enum('VIDEO','IMAGE','DOCUMENT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `format` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `size_mb` decimal(8,2) NOT NULL DEFAULT '0.00',
  `duration_seconds` int DEFAULT NULL,
  `purpose` enum('WORKOUT_VIDEO','EXERCISE_VIDEO','AVATAR','ATTACHMENT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PENDING_SCAN','ACTIVE','REJECTED','ORPHANED','DELETED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING_SCAN',
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_media_files_url` (`file_url`),
  KEY `fk_media_files_uploader` (`uploader_id`),
  KEY `idx_media_files_status` (`status`,`uploaded_at`),
  CONSTRAINT `fk_media_files_uploader` FOREIGN KEY (`uploader_id`) REFERENCES `users` (`id`),
  CONSTRAINT `ck_media_files_size` CHECK ((`size_mb` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `member_profiles` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `fitness_level_id` bigint DEFAULT NULL,
  `gender` enum('MALE','FEMALE','OTHER') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_of_birth` date NOT NULL COMMENT 'Đủ 13 tuổi: kiểm tra ở tầng ứng dụng',
  `weight` decimal(5,2) DEFAULT NULL,
  `height` decimal(5,2) DEFAULT NULL,
  `goals` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `streak_count` int NOT NULL DEFAULT '0',
  `longest_streak` int NOT NULL DEFAULT '0',
  `bio` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar_media_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_member_profiles_user` (`user_id`),
  KEY `fk_member_profiles_level` (`fitness_level_id`),
  KEY `fk_member_profiles_avatar` (`avatar_media_id`),
  CONSTRAINT `fk_member_profiles_avatar` FOREIGN KEY (`avatar_media_id`) REFERENCES `media_files` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_member_profiles_level` FOREIGN KEY (`fitness_level_id`) REFERENCES `fitness_levels` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_member_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `ck_member_profiles_streak` CHECK (((`streak_count` >= 0) and (`longest_streak` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `member_skill_progress` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `member_profile_id` bigint NOT NULL,
  `exercise_id` bigint NOT NULL,
  `status` enum('LOCKED','UNLOCKED','MASTERED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'LOCKED',
  `best_reps` int NOT NULL DEFAULT '0',
  `best_accuracy` decimal(5,2) NOT NULL DEFAULT '0.00',
  `unlocked_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_member_skill_progress` (`member_profile_id`,`exercise_id`),
  KEY `fk_skill_progress_exercise` (`exercise_id`),
  CONSTRAINT `fk_skill_progress_exercise` FOREIGN KEY (`exercise_id`) REFERENCES `exercises` (`id`),
  CONSTRAINT `fk_skill_progress_member` FOREIGN KEY (`member_profile_id`) REFERENCES `member_profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `muscle_groups` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_muscle_groups_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `notifications` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_by` bigint NOT NULL,
  `title` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('INFO','MAINTENANCE','WARNING','REVIEW_RESULT') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INFO',
  `audience` enum('ALL','MEMBER','CONTENT_MANAGER','USER') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ALL',
  `status` enum('DRAFT','PUBLISHED','EXPIRED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `publish_at` datetime DEFAULT NULL,
  `expire_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_notifications_creator` (`created_by`),
  KEY `idx_notifications_status` (`status`,`publish_at`),
  CONSTRAINT `fk_notifications_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `ck_notifications_expire` CHECK (((`expire_at` is null) or (`publish_at` is null) or (`expire_at` > `publish_at`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `plan_exercises` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `training_plan_id` bigint NOT NULL,
  `exercise_id` bigint NOT NULL,
  `sequence` int NOT NULL,
  `sets` tinyint unsigned DEFAULT NULL,
  `reps` smallint unsigned DEFAULT NULL,
  `rest_seconds` smallint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_plan_exercises_seq` (`training_plan_id`,`sequence`),
  KEY `fk_plan_exercises_exercise` (`exercise_id`),
  CONSTRAINT `fk_plan_exercises_exercise` FOREIGN KEY (`exercise_id`) REFERENCES `exercises` (`id`),
  CONSTRAINT `fk_plan_exercises_plan` FOREIGN KEY (`training_plan_id`) REFERENCES `training_plans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `profanity_words` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `word` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `language` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'vi',
  `severity` enum('LOW','HIGH') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'HIGH',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_profanity_words_word` (`word`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `progression_rules` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `exercise_id` bigint NOT NULL,
  `prerequisite_exercise_id` bigint NOT NULL,
  `rule_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `relationship` enum('PROGRESSION','REGRESSION') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PROGRESSION',
  `required_reps` int DEFAULT NULL,
  `min_accuracy` tinyint unsigned DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_progression_exercise` (`exercise_id`),
  KEY `fk_progression_prereq` (`prerequisite_exercise_id`),
  CONSTRAINT `fk_progression_exercise` FOREIGN KEY (`exercise_id`) REFERENCES `exercises` (`id`),
  CONSTRAINT `fk_progression_prereq` FOREIGN KEY (`prerequisite_exercise_id`) REFERENCES `exercises` (`id`),
  CONSTRAINT `ck_progression_accuracy` CHECK ((`min_accuracy` between 0 and 100)),
  CONSTRAINT `ck_progression_not_self` CHECK ((`exercise_id` <> `prerequisite_exercise_id`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `scheduled_workouts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `member_profile_id` bigint NOT NULL,
  `training_plan_id` bigint NOT NULL,
  `scheduled_date` date NOT NULL,
  `status` enum('SCHEDULED','COMPLETED','MISSED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SCHEDULED',
  PRIMARY KEY (`id`),
  KEY `fk_scheduled_plan` (`training_plan_id`),
  KEY `idx_scheduled_member_date` (`member_profile_id`,`scheduled_date`),
  CONSTRAINT `fk_scheduled_member` FOREIGN KEY (`member_profile_id`) REFERENCES `member_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_scheduled_plan` FOREIGN KEY (`training_plan_id`) REFERENCES `training_plans` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `session_exercise_results` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `workout_session_id` bigint NOT NULL,
  `exercise_id` bigint NOT NULL,
  `sets_completed` tinyint unsigned NOT NULL DEFAULT '0',
  `valid_reps` int NOT NULL DEFAULT '0',
  `invalid_reps` int NOT NULL DEFAULT '0',
  `accuracy` decimal(5,2) DEFAULT NULL COMMENT 'valid / (valid + invalid) * 100; > 70 là đạt',
  `active_seconds` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `fk_results_session` (`workout_session_id`),
  KEY `fk_results_exercise` (`exercise_id`),
  CONSTRAINT `fk_results_exercise` FOREIGN KEY (`exercise_id`) REFERENCES `exercises` (`id`),
  CONSTRAINT `fk_results_session` FOREIGN KEY (`workout_session_id`) REFERENCES `workout_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `survey_answers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `survey_submission_id` bigint NOT NULL,
  `survey_question_id` bigint NOT NULL,
  `answer_value` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_survey_answers` (`survey_submission_id`,`survey_question_id`),
  KEY `fk_answers_question` (`survey_question_id`),
  CONSTRAINT `fk_answers_question` FOREIGN KEY (`survey_question_id`) REFERENCES `survey_questions` (`id`),
  CONSTRAINT `fk_answers_submission` FOREIGN KEY (`survey_submission_id`) REFERENCES `survey_submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `survey_questions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `survey_id` bigint NOT NULL,
  `question_text` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `answer_type` enum('NUMBER','TEXT','SINGLE_CHOICE','MULTI_CHOICE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `options` json DEFAULT NULL,
  `display_order` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_survey_questions_order` (`survey_id`,`display_order`),
  CONSTRAINT `fk_survey_questions_survey` FOREIGN KEY (`survey_id`) REFERENCES `surveys` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `survey_submissions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `member_profile_id` bigint NOT NULL,
  `survey_id` bigint NOT NULL,
  `fitness_level_id` bigint NOT NULL,
  `score` decimal(5,2) DEFAULT NULL,
  `submitted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_submissions_survey` (`survey_id`),
  KEY `fk_submissions_level` (`fitness_level_id`),
  KEY `idx_submissions_latest` (`member_profile_id`,`survey_id`,`submitted_at`),
  CONSTRAINT `fk_submissions_level` FOREIGN KEY (`fitness_level_id`) REFERENCES `fitness_levels` (`id`),
  CONSTRAINT `fk_submissions_member` FOREIGN KEY (`member_profile_id`) REFERENCES `member_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_submissions_survey` FOREIGN KEY (`survey_id`) REFERENCES `surveys` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `surveys` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('BODY_INFO','GOALS','ROUTINE','LEVEL_TEST') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('DRAFT','ACTIVE','ARCHIVED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `system_settings` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `value` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `priority` int NOT NULL DEFAULT '1',
  `status` enum('ACTIVE','INACTIVE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_system_settings_name` (`name`),
  CONSTRAINT `ck_system_settings_name` CHECK ((not(regexp_like(`name`,_utf8mb4'^[0-9]+$')))),
  CONSTRAINT `ck_system_settings_priority` CHECK ((`priority` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `system_usage_stats` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `stat_date` date NOT NULL,
  `active_users` int NOT NULL DEFAULT '0',
  `new_users` int NOT NULL DEFAULT '0',
  `sessions_count` int NOT NULL DEFAULT '0',
  `uploads_count` int NOT NULL DEFAULT '0',
  `storage_used_mb` decimal(12,2) NOT NULL DEFAULT '0.00',
  `ai_scans_count` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_system_usage_stats_date` (`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `training_plans` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `fitness_level_id` bigint NOT NULL,
  `created_by` bigint NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `goal` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `plan_type` enum('TEMPLATE','PERSONAL') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'TEMPLATE',
  `source` enum('SYSTEM','MEMBER') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SYSTEM',
  `status` enum('DRAFT','PENDING_REVIEW','ACTIVE','REJECTED','ARCHIVED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  PRIMARY KEY (`id`),
  KEY `fk_training_plans_level` (`fitness_level_id`),
  KEY `fk_training_plans_creator` (`created_by`),
  KEY `idx_training_plans_status` (`status`,`source`),
  CONSTRAINT `fk_training_plans_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_training_plans_level` FOREIGN KEY (`fitness_level_id`) REFERENCES `fitness_levels` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `upload_configs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `purpose` enum('WORKOUT_VIDEO','EXERCISE_VIDEO','AVATAR','ATTACHMENT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `allowed_formats` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_size_mb` int DEFAULT NULL,
  `max_duration_seconds` int DEFAULT NULL,
  `retention_days` int DEFAULT NULL,
  `is_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `updated_by` bigint NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_upload_configs_purpose` (`purpose`),
  KEY `fk_upload_configs_user` (`updated_by`),
  CONSTRAINT `fk_upload_configs_user` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `uploaded_videos` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `workout_session_id` bigint NOT NULL,
  `media_file_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_uploaded_videos_session` (`workout_session_id`),
  KEY `fk_uploaded_videos_media` (`media_file_id`),
  CONSTRAINT `fk_uploaded_videos_media` FOREIGN KEY (`media_file_id`) REFERENCES `media_files` (`id`),
  CONSTRAINT `fk_uploaded_videos_session` FOREIGN KEY (`workout_session_id`) REFERENCES `workout_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_notifications` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `notification_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `read_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_notifications` (`notification_id`,`user_id`),
  KEY `idx_user_notifications_unread` (`user_id`,`is_read`),
  CONSTRAINT `fk_user_notifications_notification` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `full_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mật khẩu đã băm',
  `role` enum('MEMBER','ADMIN','CONTENT_MANAGER') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MEMBER',
  `enabled` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  CONSTRAINT `ck_users_full_name` CHECK ((char_length(`full_name`) between 2 and 50))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @saved_cs_client     = @@character_set_client;

SET character_set_client = @saved_cs_client;
SET @saved_cs_client     = @@character_set_client;

SET character_set_client = @saved_cs_client;

CREATE TABLE `weekly_performances` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `member_profile_id` bigint NOT NULL,
  `week_start` date NOT NULL,
  `total_volume` int NOT NULL DEFAULT '0',
  `clean_reps` int NOT NULL DEFAULT '0',
  `health_score` tinyint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_weekly_performances` (`member_profile_id`,`week_start`),
  CONSTRAINT `fk_weekly_performances_member` FOREIGN KEY (`member_profile_id`) REFERENCES `member_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ck_weekly_performances_score` CHECK ((`health_score` between 0 and 100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `workout_sessions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `member_profile_id` bigint NOT NULL,
  `scheduled_workout_id` bigint DEFAULT NULL,
  `title` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` enum('LIVE_CAMERA','UPLOADED_VIDEO') COLLATE utf8mb4_unicode_ci NOT NULL,
  `started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ended_at` datetime DEFAULT NULL,
  `active_seconds` int NOT NULL DEFAULT '0',
  `rest_seconds` int NOT NULL DEFAULT '0',
  `accuracy` decimal(5,2) DEFAULT NULL,
  `status` enum('IN_PROGRESS','COMPLETED','ABANDONED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'IN_PROGRESS',
  PRIMARY KEY (`id`),
  KEY `fk_sessions_scheduled` (`scheduled_workout_id`),
  KEY `idx_sessions_member_time` (`member_profile_id`,`started_at`),
  CONSTRAINT `fk_sessions_member` FOREIGN KEY (`member_profile_id`) REFERENCES `member_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sessions_scheduled` FOREIGN KEY (`scheduled_workout_id`) REFERENCES `scheduled_workouts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

CREATE VIEW `v_storage_usage` AS select coalesce(sum(`m`.`size_mb`),0) AS `used_mb`,(cast(`s`.`value` as decimal(12,2)) * 1024) AS `quota_mb`,round(((coalesce(sum(`m`.`size_mb`),0) / (cast(`s`.`value` as decimal(12,2)) * 1024)) * 100),2) AS `used_percent` from ((select `system_settings`.`value` AS `value` from `system_settings` where ((`system_settings`.`name` = 'storage_quota_gb') and (`system_settings`.`status` = 'ACTIVE'))) `s` left join `media_files` `m` on((`m`.`status` <> 'DELETED'))) group by `s`.`value` ;

CREATE VIEW `v_unread_notifications` AS select `un`.`user_id` AS `user_id`,`n`.`id` AS `notification_id`,`n`.`title` AS `title`,`n`.`type` AS `type`,`n`.`publish_at` AS `publish_at` from (`user_notifications` `un` join `notifications` `n` on((`n`.`id` = `un`.`notification_id`))) where ((`un`.`is_read` = false) and (`n`.`status` = 'PUBLISHED') and ((`n`.`publish_at` is null) or (`n`.`publish_at` <= now())) and ((`n`.`expire_at` is null) or (`n`.`expire_at` > now()))) ;
