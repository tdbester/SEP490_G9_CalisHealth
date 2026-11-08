-- V60: Add missing days_per_week column to member_profiles table
-- This column was defined in the MemberProfile entity but not created by previous migrations.
ALTER TABLE member_profiles
    ADD COLUMN days_per_week INT NOT NULL DEFAULT 3;
