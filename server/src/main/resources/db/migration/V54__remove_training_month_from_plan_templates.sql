-- V44: Daily Training Plan Template khong con phan biet "thang training".
-- Keo hoa khuc "level + so buoi/tuan" vao mot plan duy nhat cho moi level.
--
-- 1. Xoa cot month_number va cac rang buoc/chi muc lien quan.
-- 2. Giu lai MOT plan active cho moi (level, days_per_week): uu tien plan cap nhat gan nhat,
--    cac plan active trung level+so buoi/tuan bi chuyen sang inactive (khong xoa du lieu).
-- 3. Xoa cac ten plan co chu "Month N" de ten khong con so thang.
-- 4. Tao tai khoan MEMBER mau de test khao sat onboarding lap lai nhieu lan.
ALTER TABLE daily_plan_templates
    DROP INDEX idx_daily_plan_templates_match,
    DROP CHECK ck_daily_plan_templates_month;

ALTER TABLE daily_plan_templates
    DROP COLUMN month_number;

-- Chi muc moi: khoa (level, days_per_week, active).
CREATE INDEX idx_daily_plan_templates_match
    ON daily_plan_templates (level, days_per_week, active);

-- Chuan hoa: moi (level, days_per_week) chi giu MOT plan active (plan cap nhat gan nhat).
UPDATE daily_plan_templates t
JOIN (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY level, days_per_week
                              ORDER BY updated_at DESC, id DESC) AS rn
    FROM daily_plan_templates
    WHERE active = 1
) ranked ON ranked.id = t.id
SET t.active = 0
WHERE t.active = 1
  AND ranked.rn > 1;

-- Do lai ten: bo "Month N" khoi ten plan (vi du "Beginner Month 1 - 3 days/week" -> "Beginner - 3 days/week").
UPDATE daily_plan_templates
SET name = TRIM(
        REGEXP_REPLACE(
            REGEXP_REPLACE(name, '[[:space:]]+Month[[:space:]]+[0-9]+', ''),
            '[[:space:]]*-[[:space:]]*-[[:space:]]*', ' - '))
WHERE REGEXP_LIKE(name, 'Month[[:space:]]+[0-9]+');

-- ============================================================
-- Tai khoan MEMBER mau de test khao sat onboarding lap lai nhieu lan.
-- Email    : survey.test@calishealth.com
-- Password : Test@123   (BCrypt, cost 10)
--
-- Tai khoan nay khong co phien khao sat nao, nen moi lan dang nhap deu vao duoc
-- buoc "Body information" va co the lam lai (Retake survey) bao gio cung duoc.
-- ============================================================
INSERT INTO users (email, password, full_name, role, enabled, created_at)
SELECT 'survey.test@calishealth.com',
       '$2a$10$RdWDAbR1skkfFOExLF6LluIxK2H7EuNOGvqPnASpDJUSznJxfn2Gq',
       'Survey Test Member',
       'MEMBER',
       TRUE,
       CURRENT_TIMESTAMP(6)
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM users existing WHERE existing.email = 'survey.test@calishealth.com'
);

-- Tai khoan da ton tai (vd. nguoi dung dang ky tay) -> chi bat role MEMBER + kich hoat,
-- KHONG ghi de mat khau nguoi dung da doi.
UPDATE users
SET role = 'MEMBER', enabled = TRUE
WHERE email = 'survey.test@calishealth.com';

-- Ho so member (de vong chinh cho profile + khoi tao ke hoach).
INSERT INTO member_profiles (user_id)
SELECT u.id
FROM users u
WHERE u.email = 'survey.test@calishealth.com'
  AND NOT EXISTS (SELECT 1 FROM member_profiles mp WHERE mp.user_id = u.id);
