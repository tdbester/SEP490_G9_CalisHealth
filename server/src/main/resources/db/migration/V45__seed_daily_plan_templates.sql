-- V45: Du lieu mau cho Daily Training Plan Template.
--
-- Tao day du 21 ke hoach mau: 3 cap do (Beginner / Intermediate / Advanced) x 7 bien so buoi/tuan
-- (1 -> 7). Moi cap do chi giu MOT plan active cho moi so buoi/tuan, dung quy tac cua app.
--
-- Cac ke hoach seed cu (DP-SEED-*-M1/M2-*) da bi V44 bo "thang training" nen khong con
-- y nghia; o day chuyen chung sang inactive va doi ten thanh "... (legacy)" cho de nhin.
-- Ke hoach do nguoi dung tu tao (vi du "Workout day 1", "Lung Tung") chi bi chuyen sang
-- inactive, khong doi ten va khong xoa du lieu.

-- ============================================================
-- 1. Danh sach 21 ke hoach mau
-- ============================================================
DROP TEMPORARY TABLE IF EXISTS seed_plan_templates;
CREATE TEMPORARY TABLE seed_plan_templates (
    code           VARCHAR(30)  NOT NULL PRIMARY KEY,
    name           VARCHAR(120) NOT NULL,
    description    VARCHAR(300) NOT NULL,
    level          VARCHAR(30)  NOT NULL,
    days_per_week  INT          NOT NULL
) ENGINE=InnoDB;

INSERT INTO seed_plan_templates (code, name, description, level, days_per_week) VALUES
    ('DP-SEED-BEG-1D', 'Beginner - 1 day/week',
     'Starter plan for Beginner members who train once a week: one full body session to build the habit.',
     'Beginner', 1),
    ('DP-SEED-BEG-2D', 'Beginner - 2 days/week',
     'Push and pull split for Beginner members training twice a week.',
     'Beginner', 2),
    ('DP-SEED-BEG-3D', 'Beginner - 3 days/week',
     'Full body, legs and core rotation for Beginner members training three days a week.',
     'Beginner', 3),
    ('DP-SEED-BEG-4D', 'Beginner - 4 days/week',
     'Push, pull, legs and full body for Beginner members training four days a week.',
     'Beginner', 4),
    ('DP-SEED-BEG-5D', 'Beginner - 5 days/week',
     'Push, pull, legs, core balance and full body for Beginner members training five days a week.',
     'Beginner', 5),
    ('DP-SEED-BEG-6D', 'Beginner - 6 days/week',
     'Six day rotation adding skill progressions to the Beginner base routine.',
     'Beginner', 6),
    ('DP-SEED-BEG-7D', 'Beginner - 7 days/week',
     'Seven day Beginner rotation covering every muscle group with one recovery focused session.',
     'Beginner', 7),

    ('DP-SEED-INT-1D', 'Intermediate - 1 day/week',
     'Single upper body strength session for Intermediate members who train once a week.',
     'Intermediate', 1),
    ('DP-SEED-INT-2D', 'Intermediate - 2 days/week',
     'Strength and skill split for Intermediate members training twice a week.',
     'Intermediate', 2),
    ('DP-SEED-INT-3D', 'Intermediate - 3 days/week',
     'Upper body, skill practice and conditioning for Intermediate members training three days a week.',
     'Intermediate', 3),
    ('DP-SEED-INT-4D', 'Intermediate - 4 days/week',
     'Strength, skill, conditioning and core for Intermediate members training four days a week.',
     'Intermediate', 4),
    ('DP-SEED-INT-5D', 'Intermediate - 5 days/week',
     'Five day Intermediate rotation adding a dedicated upper body calisthenics session.',
     'Intermediate', 5),
    ('DP-SEED-INT-6D', 'Intermediate - 6 days/week',
     'Six day Intermediate rotation adding core and posture work.',
     'Intermediate', 6),
    ('DP-SEED-INT-7D', 'Intermediate - 7 days/week',
     'Seven day Intermediate rotation adding front lever foundations.',
     'Intermediate', 7),

    ('DP-SEED-ADV-1D', 'Advanced - 1 day/week',
     'One advanced full body strength session for members training once a week.',
     'Advanced', 1),
    ('DP-SEED-ADV-2D', 'Advanced - 2 days/week',
     'Strength and skill split for Advanced members training twice a week.',
     'Advanced', 2),
    ('DP-SEED-ADV-3D', 'Advanced - 3 days/week',
     'Strength, skill and power circuit for Advanced members training three days a week.',
     'Advanced', 3),
    ('DP-SEED-ADV-4D', 'Advanced - 4 days/week',
     'Strength, skill, power and a second heavy strength day for Advanced members training four days a week.',
     'Advanced', 4),
    ('DP-SEED-ADV-5D', 'Advanced - 5 days/week',
     'Five day Advanced rotation adding an extra power circuit.',
     'Advanced', 5),
    ('DP-SEED-ADV-6D', 'Advanced - 6 days/week',
     'Six day Advanced rotation adding an extra skill session.',
     'Advanced', 6),
    ('DP-SEED-ADV-7D', 'Advanced - 7 days/week',
     'Seven day Advanced rotation with strength, skill and power work on every training day.',
     'Advanced', 7);

