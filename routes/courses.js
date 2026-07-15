const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, verifyAdmin } = require("../controllers/middleware/auth");

// GET môn học (tự động lọc theo lớp của sinh viên nếu là student)
router.get("/", verifyToken, (req, res) => {
    const { semester_id, class_name } = req.query;
    const user = req.user;

    const buildAndReturnCourses = (resolvedClassName = null) => {
        let query = `
            SELECT c.id, c.subject_name as name, c.code, c.class_name, c.semester_id, c.teacher_id, c.credits, c.status,
                   c.theory_hours, c.practice_hours, c.course_type, c.exam_form,
                   s.name as semester_name, u.username as teacher_name
            FROM courses c
            LEFT JOIN semesters s ON c.semester_id = s.id
            LEFT JOIN users u ON c.teacher_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (semester_id) {
            query += " AND c.semester_id = ?";
            params.push(semester_id);
        }

        const finalClassName = class_name || resolvedClassName;
        if (finalClassName) {
            query += " AND LOWER(TRIM(c.class_name)) = LOWER(TRIM(?))";
            params.push(finalClassName);
        }

        query += " ORDER BY c.id DESC";

        console.log('[GET /courses] Query:', query, 'Params:', params);

        db.query(query, params, (err, result) => {
            if (err) {
                console.error('[GET /courses] Query error:', err);
                return res.status(500).json({ message: "Lỗi truy vấn", error: err.message, code: err.code });
            }
            res.json(result);
        });
    };

    // Sinh viên chỉ được xem môn học của lớp mình
    if (user.role === "student" && !class_name) {
        return db.query(
            "SELECT class_name FROM students WHERE id = ?",
            [user.student_id],
            (err, rows) => {
                if (err) {
                    console.error('[GET /courses] Student lookup error:', err);
                    return res.status(500).json({ message: "Lỗi truy vấn", error: err.message, code: err.code });
                }
                const studentClassName = rows?.[0]?.class_name;
                console.log('[GET /courses] Student class_name:', studentClassName);
                buildAndReturnCourses(studentClassName);
            }
        );
    }

    buildAndReturnCourses();
});

// POST tạo môn học mới
router.post("/", verifyToken, verifyAdmin, (req, res) => {
    const data = req.body;
    console.log('[POST /courses] Payload:', JSON.stringify(data));

    if (!data.semester_id) {
        return res.status(400).json({ message: "Thiếu semester_id" });
    }
    const subjectCode = (data.subject_code || data.code || '').toString().trim();
    const subjectName = (data.subject_name || data.name || '').toString().trim();
    if (!subjectCode && !subjectName) {
        return res.status(400).json({ message: "Thiếu thông tin môn học" });
    }

    db.query("SELECT id FROM semesters WHERE id = ?", [data.semester_id], (err, semesterRows) => {
        if (err) {
            console.error('[POST /courses] Semester check error:', err);
            return res.status(500).json({ message: "Lỗi kiểm tra học kỳ", detail: err.message });
        }
        if (semesterRows.length === 0) {
            return res.status(400).json({ message: "Học kỳ không tồn tại. Vui lòng tải lại trang và thử lại." });
        }

        const row = {
            semester_id: data.semester_id,
            subject_name: subjectName || null,
            code: subjectCode || null,
        };
        if (data.teacher_id) row.teacher_id = data.teacher_id;
        if (data.class_name) row.class_name = data.class_name;
        if (data.credits != null) row.credits = data.credits;
        if (data.status) row.status = data.status;
        if (data.theory_hours != null) row.theory_hours = data.theory_hours;
        if (data.practice_hours != null) row.practice_hours = data.practice_hours;
        if (data.course_type) row.course_type = data.course_type;
        if (data.exam_form) row.exam_form = data.exam_form;

        db.query("INSERT INTO courses SET ?", row, (err, result) => {
            if (err) {
                console.error('[POST /courses] INSERT error:', err);
                return res.status(500).json({ message: "Lỗi INSERT", detail: err.message });
            }
            console.log('[POST /courses] Inserted id:', result.insertId);
            res.json({ message: "Tạo môn học thành công", id: result.insertId });
        });
    });
});

router.put("/:id", verifyToken, verifyAdmin, (req, res) => {
    const { id } = req.params;
    const data = req.body;

    const row = {};
    if (data.subject_code || data.code) row.code = data.subject_code || data.code;
    if (data.subject_name || data.name) row.subject_name = data.subject_name || data.name;
    if (data.teacher_id) row.teacher_id = data.teacher_id;
    if (data.class_name) row.class_name = data.class_name;
    if (data.credits != null) row.credits = data.credits;
    if (data.status) row.status = data.status;
    if (data.theory_hours != null) row.theory_hours = data.theory_hours;
    if (data.practice_hours != null) row.practice_hours = data.practice_hours;
    if (data.course_type) row.course_type = data.course_type;
    if (data.exam_form) row.exam_form = data.exam_form;

    if (Object.keys(row).length === 0) {
        return res.status(400).json({ message: "Không có dữ liệu cập nhật" });
    }

    db.query("UPDATE courses SET ? WHERE id = ?", [row, id], (err, result) => {
        if (err) {
            console.error('[PUT /courses] UPDATE error:', err);
            return res.status(500).json({ message: "Lỗi UPDATE", detail: err.message });
        }
        if (result.affectedRows === 0) return res.status(404).json({ message: "Không tìm thấy môn học" });
        res.json({ message: "Cập nhật môn học thành công" });
    });
});

// DELETE xóa môn học
router.delete("/:id", verifyToken, verifyAdmin, (req, res) => {
    const { id } = req.params;
    db.query("DELETE FROM courses WHERE id = ?", [id], (err, result) => {
        if (err) return res.status(500).json(err);
        if (result.affectedRows === 0) return res.status(404).json("Không tìm thấy môn học");
        res.json("Xóa môn học thành công");
    });
});

module.exports = router;
