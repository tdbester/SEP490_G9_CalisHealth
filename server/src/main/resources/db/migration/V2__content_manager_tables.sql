-- Tables used by the Content_Manager backend (ExerciseEntry, WorkoutEntry, WorkoutPlanItem)
-- that are not part of the calisthenics_db ERD yet.

CREATE TABLE `exercise_entries` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `active` bit(1) NOT NULL,
  `anatomy_image_url` varchar(1000) DEFAULT NULL,
  `category` varchar(80) DEFAULT NULL,
  `code` varchar(30) NOT NULL,
  `demo_video_url` varchar(1000) DEFAULT NULL,
  `description` text,
  `guide` text,
  `level` varchar(30) NOT NULL,
  `muscle_group` varchar(120) NOT NULL,
  `name` varchar(120) NOT NULL,
  `type` enum('HEALTH','SKILL') NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKgvpun51lvspgohnxi34chfbq` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `content_workouts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `active` bit(1) NOT NULL,
  `code` varchar(30) NOT NULL,
  `content` text,
  `description` text,
  `level` varchar(30) NOT NULL,
  `name` varchar(120) NOT NULL,
  `type` varchar(40) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKdywoiv7g3xndwa431ebecps87` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `workout_exercises` (
  `workout_id` bigint NOT NULL,
  `exercise_id` bigint NOT NULL,
  `display_order` int NOT NULL,
  PRIMARY KEY (`workout_id`,`display_order`),
  KEY `FK4rj4ac48oflwcw4q7dyok14y4` (`exercise_id`),
  CONSTRAINT `FK4rj4ac48oflwcw4q7dyok14y4` FOREIGN KEY (`exercise_id`) REFERENCES `exercise_entries` (`id`),
  CONSTRAINT `FKbdw0rwvywtfqnl63irhvo0enb` FOREIGN KEY (`workout_id`) REFERENCES `content_workouts` (`id`),
  CONSTRAINT `workout_exercises_chk_1` CHECK ((`display_order` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `workout_plan_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `advanced_reps` int NOT NULL,
  `advanced_sets` int NOT NULL,
  `beginner_reps` int NOT NULL,
  `beginner_sets` int NOT NULL,
  `day_of_week` int NOT NULL,
  `intermediate_reps` int NOT NULL,
  `intermediate_sets` int NOT NULL,
  `exercise_id` bigint NOT NULL,
  `workout_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKgdxq7fv33qlg92w064nb5u2t` (`exercise_id`),
  KEY `FK66mqi0q885t6ffl1x5y282ig8` (`workout_id`),
  CONSTRAINT `FK66mqi0q885t6ffl1x5y282ig8` FOREIGN KEY (`workout_id`) REFERENCES `content_workouts` (`id`),
  CONSTRAINT `FKgdxq7fv33qlg92w064nb5u2t` FOREIGN KEY (`exercise_id`) REFERENCES `exercise_entries` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
