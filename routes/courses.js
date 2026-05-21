const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, verifyAdmin } = require("../controllers/middleware/auth");

// GET môn học (có thể lọc theo semester_id)
router.get("/", verifyToken, (req, res) => {
    const { semester_id } = req.query;
    if (semester_id) {
        db.query(
            `SELECT c.*, s.name as semester_name, u.username as teacher_name
             FROM courses c
             LEFT JOIN semesters s ON c.semester_id = s.id
             LEFT JOIN users u ON c.teacher_id = u.id
             WHERE c.semester_id = ?
             ORDER BY c.id DESC`,
            [semester_id],
            (err, result) => {
                if (err) return res.status(500).json(err);
                res.json(result);
            }
        );
    } else {
        db.query(
            `SELECT c.*, s.name as semester_name, u.username as teacher_name
             FROM courses c
             LEFT JOIN semesters s ON c.semester_id = s.id
             LEFT JOIN users u ON c.teacher_id = u.id
             ORDER BY c.id DESC`,
            (err, result) => {
                if (err) return res.status(500).json(err);
                res.json(result);
            }
        );
    }
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
