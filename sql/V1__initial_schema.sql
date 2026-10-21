-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: calishealth
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `activity_logs`
--

DROP TABLE IF EXISTS `activity_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `activity_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `action` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_activity_logs_user_time` (`user_id`,`created_at`),
  CONSTRAINT `fk_activity_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `activity_logs`
--

LOCK TABLES `activity_logs` WRITE;
/*!40000 ALTER TABLE `activity_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `activity_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_tokens`
--

DROP TABLE IF EXISTS `auth_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_tokens` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `token` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `type` enum('VERIFY_EMAIL','RESET_PASSWORD','REFRESH') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_auth_tokens_token` (`token`),
  KEY `fk_auth_tokens_user` (`user_id`),
  KEY `idx_auth_tokens_expires` (`expires_at`),
  CONSTRAINT `fk_auth_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_tokens`
--

LOCK TABLES `auth_tokens` WRITE;
/*!40000 ALTER TABLE `auth_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `auth_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `benchmark_criteria`
--

DROP TABLE IF EXISTS `benchmark_criteria`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `benchmark_criteria`
--

LOCK TABLES `benchmark_criteria` WRITE;
/*!40000 ALTER TABLE `benchmark_criteria` DISABLE KEYS */;
/*!40000 ALTER TABLE `benchmark_criteria` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `body_measurements`
--

DROP TABLE IF EXISTS `body_measurements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `body_measurements`
--

LOCK TABLES `body_measurements` WRITE;
/*!40000 ALTER TABLE `body_measurements` DISABLE KEYS */;
/*!40000 ALTER TABLE `body_measurements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cleanup_runs`
--

DROP TABLE IF EXISTS `cleanup_runs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cleanup_runs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `triggered_by` bigint DEFAULT NULL COMMENT 'NULL = job tự động',
  `job_type` enum('ORPHAN_FILES','REJECTED_UPLOADS','EXPIRED_TOKENS','TEMP_FILES','OLD_LOGS') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `finished_at` datetime DEFAULT NULL,
  `status` enum('RUNNING','COMPLETED','FAILED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'RUNNING',
  `files_deleted` int NOT NULL DEFAULT '0',
  `freed_mb` decimal(10,2) NOT NULL DEFAULT '0.00',
  `error_message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `fk_cleanup_runs_user` (`triggered_by`),
  CONSTRAINT `fk_cleanup_runs_user` FOREIGN KEY (`triggered_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cleanup_runs`
--

LOCK TABLES `cleanup_runs` WRITE;
/*!40000 ALTER TABLE `cleanup_runs` DISABLE KEYS */;
/*!40000 ALTER TABLE `cleanup_runs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `content_reviews`
--

DROP TABLE IF EXISTS `content_reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `content_reviews` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `exercise_id` bigint DEFAULT NULL,
  `training_plan_id` bigint DEFAULT NULL,
  `submitted_by` bigint NOT NULL,
  `reviewer_id` bigint DEFAULT NULL COMMENT 'Chỉ CONTENT_MANAGER/ADMIN: kiểm tra ở tầng ứng dụng',
  `content_type` enum('EXERCISE','CUSTOM_WORKOUT') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PENDING_SCAN','SCAN_FAILED','PENDING_REVIEW','APPROVED','REJECTED','NEEDS_CHANGES') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING_SCAN',
  `reject_reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `content_reviews`
--

LOCK TABLES `content_reviews` WRITE;
/*!40000 ALTER TABLE `content_reviews` DISABLE KEYS */;
/*!40000 ALTER TABLE `content_reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `content_scans`
--

DROP TABLE IF EXISTS `content_scans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `content_scans` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `content_review_id` bigint NOT NULL,
  `media_file_id` bigint DEFAULT NULL,
  `scan_type` enum('PROFANITY_TEXT','MEDIAPIPE_POSE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PENDING','PASSED','FLAGGED','FAILED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `score` decimal(5,2) DEFAULT NULL,
  `flagged_terms` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `details` json DEFAULT NULL,
  `scanned_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_scans_review` (`content_review_id`),
  KEY `fk_scans_media` (`media_file_id`),
  CONSTRAINT `fk_scans_media` FOREIGN KEY (`media_file_id`) REFERENCES `media_files` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_scans_review` FOREIGN KEY (`content_review_id`) REFERENCES `content_reviews` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `content_scans`
--

LOCK TABLES `content_scans` WRITE;
/*!40000 ALTER TABLE `content_scans` DISABLE KEYS */;
/*!40000 ALTER TABLE `content_scans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `exercise_muscle_groups`
--

DROP TABLE IF EXISTS `exercise_muscle_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `exercise_muscle_groups` (
  `exercise_id` bigint NOT NULL,
  `muscle_group_id` bigint NOT NULL,
  PRIMARY KEY (`exercise_id`,`muscle_group_id`),
  KEY `fk_emg_muscle_group` (`muscle_group_id`),
  CONSTRAINT `fk_emg_exercise` FOREIGN KEY (`exercise_id`) REFERENCES `exercises` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_emg_muscle_group` FOREIGN KEY (`muscle_group_id`) REFERENCES `muscle_groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `exercise_muscle_groups`
--

LOCK TABLES `exercise_muscle_groups` WRITE;
/*!40000 ALTER TABLE `exercise_muscle_groups` DISABLE KEYS */;
/*!40000 ALTER TABLE `exercise_muscle_groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `exercise_variations`
--

DROP TABLE IF EXISTS `exercise_variations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `exercise_variations` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `exercise_id` bigint NOT NULL,
  `variant_exercise_id` bigint NOT NULL,
  `type` enum('PROGRESSION','REGRESSION','ALTERNATIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_exercise_variations` (`exercise_id`,`variant_exercise_id`),
  KEY `fk_variations_variant` (`variant_exercise_id`),
  CONSTRAINT `fk_variations_exercise` FOREIGN KEY (`exercise_id`) REFERENCES `exercises` (`id`),
  CONSTRAINT `fk_variations_variant` FOREIGN KEY (`variant_exercise_id`) REFERENCES `exercises` (`id`),
  CONSTRAINT `ck_variations_not_self` CHECK ((`exercise_id` <> `variant_exercise_id`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `exercise_variations`
--

LOCK TABLES `exercise_variations` WRITE;
/*!40000 ALTER TABLE `exercise_variations` DISABLE KEYS */;
/*!40000 ALTER TABLE `exercise_variations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `exercises`
--

DROP TABLE IF EXISTS `exercises`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `exercises` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('EXERCISE','SKILL') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'EXERCISE',
  `category` enum('STRENGTH','CARDIO') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'STRENGTH',
  `difficulty_level` tinyint unsigned DEFAULT NULL,
  `instructions` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `execution_steps` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `safety_tips` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `anatomy_theory` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `video_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `demo_media_id` bigint DEFAULT NULL,
  `default_sets` tinyint unsigned DEFAULT NULL,
  `default_reps` smallint unsigned DEFAULT NULL,
  `default_rest` smallint unsigned DEFAULT NULL COMMENT 'giây',
  `source` enum('SYSTEM','MEMBER') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SYSTEM',
  `created_by` bigint NOT NULL,
  `status` enum('DRAFT','PENDING_REVIEW','ACTIVE','REJECTED','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_exercises_name` (`name`),
  KEY `fk_exercises_demo_media` (`demo_media_id`),
  KEY `fk_exercises_creator` (`created_by`),
  KEY `idx_exercises_status` (`status`,`source`),
  CONSTRAINT `fk_exercises_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_exercises_demo_media` FOREIGN KEY (`demo_media_id`) REFERENCES `media_files` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `exercises`
--

LOCK TABLES `exercises` WRITE;
/*!40000 ALTER TABLE `exercises` DISABLE KEYS */;
/*!40000 ALTER TABLE `exercises` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fitness_levels`
--

DROP TABLE IF EXISTS `fitness_levels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fitness_levels` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `min_score` decimal(5,2) DEFAULT NULL,
  `max_score` decimal(5,2) DEFAULT NULL,
  `formula_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `formula` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fitness_levels_name` (`name`),
  CONSTRAINT `ck_fitness_levels_score` CHECK (((`min_score` is null) or (`max_score` is null) or (`min_score` <= `max_score`)))
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fitness_levels`
--

LOCK TABLES `fitness_levels` WRITE;
/*!40000 ALTER TABLE `fitness_levels` DISABLE KEYS */;
INSERT INTO `fitness_levels` VALUES (1,'Beginner','Mới bắt đầu','ACTIVE',0.00,39.99,'WEIGHTED_SUM','SUM(value/min_value * weight)'),(2,'Intermediate','Đã có nền tảng','ACTIVE',40.00,74.99,'WEIGHTED_SUM','SUM(value/min_value * weight)'),(3,'Advanced','Thành thạo kỹ năng','ACTIVE',75.00,100.00,'WEIGHTED_SUM','SUM(value/min_value * weight)');
/*!40000 ALTER TABLE `fitness_levels` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `form_error_logs`
--

DROP TABLE IF EXISTS `form_error_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `form_error_logs`
--

LOCK TABLES `form_error_logs` WRITE;
/*!40000 ALTER TABLE `form_error_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `form_error_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `form_rules`
--

DROP TABLE IF EXISTS `form_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `form_rules` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `exercise_id` bigint NOT NULL,
  `joint` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `angle_threshold` decimal(5,2) DEFAULT NULL,
  `rom_depth` decimal(5,2) DEFAULT NULL,
  `feedback_message` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_form_rules` (`exercise_id`,`joint`),
  CONSTRAINT `fk_form_rules_exercise` FOREIGN KEY (`exercise_id`) REFERENCES `exercises` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `form_rules`
--

LOCK TABLES `form_rules` WRITE;
/*!40000 ALTER TABLE `form_rules` DISABLE KEYS */;
/*!40000 ALTER TABLE `form_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `maintenance_schedules`
--

DROP TABLE IF EXISTS `maintenance_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `maintenance_schedules` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_by` bigint NOT NULL,
  `notification_id` bigint DEFAULT NULL,
  `title` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `maintenance_type` enum('PLANNED','EMERGENCY') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PLANNED',
  `affected_scope` enum('ALL','AI_ANALYSIS','UPLOAD','ADMIN_ONLY') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ALL',
  `start_at` datetime NOT NULL,
  `end_at` datetime NOT NULL,
  `status` enum('SCHEDULED','ACTIVE','COMPLETED','CANCELLED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SCHEDULED',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_maintenance_creator` (`created_by`),
  KEY `fk_maintenance_notification` (`notification_id`),
  KEY `idx_maintenance_window` (`status`,`start_at`,`end_at`),
  CONSTRAINT `fk_maintenance_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_maintenance_notification` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE SET NULL,
  CONSTRAINT `ck_maintenance_time` CHECK ((`end_at` > `start_at`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `maintenance_schedules`
--

LOCK TABLES `maintenance_schedules` WRITE;
/*!40000 ALTER TABLE `maintenance_schedules` DISABLE KEYS */;
/*!40000 ALTER TABLE `maintenance_schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `media_files`
--

DROP TABLE IF EXISTS `media_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `media_files` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `uploader_id` bigint NOT NULL,
  `file_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_type` enum('VIDEO','IMAGE','DOCUMENT') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `format` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `size_mb` decimal(8,2) NOT NULL DEFAULT '0.00',
  `duration_seconds` int DEFAULT NULL,
  `purpose` enum('WORKOUT_VIDEO','EXERCISE_VIDEO','AVATAR','ATTACHMENT') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PENDING_SCAN','ACTIVE','REJECTED','ORPHANED','DELETED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING_SCAN',
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_media_files_url` (`file_url`),
  KEY `fk_media_files_uploader` (`uploader_id`),
  KEY `idx_media_files_status` (`status`,`uploaded_at`),
  CONSTRAINT `fk_media_files_uploader` FOREIGN KEY (`uploader_id`) REFERENCES `users` (`id`),
  CONSTRAINT `ck_media_files_size` CHECK ((`size_mb` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `media_files`
--

LOCK TABLES `media_files` WRITE;
/*!40000 ALTER TABLE `media_files` DISABLE KEYS */;
/*!40000 ALTER TABLE `media_files` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `member_profiles`
--

DROP TABLE IF EXISTS `member_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `member_profiles` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `fitness_level_id` bigint DEFAULT NULL,
  `gender` enum('MALE','FEMALE','OTHER') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_of_birth` date NOT NULL COMMENT 'Đủ 13 tuổi: kiểm tra ở tầng ứng dụng',
  `weight` decimal(5,2) DEFAULT NULL,
  `height` decimal(5,2) DEFAULT NULL,
  `goals` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `streak_count` int NOT NULL DEFAULT '0',
  `longest_streak` int NOT NULL DEFAULT '0',
  `bio` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `member_profiles`
--

LOCK TABLES `member_profiles` WRITE;
/*!40000 ALTER TABLE `member_profiles` DISABLE KEYS */;
/*!40000 ALTER TABLE `member_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `member_skill_progress`
--

DROP TABLE IF EXISTS `member_skill_progress`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `member_skill_progress` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `member_profile_id` bigint NOT NULL,
  `exercise_id` bigint NOT NULL,
  `status` enum('LOCKED','UNLOCKED','MASTERED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'LOCKED',
  `best_reps` int NOT NULL DEFAULT '0',
  `best_accuracy` decimal(5,2) NOT NULL DEFAULT '0.00',
  `unlocked_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_member_skill_progress` (`member_profile_id`,`exercise_id`),
  KEY `fk_skill_progress_exercise` (`exercise_id`),
  CONSTRAINT `fk_skill_progress_exercise` FOREIGN KEY (`exercise_id`) REFERENCES `exercises` (`id`),
  CONSTRAINT `fk_skill_progress_member` FOREIGN KEY (`member_profile_id`) REFERENCES `member_profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `member_skill_progress`
--

LOCK TABLES `member_skill_progress` WRITE;
/*!40000 ALTER TABLE `member_skill_progress` DISABLE KEYS */;
/*!40000 ALTER TABLE `member_skill_progress` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `muscle_groups`
--

DROP TABLE IF EXISTS `muscle_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `muscle_groups` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_muscle_groups_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `muscle_groups`
--

LOCK TABLES `muscle_groups` WRITE;
/*!40000 ALTER TABLE `muscle_groups` DISABLE KEYS */;
INSERT INTO `muscle_groups` VALUES (7,'Chân'),(6,'Core'),(2,'Lưng'),(8,'Mông'),(1,'Ngực'),(5,'Tay sau'),(4,'Tay trước'),(3,'Vai');
/*!40000 ALTER TABLE `muscle_groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_by` bigint NOT NULL,
  `title` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('INFO','MAINTENANCE','WARNING','REVIEW_RESULT') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INFO',
  `audience` enum('ALL','MEMBER','CONTENT_MANAGER','USER') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ALL',
  `status` enum('DRAFT','PUBLISHED','EXPIRED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `publish_at` datetime DEFAULT NULL,
  `expire_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_notifications_creator` (`created_by`),
  KEY `idx_notifications_status` (`status`,`publish_at`),
  CONSTRAINT `fk_notifications_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `ck_notifications_expire` CHECK (((`expire_at` is null) or (`publish_at` is null) or (`expire_at` > `publish_at`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `plan_exercises`
--

DROP TABLE IF EXISTS `plan_exercises`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `plan_exercises`
--

LOCK TABLES `plan_exercises` WRITE;
/*!40000 ALTER TABLE `plan_exercises` DISABLE KEYS */;
/*!40000 ALTER TABLE `plan_exercises` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `profanity_words`
--

DROP TABLE IF EXISTS `profanity_words`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `profanity_words` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `word` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `language` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'vi',
  `severity` enum('LOW','HIGH') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'HIGH',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_profanity_words_word` (`word`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `profanity_words`
--

LOCK TABLES `profanity_words` WRITE;
/*!40000 ALTER TABLE `profanity_words` DISABLE KEYS */;
/*!40000 ALTER TABLE `profanity_words` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `progression_rules`
--

DROP TABLE IF EXISTS `progression_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `progression_rules` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `exercise_id` bigint NOT NULL,
  `prerequisite_exercise_id` bigint NOT NULL,
  `rule_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `relationship` enum('PROGRESSION','REGRESSION') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PROGRESSION',
  `required_reps` int DEFAULT NULL,
  `min_accuracy` tinyint unsigned DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_progression_exercise` (`exercise_id`),
  KEY `fk_progression_prereq` (`prerequisite_exercise_id`),
  CONSTRAINT `fk_progression_exercise` FOREIGN KEY (`exercise_id`) REFERENCES `exercises` (`id`),
  CONSTRAINT `fk_progression_prereq` FOREIGN KEY (`prerequisite_exercise_id`) REFERENCES `exercises` (`id`),
  CONSTRAINT `ck_progression_accuracy` CHECK ((`min_accuracy` between 0 and 100)),
  CONSTRAINT `ck_progression_not_self` CHECK ((`exercise_id` <> `prerequisite_exercise_id`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `progression_rules`
--

LOCK TABLES `progression_rules` WRITE;
/*!40000 ALTER TABLE `progression_rules` DISABLE KEYS */;
/*!40000 ALTER TABLE `progression_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `scheduled_workouts`
--

DROP TABLE IF EXISTS `scheduled_workouts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scheduled_workouts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `member_profile_id` bigint NOT NULL,
  `training_plan_id` bigint NOT NULL,
  `scheduled_date` date NOT NULL,
  `status` enum('SCHEDULED','COMPLETED','MISSED','CANCELLED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SCHEDULED',
  PRIMARY KEY (`id`),
  KEY `fk_scheduled_plan` (`training_plan_id`),
  KEY `idx_scheduled_member_date` (`member_profile_id`,`scheduled_date`),
  CONSTRAINT `fk_scheduled_member` FOREIGN KEY (`member_profile_id`) REFERENCES `member_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_scheduled_plan` FOREIGN KEY (`training_plan_id`) REFERENCES `training_plans` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `scheduled_workouts`
--

LOCK TABLES `scheduled_workouts` WRITE;
/*!40000 ALTER TABLE `scheduled_workouts` DISABLE KEYS */;
/*!40000 ALTER TABLE `scheduled_workouts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `session_exercise_results`
--

DROP TABLE IF EXISTS `session_exercise_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `session_exercise_results`
--

LOCK TABLES `session_exercise_results` WRITE;
/*!40000 ALTER TABLE `session_exercise_results` DISABLE KEYS */;
/*!40000 ALTER TABLE `session_exercise_results` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `survey_answers`
--

DROP TABLE IF EXISTS `survey_answers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `survey_answers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `survey_submission_id` bigint NOT NULL,
  `survey_question_id` bigint NOT NULL,
  `answer_value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_survey_answers` (`survey_submission_id`,`survey_question_id`),
  KEY `fk_answers_question` (`survey_question_id`),
  CONSTRAINT `fk_answers_question` FOREIGN KEY (`survey_question_id`) REFERENCES `survey_questions` (`id`),
  CONSTRAINT `fk_answers_submission` FOREIGN KEY (`survey_submission_id`) REFERENCES `survey_submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `survey_answers`
--

LOCK TABLES `survey_answers` WRITE;
/*!40000 ALTER TABLE `survey_answers` DISABLE KEYS */;
/*!40000 ALTER TABLE `survey_answers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `survey_questions`
--

DROP TABLE IF EXISTS `survey_questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `survey_questions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `survey_id` bigint NOT NULL,
  `question_text` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `answer_type` enum('NUMBER','TEXT','SINGLE_CHOICE','MULTI_CHOICE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `options` json DEFAULT NULL,
  `display_order` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_survey_questions_order` (`survey_id`,`display_order`),
  CONSTRAINT `fk_survey_questions_survey` FOREIGN KEY (`survey_id`) REFERENCES `surveys` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `survey_questions`
--

LOCK TABLES `survey_questions` WRITE;
/*!40000 ALTER TABLE `survey_questions` DISABLE KEYS */;
/*!40000 ALTER TABLE `survey_questions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `survey_submissions`
--

DROP TABLE IF EXISTS `survey_submissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `survey_submissions`
--

LOCK TABLES `survey_submissions` WRITE;
/*!40000 ALTER TABLE `survey_submissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `survey_submissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `surveys`
--

DROP TABLE IF EXISTS `surveys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `surveys` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('BODY_INFO','GOALS','ROUTINE','LEVEL_TEST') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('DRAFT','ACTIVE','ARCHIVED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `surveys`
--

LOCK TABLES `surveys` WRITE;
/*!40000 ALTER TABLE `surveys` DISABLE KEYS */;
/*!40000 ALTER TABLE `surveys` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `value` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `priority` int NOT NULL DEFAULT '1',
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_system_settings_name` (`name`),
  CONSTRAINT `ck_system_settings_name` CHECK ((not(regexp_like(`name`,_utf8mb4'^[0-9]+$')))),
  CONSTRAINT `ck_system_settings_priority` CHECK ((`priority` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_settings`
--

LOCK TABLES `system_settings` WRITE;
/*!40000 ALTER TABLE `system_settings` DISABLE KEYS */;
INSERT INTO `system_settings` VALUES (1,'storage_quota_gb','INT','500',1,'ACTIVE');
/*!40000 ALTER TABLE `system_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_usage_stats`
--

DROP TABLE IF EXISTS `system_usage_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_usage_stats`
--

LOCK TABLES `system_usage_stats` WRITE;
/*!40000 ALTER TABLE `system_usage_stats` DISABLE KEYS */;
/*!40000 ALTER TABLE `system_usage_stats` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `training_plans`
--

DROP TABLE IF EXISTS `training_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `training_plans` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `fitness_level_id` bigint NOT NULL,
  `created_by` bigint NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `goal` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `plan_type` enum('TEMPLATE','PERSONAL') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'TEMPLATE',
  `source` enum('SYSTEM','MEMBER') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SYSTEM',
  `status` enum('DRAFT','PENDING_REVIEW','ACTIVE','REJECTED','ARCHIVED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  PRIMARY KEY (`id`),
  KEY `fk_training_plans_level` (`fitness_level_id`),
  KEY `fk_training_plans_creator` (`created_by`),
  KEY `idx_training_plans_status` (`status`,`source`),
  CONSTRAINT `fk_training_plans_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_training_plans_level` FOREIGN KEY (`fitness_level_id`) REFERENCES `fitness_levels` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `training_plans`
--

LOCK TABLES `training_plans` WRITE;
/*!40000 ALTER TABLE `training_plans` DISABLE KEYS */;
/*!40000 ALTER TABLE `training_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `upload_configs`
--

DROP TABLE IF EXISTS `upload_configs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `upload_configs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `purpose` enum('WORKOUT_VIDEO','EXERCISE_VIDEO','AVATAR','ATTACHMENT') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `allowed_formats` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `upload_configs`
--

LOCK TABLES `upload_configs` WRITE;
/*!40000 ALTER TABLE `upload_configs` DISABLE KEYS */;
INSERT INTO `upload_configs` VALUES (1,'WORKOUT_VIDEO','mp4,mov',500,600,7,1,1,'2026-10-21 13:34:50'),(2,'EXERCISE_VIDEO','mp4,mov',200,180,14,1,1,'2026-10-21 13:34:50'),(3,'AVATAR','jpg,jpeg,png',5,NULL,3,1,1,'2026-10-21 13:34:50'),(4,'ATTACHMENT','pdf,jpg,png',20,NULL,7,1,1,'2026-10-21 13:34:50');
/*!40000 ALTER TABLE `upload_configs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `uploaded_videos`
--

DROP TABLE IF EXISTS `uploaded_videos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `uploaded_videos`
--

LOCK TABLES `uploaded_videos` WRITE;
/*!40000 ALTER TABLE `uploaded_videos` DISABLE KEYS */;
/*!40000 ALTER TABLE `uploaded_videos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_notifications`
--

DROP TABLE IF EXISTS `user_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_notifications`
--

LOCK TABLES `user_notifications` WRITE;
/*!40000 ALTER TABLE `user_notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `full_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mật khẩu đã băm',
  `role` enum('MEMBER','ADMIN','CONTENT_MANAGER') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MEMBER',
  `enabled` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  CONSTRAINT `ck_users_full_name` CHECK ((char_length(`full_name`) between 2 and 50))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'System Admin','admin@example.com','CHANGE_ME_BCRYPT_HASH','ADMIN',1,'2026-10-21 13:34:50');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `v_storage_usage`
--

DROP TABLE IF EXISTS `v_storage_usage`;
/*!50001 DROP VIEW IF EXISTS `v_storage_usage`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_storage_usage` AS SELECT 
 1 AS `used_mb`,
 1 AS `quota_mb`,
 1 AS `used_percent`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_unread_notifications`
--

DROP TABLE IF EXISTS `v_unread_notifications`;
/*!50001 DROP VIEW IF EXISTS `v_unread_notifications`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_unread_notifications` AS SELECT 
 1 AS `user_id`,
 1 AS `notification_id`,
 1 AS `title`,
 1 AS `type`,
 1 AS `publish_at`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `weekly_performances`
--

DROP TABLE IF EXISTS `weekly_performances`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `weekly_performances`
--

LOCK TABLES `weekly_performances` WRITE;
/*!40000 ALTER TABLE `weekly_performances` DISABLE KEYS */;
/*!40000 ALTER TABLE `weekly_performances` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workout_sessions`
--

DROP TABLE IF EXISTS `workout_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workout_sessions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `member_profile_id` bigint NOT NULL,
  `scheduled_workout_id` bigint DEFAULT NULL,
  `title` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` enum('LIVE_CAMERA','UPLOADED_VIDEO') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ended_at` datetime DEFAULT NULL,
  `active_seconds` int NOT NULL DEFAULT '0',
  `rest_seconds` int NOT NULL DEFAULT '0',
  `accuracy` decimal(5,2) DEFAULT NULL,
  `status` enum('IN_PROGRESS','COMPLETED','ABANDONED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'IN_PROGRESS',
  PRIMARY KEY (`id`),
  KEY `fk_sessions_scheduled` (`scheduled_workout_id`),
  KEY `idx_sessions_member_time` (`member_profile_id`,`started_at`),
  CONSTRAINT `fk_sessions_member` FOREIGN KEY (`member_profile_id`) REFERENCES `member_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sessions_scheduled` FOREIGN KEY (`scheduled_workout_id`) REFERENCES `scheduled_workouts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workout_sessions`
--

LOCK TABLES `workout_sessions` WRITE;
/*!40000 ALTER TABLE `workout_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `workout_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Final view structure for view `v_storage_usage`
--

/*!50001 DROP VIEW IF EXISTS `v_storage_usage`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_storage_usage` AS select coalesce(sum(`m`.`size_mb`),0) AS `used_mb`,(cast(`s`.`value` as decimal(12,2)) * 1024) AS `quota_mb`,round(((coalesce(sum(`m`.`size_mb`),0) / (cast(`s`.`value` as decimal(12,2)) * 1024)) * 100),2) AS `used_percent` from ((select `system_settings`.`value` AS `value` from `system_settings` where ((`system_settings`.`name` = 'storage_quota_gb') and (`system_settings`.`status` = 'ACTIVE'))) `s` left join `media_files` `m` on((`m`.`status` <> 'DELETED'))) group by `s`.`value` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_unread_notifications`
--

/*!50001 DROP VIEW IF EXISTS `v_unread_notifications`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_unread_notifications` AS select `un`.`user_id` AS `user_id`,`n`.`id` AS `notification_id`,`n`.`title` AS `title`,`n`.`type` AS `type`,`n`.`publish_at` AS `publish_at` from (`user_notifications` `un` join `notifications` `n` on((`n`.`id` = `un`.`notification_id`))) where ((`un`.`is_read` = false) and (`n`.`status` = 'PUBLISHED') and ((`n`.`publish_at` is null) or (`n`.`publish_at` <= now())) and ((`n`.`expire_at` is null) or (`n`.`expire_at` > now()))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-21 14:58:32
