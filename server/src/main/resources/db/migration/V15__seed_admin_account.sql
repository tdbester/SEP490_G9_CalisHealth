-- V15: Seed a shared ADMIN account so every team member can test the admin area.
-- Email    : admin@calishealth.com
-- Password : Test@123   (BCrypt, cost 10)
-- Never edit this file after it has been applied; add a new version instead.

INSERT INTO users (email, password, full_name, role, enabled, created_at)
SELECT 'admin@calishealth.com',
       '$2a$10$RdWDAbR1skkfFOExLF6LluIxK2H7EuNOGvqPnASpDJUSznJxfn2Gq',
       'Admin',
       'ADMIN',
       TRUE,
       CURRENT_TIMESTAMP(6)
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM users existing WHERE existing.email = 'admin@calishealth.com'
);

-- If the account already exists (e.g. registered by hand), only grant the role and
-- enable it. The password the user already set is NOT overwritten.
UPDATE users SET role = 'ADMIN', enabled = TRUE
WHERE email = 'admin@calishealth.com';
