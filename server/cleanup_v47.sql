-- Delete V47 from Flyway history to allow re-running
DELETE FROM flyway_schema_history WHERE version = 47;

-- Verify deletion
SELECT * FROM flyway_schema_history WHERE version = 47;
