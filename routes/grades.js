const express = require("express");
const router = express.Router();

const db = require("../db");
const { verifyToken } = require("../controllers/middleware/auth");

// GET
router.get("/", verifyToken, (req, res) => {
    const user = req.user;
    const studentId = req.query.studentId || user.student_id;

    if (user.role === "student") {
        // Student chỉ được xem điểm của chính mình
        return db.query(
            "SELECT * FROM scores WHERE student_id = ?",
            [user.student_id],
            (err, result) => {
                if (err) return res.status(500).json(err);
                res.json(result);
            }
        );
    }

    // Admin/teacher lọc theo studentId query param
    if (studentId) {
        db.query(
            "SELECT * FROM scores WHERE student_id = ?",
            [studentId],
            (err, result) => {
                if (err) return res.status(500).json(err);
                res.json(result);
            }
        );
    } else {
        db.query("SELECT * FROM scores", (err, result) => {
            if (err) return res.status(500).json(err);
            res.json(result);
        });
    }
});

// POST - Thêm điểm mới
router.post("/", verifyToken, (req, res) => {
    const user = req.user;

    if (user.role === "student") {
        return res.status(403).json("Sinh viên không được phép thêm điểm");
    }

    const data = req.body;

    db.query("INSERT INTO scores SET ?", data, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Thêm điểm thành công", id: result.insertId });
    });
});

// PUT - Sửa điểm
router.put("/:id", verifyToken, (req, res) => {
    const user = req.user;

    if (user.role === "student") {
        return res.status(403).json("Sinh viên không được phép sửa điểm");
    }

    const { id } = req.params;
    const data = req.body;

    db.query("UPDATE scores SET ? WHERE id = ?", [data, id], (err, result) => {
        if (err) return res.status(500).json(err);
        if (result.affectedRows === 0) return res.status(404).json("Không tìm thấy điểm");
        res.json({ message: "Cập nhật điểm thành công" });
    });
});

// DELETE - Xóa điểm (chỉ admin)
router.delete("/:id", verifyToken, (req, res) => {
    const user = req.user;

    if (user.role !== "admin") {
        return res.status(403).json("Chỉ admin được xóa điểm");
    }

    const { id } = req.params;

    db.query("DELETE FROM scores WHERE id = ?", [id], (err, result) => {
        if (err) return res.status(500).json(err);
        if (result.affectedRows === 0) return res.status(404).json("Không tìm thấy điểm");
        res.json({ message: "Xóa điểm thành công" });
    });
});

module.exports = router;
