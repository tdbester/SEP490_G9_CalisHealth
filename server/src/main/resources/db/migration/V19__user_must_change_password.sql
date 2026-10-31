ALTER TABLE users
    ADD COLUMN must_change_password BIT(1) NOT NULL DEFAULT 0 AFTER blocked;
