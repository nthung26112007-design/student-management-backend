const express = require("express");
const router = express.Router();

const db = require("../db");
const { verifyToken, verifyAdmin } = require("../controllers/middleware/auth");
const bcrypt = require("bcrypt");

// GET
router.get("/", verifyToken, (req, res) => {
    const user = req.user;

    if (user.role === "student") {
        db.query(
            "SELECT * FROM students WHERE id = ?",
            [user.student_id],
            (err, result) => {
                if (err) return res.status(500).json(err);
                res.json(result[0]);
            }
        );
    } else {
        db.query("SELECT * FROM students", (err, result) => {
            if (err) return res.status(500).json(err);
            res.json(result);
        });
    }
});

// ADD
router.post("/", verifyToken, verifyAdmin, async (req, res) => {
    const data = req.body;

    db.query("INSERT INTO students SET ?", data, async (err, result) => {
        if (err) return res.status(500).json(err);

        const studentId = result.insertId;
        const hash = await bcrypt.hash(data.student_code, 10);

        db.query(
            "INSERT INTO users (username, password, role, student_id) VALUES (?, ?, ?, ?)",
            [data.student_code, hash, "student", studentId],
            (err2) => {
                if (err2) return res.status(500).json(err2);
                res.json("Student + user created");
            }
        );
    });
});

// UPDATE
router.put("/:id", verifyToken, verifyAdmin, (req, res) => {
    const { id } = req.params;
    const data = req.body;

    db.query("UPDATE students SET ? WHERE id = ?", [data, id], (err, result) => {
        if (err) return res.status(500).json(err);
        if (result.affectedRows === 0) return res.status(404).json("Không tìm thấy sinh viên");

        // Nếu có thay đổi student_code thì cập nhật username trong users
        if (data.student_code) {
            db.query(
                "UPDATE users SET username = ? WHERE student_id = ?",
                [data.student_code, id],
                (err2) => {
                    if (err2) return res.status(500).json(err2);
                    res.json("Cập nhật sinh viên thành công");
                }
            );
        } else {
            res.json("Cập nhật sinh viên thành công");
        }
    });
});

// DELETE
router.delete("/:id", verifyToken, verifyAdmin, (req, res) => {
    const { id } = req.params;

    // Xóa điểm trước
    db.query("DELETE FROM scores WHERE student_id = ?", [id], (err) => {
        if (err) return res.status(500).json(err);

        // Xóa tài khoản
        db.query("DELETE FROM users WHERE student_id = ?", [id], (err2) => {
            if (err2) return res.status(500).json(err2);

            // Xóa sinh viên
            db.query("DELETE FROM students WHERE id = ?", [id], (err3, result) => {
                if (err3) return res.status(500).json(err3);
                if (result.affectedRows === 0) return res.status(404).json("Không tìm thấy sinh viên");
                res.json("Xóa sinh viên thành công");
            });
        });
    });
});

module.exports = router;
