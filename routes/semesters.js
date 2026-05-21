const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, verifyAdmin } = require("../controllers/middleware/auth");

// GET tất cả kỳ học
router.get("/", verifyToken, (req, res) => {
    db.query("SELECT * FROM semesters ORDER BY start_date DESC", (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

// POST tạo kỳ học mới
router.post("/", verifyToken, verifyAdmin, (req, res) => {
    const data = req.body;
    db.query("INSERT INTO semesters SET ?", data, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Tạo kỳ học thành công", id: result.insertId });
    });
});

// PUT cập nhật kỳ học
router.put("/:id", verifyToken, verifyAdmin, (req, res) => {
    const { id } = req.params;
    const data = req.body;
    db.query("UPDATE semesters SET ? WHERE id = ?", [data, id], (err, result) => {
        if (err) return res.status(500).json(err);
        if (result.affectedRows === 0) return res.status(404).json("Không tìm thấy kỳ học");
        res.json("Cập nhật kỳ học thành công");
    });
});

// DELETE xóa kỳ học
router.delete("/:id", verifyToken, verifyAdmin, (req, res) => {
    const { id } = req.params;
    db.query("DELETE FROM semesters WHERE id = ?", [id], (err, result) => {
        if (err) return res.status(500).json(err);
        if (result.affectedRows === 0) return res.status(404).json("Không tìm thấy kỳ học");
        res.json("Xóa kỳ học thành công");
    });
});

module.exports = router;
