-- =====================================================
-- Script tạo các bảng học phí (tuition) còn thiếu
-- Chạy trên MySQL (Render MySQL)
-- =====================================================

-- Thêm cột code vào bảng courses nếu chưa có
ALTER TABLE courses ADD COLUMN IF NOT EXISTS code VARCHAR(50);

-- Tạo bảng tuition_invoices
CREATE TABLE IF NOT EXISTS tuition_invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    amount DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'unpaid',
    due_date DATE,
    note TEXT,
    invoice_code VARCHAR(100),
    title VARCHAR(255),
    class_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_student_id (student_id),
    INDEX idx_status (status),
    INDEX idx_class_name (class_name)
);

-- Tạo bảng tuition_payments
CREATE TABLE IF NOT EXISTS tuition_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT,
    student_id INT,
    amount DECIMAL(10, 2) DEFAULT 0,
    payment_date DATE,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_invoice_id (invoice_id),
    INDEX idx_student_id (student_id)
);

-- Nếu bảng students chưa có cột class_name, thêm vào
-- ALTER TABLE students ADD COLUMN IF NOT EXISTS class_name VARCHAR(100);

-- Nếu bảng students chưa có class_name, chạy dòng dưới:
-- ALTER TABLE students ADD COLUMN class_name VARCHAR(100);

-- Nếu bảng courses chưa có class_name, chạy dòng dưới:
-- ALTER TABLE courses ADD COLUMN class_name VARCHAR(100);

SELECT 'Tables created successfully!' AS status;