-- ============================================================
-- 2. Ke hoach mau + buoi tap tuong ung
-- ============================================================
DROP TEMPORARY TABLE IF EXISTS seed_plan_days;
CREATE TEMPORARY TABLE seed_plan_days (
    template_code VARCHAR(30) NOT NULL,
    day_number    INT         NOT NULL,
    workout_code  VARCHAR(30) NOT NULL,
    PRIMARY KEY (template_code, day_number)
) ENGINE=InnoDB;

-- Beginner
INSERT INTO seed_plan_days (template_code, day_number, workout_code) VALUES
    ('DP-SEED-BEG-1D', 1, 'SYS_BEGINNER_FULL_BODY'),
    ('DP-SEED-BEG-2D', 1, 'SYS_BEG_PUSH'),
    ('DP-SEED-BEG-2D', 2, 'SYS_BEG_PULL'),
    ('DP-SEED-BEG-3D', 1, 'SYS_BEGINNER_FULL_BODY'),
    ('DP-SEED-BEG-3D', 2, 'WO-DEMO0002'),
    ('DP-SEED-BEG-3D', 3, 'SYS_BEG_LOWER'),
    ('DP-SEED-BEG-4D', 1, 'SYS_BEG_PUSH'),
    ('DP-SEED-BEG-4D', 2, 'SYS_BEG_PULL'),
    ('DP-SEED-BEG-4D', 3, 'SYS_BEG_LOWER'),
    ('DP-SEED-BEG-4D', 4, 'SYS_BEGINNER_FULL_BODY'),
    ('DP-SEED-BEG-5D', 1, 'SYS_BEG_PUSH'),
    ('DP-SEED-BEG-5D', 2, 'SYS_BEG_PULL'),
    ('DP-SEED-BEG-5D', 3, 'SYS_BEG_LOWER'),
    ('DP-SEED-BEG-5D', 4, 'WO-002'),
    ('DP-SEED-BEG-5D', 5, 'SYS_BEGINNER_FULL_BODY'),
    ('DP-SEED-BEG-6D', 1, 'SYS_BEG_PUSH'),
    ('DP-SEED-BEG-6D', 2, 'SYS_BEG_PULL'),
    ('DP-SEED-BEG-6D', 3, 'SYS_BEG_LOWER'),
    ('DP-SEED-BEG-6D', 4, 'WO-002'),
    ('DP-SEED-BEG-6D', 5, 'WO-005'),
    ('DP-SEED-BEG-6D', 6, 'SYS_BEGINNER_FULL_BODY'),
    ('DP-SEED-BEG-7D', 1, 'SYS_BEG_PUSH'),
    ('DP-SEED-BEG-7D', 2, 'SYS_BEG_PULL'),
    ('DP-SEED-BEG-7D', 3, 'SYS_BEG_LOWER'),
    ('DP-SEED-BEG-7D', 4, 'WO-002'),
    ('DP-SEED-BEG-7D', 5, 'WO-005'),
    ('DP-SEED-BEG-7D', 6, 'WO-003'),
    ('DP-SEED-BEG-7D', 7, 'SYS_BEGINNER_FULL_BODY');

