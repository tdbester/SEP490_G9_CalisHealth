-- V17: Separate "blocked by an admin" from "email not verified yet".
-- Until now users.enabled meant both, so login could not tell the two cases apart.
--   enabled = email verified (or created by an admin)
--   blocked = an admin deactivated the account
-- An account can sign in only when enabled = 1 AND blocked = 0.
-- Existing rows are unchanged (blocked defaults to 0).

ALTER TABLE users
    ADD COLUMN blocked BIT(1) NOT NULL DEFAULT 0 AFTER enabled;
