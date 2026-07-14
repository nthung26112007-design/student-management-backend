-- =============================================================
-- STUDENT MANAGEMENT - MIGRATION KHẮC PHỤC ĐỒNG BỘ DỮ LIỆU
-- Chạy MỘT LẦN trên đúng database MySQL trước khi chạy bản mã mới.
-- Script không chèn dữ liệu sinh viên/môn học mẫu.
-- =============================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  course_year VARCHAR(30) NULL,
  faculty VARCHAR(150) NULL,
  description TEXT NULL,
  student_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_classes_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_title VARCHAR(255) NOT NULL,
  session_date DATE NOT NULL,
  class_name VARCHAR(100) NOT NULL,
  course_id INT NULL,
  note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_attendance_session_date (session_date),
  INDEX idx_attendance_session_class (class_name),
  INDEX idx_attendance_session_course (course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attendance_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  student_id INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'unmarked',
  note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_attendance_record_session (session_id),
  INDEX idx_attendance_record_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tuition_invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'unpaid',
  due_date DATE NULL,
  note TEXT NULL,
  invoice_code VARCHAR(100) NULL,
  title VARCHAR(255) NULL,
  class_name VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_invoice_student (student_id),
  INDEX idx_invoice_status (status),
  INDEX idx_invoice_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tuition_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  student_id INT NOT NULL,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL,
  note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payment_invoice (invoice_id),
  INDEX idx_payment_student (student_id),
  INDEX idx_payment_date (payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(20) NOT NULL DEFAULT 'study',
  title VARCHAR(255) NOT NULL,
  class_name VARCHAR(100) NOT NULL,
  subject_name VARCHAR(255) NULL,
  schedule_date DATE NOT NULL,
  schedule_time VARCHAR(30) NOT NULL,
  room VARCHAR(100) NULL,
  note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_schedule_date (schedule_date),
  INDEX idx_schedule_class (class_name),
  INDEX idx_schedule_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Thêm cột chỉ khi chưa có. Dùng procedure để chạy được trên nhiều bản MySQL.
DROP PROCEDURE IF EXISTS add_column_if_missing;
DELIMITER $$
CREATE PROCEDURE add_column_if_missing(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_definition VARCHAR(500)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND COLUMN_NAME = p_column
  ) THEN
    SET @sql_text = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition);
    PREPARE stmt FROM @sql_text;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CALL add_column_if_missing('courses', 'code', 'VARCHAR(50) NULL');
CALL add_column_if_missing('courses', 'class_name', 'VARCHAR(100) NULL');
CALL add_column_if_missing('courses', 'credits', 'INT DEFAULT 0');
CALL add_column_if_missing('semesters', 'class_name', 'VARCHAR(100) NULL');
CALL add_column_if_missing('semesters', 'status', 'VARCHAR(30) DEFAULT ''active''');
CALL add_column_if_missing('students', 'class_name', 'VARCHAR(100) NULL');
CALL add_column_if_missing('students', 'academic_status', 'VARCHAR(50) DEFAULT ''Đang học''');
CALL add_column_if_missing('students', 'avatar_url', 'LONGTEXT NULL');
CALL add_column_if_missing('scores', 'course_id', 'INT NULL');
CALL add_column_if_missing('scores', 'semester_id', 'INT NULL');
CALL add_column_if_missing('scores', 'cc_score', 'DECIMAL(5,2) NULL');
CALL add_column_if_missing('scores', 'qkt_score', 'DECIMAL(5,2) NULL');
CALL add_column_if_missing('scores', 'ckt_score', 'DECIMAL(5,2) NULL');
CALL add_column_if_missing('scores', 'total_score', 'DECIMAL(5,2) NULL');
CALL add_column_if_missing('scores', 'grade', 'VARCHAR(5) NULL');
CALL add_column_if_missing('scores', 'status', 'VARCHAR(20) NULL');
CALL add_column_if_missing('scores', 'note', 'TEXT NULL');
DROP PROCEDURE IF EXISTS add_column_if_missing;

-- Xóa bản ghi trùng do các lần "đồng bộ" cũ chèn lặp.
DELETE old_record
FROM attendance_records old_record
JOIN attendance_records newer_record
  ON newer_record.session_id = old_record.session_id
 AND newer_record.student_id = old_record.student_id
 AND newer_record.id > old_record.id;

DELETE old_score
FROM scores old_score
JOIN scores newer_score
  ON newer_score.student_id = old_score.student_id
 AND newer_score.course_id <=> old_score.course_id
 AND newer_score.semester_id <=> old_score.semester_id
 AND newer_score.id > old_score.id;

-- Tạo index duy nhất nếu chưa có để ngăn dữ liệu lặp quay trở lại.
DROP PROCEDURE IF EXISTS add_index_if_missing;
DELIMITER $$
CREATE PROCEDURE add_index_if_missing(
  IN p_table VARCHAR(64),
  IN p_index VARCHAR(64),
  IN p_columns VARCHAR(500)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND INDEX_NAME = p_index
  ) THEN
    SET @sql_text = CONCAT('ALTER TABLE `', p_table, '` ADD UNIQUE INDEX `', p_index, '` (', p_columns, ')');
    PREPARE stmt FROM @sql_text;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CALL add_index_if_missing('attendance_records', 'uq_attendance_session_student', '`session_id`,`student_id`');
CALL add_index_if_missing('scores', 'uq_score_student_course_semester', '`student_id`,`course_id`,`semester_id`');
DROP PROCEDURE IF EXISTS add_index_if_missing;

-- Đồng bộ danh mục lớp từ dữ liệu sinh viên hiện có, không tạo lớp giả.
INSERT INTO classes (name)
SELECT DISTINCT TRIM(class_name)
FROM students
WHERE class_name IS NOT NULL AND TRIM(class_name) <> ''
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Cập nhật số lượng chỉ để tương thích các báo cáo cũ; API mới tính trực tiếp.
UPDATE classes c
LEFT JOIN (
  SELECT TRIM(class_name) class_name, COUNT(*) student_count
  FROM students
  WHERE class_name IS NOT NULL AND TRIM(class_name) <> ''
  GROUP BY TRIM(class_name)
) s ON LOWER(TRIM(s.class_name)) = LOWER(TRIM(c.name))
SET c.student_count = COALESCE(s.student_count, 0);

SELECT 'Đã hoàn tất migration đồng bộ dữ liệu' AS result;
