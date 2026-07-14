-- =============================================
-- Bảng quản lý Lớp học (classes)
-- =============================================

CREATE TABLE IF NOT EXISTS classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE COMMENT 'Tên lớp: CNTT01, CK-K46A, ...',
    course_year VARCHAR(20) COMMENT 'Khóa: 2023, K46, ...',
    faculty VARCHAR(100) COMMENT 'Khoa: CNTT, Kinh tế, ...',
    description TEXT COMMENT 'Mô tả lớp',
    student_count INT DEFAULT 0 COMMENT 'Số sinh viên',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Index cho tìm kiếm
CREATE INDEX idx_classes_name ON classes(name);
CREATE INDEX idx_classes_year ON classes(course_year);
CREATE INDEX idx_classes_faculty ON classes(faculty);

-- =============================================
-- Seed data mẫu
-- =============================================

INSERT INTO classes (name, course_year, faculty, description, student_count) VALUES
('CNTT01', 'K47', 'Công nghệ thông tin', 'Lớp CNTT K47A', 40),
('CNTT02', 'K47', 'Công nghệ thông tin', 'Lớp CNTT K47B', 38),
('ATTT01', 'K47', 'An toàn thông tin', 'Lớp ATTT K47A', 35),
('KTPM01', 'K47', 'Kỹ thuật phần mềm', 'Lớp KTPM K47A', 36),
('CNTT03', 'K46', 'Công nghệ thông tin', 'Lớp CNTT K46A', 42),
('CNTT04', 'K46', 'Công nghệ thông tin', 'Lớp CNTT K46B', 40),
('ATTT02', 'K46', 'An toàn thông tin', 'Lớp ATTT K46A', 33),
('KTPM02', 'K46', 'Kỹ thuật phần mềm', 'Lớp KTPM K46A', 37);
