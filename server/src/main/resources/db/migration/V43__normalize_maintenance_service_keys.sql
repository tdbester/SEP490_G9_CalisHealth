UPDATE maintenance_schedule_areas
SET area = 'MEMBER_APP_ACCESS'
WHERE area = 'MEMBER_APP';

UPDATE maintenance_schedule_areas
SET area = 'AI_POSE_ASSESSMENT'
WHERE area = 'AI_CAMERA_TRAINING';

UPDATE maintenance_schedule_areas
SET area = 'MEMBER_VIDEO_UPLOADS'
WHERE area = 'UPLOADS';

UPDATE maintenance_schedule_areas
SET area = 'ADMIN_MANAGEMENT_PORTAL'
WHERE area = 'ADMIN_AREA';
