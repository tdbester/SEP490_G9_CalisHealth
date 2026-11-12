-- V64: Bỏ trạng thái DRAFT khỏi module Admin Notification.
--
-- Mục đích
-- ------
-- Admin Notification không còn vòng đời "nháp" (draft): mọi thông báo do
-- Admin tạo đều phát hành ngay (PUBLISHED). Vì vậy:
--   1. Các thông báo còn sót trạng thái DRAFT trong DB được phát hành lại.
--   2. Default của cột `status` đổi từ DRAFT sang PUBLISHED để các
--      INSERT không chỉ định status (ví dụ seed data) cũng ra PUBLISHED.
--
-- Lưu ý
-- -----
-- File này là migration MỚI (version 64) nên chưa từng được apply ở bất kỳ
-- môi trường nào -> không phát sinh checksum mismatch cho DB đã có dữ liệu.

UPDATE notifications
SET status = 'PUBLISHED'
WHERE status = 'DRAFT';

ALTER TABLE notifications
    MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'PUBLISHED';
