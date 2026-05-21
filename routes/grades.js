const express = require("express");
const router = express.Router();

const db = require("../db");
const { verifyToken } = require("../controllers/middleware/auth");
const { sendNotification } = require("../notification");

// GET
router.get("/", verifyToken, (req, res) => {
    const user = req.user;

    if (user.role === "student") {
        return db.query(
            "SELECT * FROM scores WHERE student_id = ?",
            [user.student_id],
            (err, result) => {
                if (err) return res.status(500).json(err);
                res.json(result);
            }
        );
    }

    const studentId = req.query.studentId;
    const semesterId = req.query.semesterId;

    let query = "SELECT * FROM scores WHERE 1=1";
    const params = [];

    if (studentId) {
        query += " AND student_id = ?";
        params.push(studentId);
    }
    if (semesterId) {
        query += " AND semester_id = ?";
        params.push(semesterId);
    }

    db.query(query, params, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
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

        // Gửi notification cho student
        db.query(
            "SELECT u.fcm_token, s.full_name FROM users u JOIN students s ON u.student_id = s.id WHERE u.student_id = ?",
            [data.student_id],
            (err2, rows) => {
                if (!err2 && rows.length > 0 && rows[0].fcm_token) {
                    sendNotification(
                        rows[0].fcm_token,
                        "Điểm mới",
                        `Môn ${data.subject_name} đã được nhập điểm`
                    );
                }
            }
        );

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

        // Gửi notification cho student
        db.query(
            "SELECT u.fcm_token FROM users u WHERE u.student_id = ?",
            [data.student_id],
            (err2, rows) => {
                if (!err2 && rows.length > 0 && rows[0].fcm_token) {
                    sendNotification(
                        rows[0].fcm_token,
                        "Điểm đã cập nhật",
                        `Môn ${data.subject_name} đã được cập nhật điểm`
                    );
                }
            }
        );

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
