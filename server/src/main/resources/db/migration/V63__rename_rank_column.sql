-- `rank` là từ khoá của MySQL 8. Hibernate/JPA sinh SQL dạng
--   insert into member_weekly_scores (..., rank, ...) values (...)
-- mà không tự escape backtick -> MySQL báo lỗi cú pháp 1064.
-- Đổi tên cột sang `member_rank` để mọi câu SQL do Hibernate sinh đều hợp lệ.
-- Giữ nguyên dữ liệu đã seed ở V61/V62 (đổi tên cột không mất dữ liệu).
ALTER TABLE member_weekly_scores
    CHANGE COLUMN `rank` `member_rank` INT NULL;