-- Intermediate
INSERT INTO seed_plan_days (template_code, day_number, workout_code) VALUES
    ('DP-SEED-INT-1D', 1, 'SYS_INT_UPPER'),
    ('DP-SEED-INT-2D', 1, 'SYS_INT_UPPER'),
    ('DP-SEED-INT-2D', 2, 'SYS_INT_SKILLS'),
    ('DP-SEED-INT-3D', 1, 'SYS_INT_UPPER'),
    ('DP-SEED-INT-3D', 2, 'SYS_INT_SKILLS'),
    ('DP-SEED-INT-3D', 3, 'SYS_INT_CONDITIONING'),
    ('DP-SEED-INT-4D', 1, 'SYS_INT_UPPER'),
    ('DP-SEED-INT-4D', 2, 'SYS_INT_SKILLS'),
    ('DP-SEED-INT-4D', 3, 'SYS_INT_CONDITIONING'),
    ('DP-SEED-INT-4D', 4, 'SYS_CORE_15'),
    ('DP-SEED-INT-5D', 1, 'SYS_INT_UPPER'),
    ('DP-SEED-INT-5D', 2, 'SYS_INT_SKILLS'),
    ('DP-SEED-INT-5D', 3, 'SYS_INT_CONDITIONING'),
    ('DP-SEED-INT-5D', 4, 'SYS_CORE_15'),
    ('DP-SEED-INT-5D', 5, 'WO-001'),
    ('DP-SEED-INT-6D', 1, 'SYS_INT_UPPER'),
    ('DP-SEED-INT-6D', 2, 'SYS_INT_SKILLS'),
    ('DP-SEED-INT-6D', 3, 'SYS_INT_CONDITIONING'),
    ('DP-SEED-INT-6D', 4, 'SYS_CORE_15'),
    ('DP-SEED-INT-6D', 5, 'WO-001'),
    ('DP-SEED-INT-6D', 6, 'WO-004'),
    ('DP-SEED-INT-7D', 1, 'SYS_INT_UPPER'),
    ('DP-SEED-INT-7D', 2, 'SYS_INT_SKILLS'),
    ('DP-SEED-INT-7D', 3, 'SYS_INT_CONDITIONING'),
    ('DP-SEED-INT-7D', 4, 'SYS_CORE_15'),
    ('DP-SEED-INT-7D', 5, 'WO-001'),
    ('DP-SEED-INT-7D', 6, 'WO-004'),
    ('DP-SEED-INT-7D', 7, 'WO-006');

-- Advanced
INSERT INTO seed_plan_days (template_code, day_number, workout_code) VALUES
    ('DP-SEED-ADV-1D', 1, 'SYS_ADV_STRENGTH'),
    ('DP-SEED-ADV-2D', 1, 'SYS_ADV_STRENGTH'),
    ('DP-SEED-ADV-2D', 2, 'SYS_ADV_SKILLS'),
    ('DP-SEED-ADV-3D', 1, 'SYS_ADV_STRENGTH'),
    ('DP-SEED-ADV-3D', 2, 'SYS_ADV_SKILLS'),
    ('DP-SEED-ADV-3D', 3, 'SYS_ADV_POWER'),
    ('DP-SEED-ADV-4D', 1, 'SYS_ADV_STRENGTH'),
    ('DP-SEED-ADV-4D', 2, 'SYS_ADV_SKILLS'),
    ('DP-SEED-ADV-4D', 3, 'SYS_ADV_POWER'),
    ('DP-SEED-ADV-4D', 4, 'SYS_ADV_STRENGTH'),
    ('DP-SEED-ADV-5D', 1, 'SYS_ADV_STRENGTH'),
    ('DP-SEED-ADV-5D', 2, 'SYS_ADV_SKILLS'),
    ('DP-SEED-ADV-5D', 3, 'SYS_ADV_POWER'),
    ('DP-SEED-ADV-5D', 4, 'SYS_ADV_STRENGTH'),
    ('DP-SEED-ADV-5D', 5, 'SYS_ADV_POWER'),
    ('DP-SEED-ADV-6D', 1, 'SYS_ADV_STRENGTH'),
    ('DP-SEED-ADV-6D', 2, 'SYS_ADV_SKILLS'),
    ('DP-SEED-ADV-6D', 3, 'SYS_ADV_POWER'),
    ('DP-SEED-ADV-6D', 4, 'SYS_ADV_STRENGTH'),
    ('DP-SEED-ADV-6D', 5, 'SYS_ADV_POWER'),
    ('DP-SEED-ADV-6D', 6, 'SYS_ADV_SKILLS'),
    ('DP-SEED-ADV-7D', 1, 'SYS_ADV_STRENGTH'),
    ('DP-SEED-ADV-7D', 2, 'SYS_ADV_SKILLS'),
    ('DP-SEED-ADV-7D', 3, 'SYS_ADV_POWER'),
    ('DP-SEED-ADV-7D', 4, 'SYS_ADV_STRENGTH'),
    ('DP-SEED-ADV-7D', 5, 'SYS_ADV_POWER'),
    ('DP-SEED-ADV-7D', 6, 'SYS_ADV_SKILLS'),
    ('DP-SEED-ADV-7D', 7, 'SYS_ADV_POWER');

