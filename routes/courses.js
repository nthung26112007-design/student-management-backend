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
            SELECT c.*, s.name as semester_name, u.username as teacher_name
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

        db.query(query, params, (err, result) => {
            if (err) return res.status(500).json(err);
            res.json(result);
        });
    };

    // Sinh viên chỉ được xem môn học của lớp mình
    if (user.role === "student" && !class_name) {
        return db.query(
            "SELECT class_name FROM students WHERE id = ?",
            [user.student_id],
            (err, rows) => {
                if (err) return res.status(500).json(err);
                const studentClassName = rows?.[0]?.class_name;
                buildAndReturnCourses(studentClassName);
            }
        );
    }

    buildAndReturnCourses();
});

// POST tạo môn học mới
router.post("/", verifyToken, verifyAdmin, (req, res) => {
    const data = req.body;
    db.query("INSERT INTO courses SET ?", data, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Tạo môn học thành công", id: result.insertId });
    });
});

// PUT cập nhật môn học
router.put("/:id", verifyToken, verifyAdmin, (req, res) => {
    const { id } = req.params;
    const data = req.body;
    db.query("UPDATE courses SET ? WHERE id = ?", [data, id], (err, result) => {
        if (err) return res.status(500).json(err);
        if (result.affectedRows === 0) return res.status(404).json("Không tìm thấy môn học");
        res.json("Cập nhật môn học thành công");
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