-- ============================================================
-- 3. Ke hoach seed cu: doi ten + chuyen sang inactive
--    Chi cac plan seed cu bi thay the boi 21 plan moi moi chuyen sang inactive.
--    Plan Elite (DP-SEED-ELITE-M1-3D) KHONG bi thay the -> giu nguyen active cho member Elite.
-- ============================================================
UPDATE daily_plan_templates
SET name = CONCAT(name, ' (legacy)'),
    active = 0,
    updated_at = CURRENT_TIMESTAMP(6)
WHERE code IN (
    'DP-SEED-BEG-M1-3D',
    'DP-SEED-BEG-M2-3D',
    'DP-SEED-BEG-M1-4D',
    'DP-SEED-ADV-M1-4D',
    'DP-SEED-ADV-M2-5D',
    'DP-SEED-INT-M1-4D',
    'DP-SEED-INT-M2-5D',
    'DP-SEED-INT-M1-3D-V0'
);

-- Ke hoach do nguoi dung tu tao: KHONG doi ten, KHONG xoa du lieu.
-- (Deactive cac plan trung voi plan mau o buoc 6, sau khi da insert 21 plan mau.)

-- ============================================================
-- 4. Chen 21 ke hoach mau (active)
-- ============================================================
INSERT INTO daily_plan_templates
    (code, name, description, level, days_per_week, active, created_by, updated_at)
SELECT p.code,
       p.name,
       p.description,
       p.level,
       p.days_per_week,
       TRUE,
       u.id,
       CURRENT_TIMESTAMP(6)
FROM seed_plan_templates p
LEFT JOIN users u ON u.email = 'contentmanager@calishealth.com'
WHERE NOT EXISTS (
    SELECT 1 FROM daily_plan_templates existing WHERE existing.code = p.code
);

-- ============================================================
-- 5. Chen buoi tap cho tung ke hoach mau
-- ============================================================
INSERT INTO daily_plan_template_days (template_id, day_number, workout_id)
SELECT t.id,
       d.day_number,
       w.id
FROM seed_plan_days d
JOIN daily_plan_templates t ON t.code = d.template_code
JOIN workout_entries w ON w.code = d.workout_code
WHERE w.active = TRUE
  AND UPPER(w.source) = 'SYSTEM'
  AND UPPER(w.type) <> 'DAILY_TRAINING_PLAN'
  AND UPPER(w.level) = UPPER(t.level)
  AND NOT EXISTS (
      SELECT 1 FROM daily_plan_template_days existing
      WHERE existing.template_id = t.id
        AND existing.day_number = d.day_number
  );

-- ============================================================
-- 6. Giu invariant: moi (level, so buoi/tuan) chi co 1 plan active
--    Plan mau (code DP-SEED-xxx-ND) duoc uu tien.
--    Ke hoach do nguoi dung tu tao trung nhom chi bi chuyen sang inactive,
--    KHONG doi ten, KHONG xoa du lieu.
-- ============================================================
UPDATE daily_plan_templates other
JOIN daily_plan_templates seeded
  ON seeded.code REGEXP '^DP-SEED-(BEG|INT|ADV)-[1-7]D$'
 AND seeded.active = TRUE
 AND seeded.level = other.level
 AND seeded.days_per_week = other.days_per_week
SET other.active = 0,
    other.updated_at = CURRENT_TIMESTAMP(6)
WHERE other.active = TRUE
  AND other.id <> seeded.id;

DROP TEMPORARY TABLE IF EXISTS seed_plan_days;
DROP TEMPORARY TABLE IF EXISTS seed_plan_templates;
