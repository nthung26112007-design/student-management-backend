const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, verifyAdmin } = require("../controllers/middleware/auth");

// GET tất cả kỳ học
router.get("/", verifyToken, (req, res) => {
    const { class_name } = req.query;
    let query = "SELECT * FROM semesters";
    const params = [];
    if (class_name) {
        query += " WHERE class_name = ?";
        params.push(class_name);
    }
    query += " ORDER BY start_date DESC";
    db.query(query, params, (err, result) => {
        if (err) {
            console.error('[GET /semesters] Query error:', err);
            return res.status(500).json({ message: "Lỗi truy vấn", error: err.message, code: err.code });
        }
        res.json(result);
    });
});

// POST tạo kỳ học mới
router.post("/", verifyToken, verifyAdmin, (req, res) => {
    const data = req.body;
    console.log('[POST /semesters] Payload:', JSON.stringify(data));

    if (!data.name || !data.start_date || !data.end_date) {
        return res.status(400).json({ message: "Thiếu thông tin bắt buộc: name, start_date, end_date" });
    }

    // Kiểm tra trùng tên + lớp
    db.query("SELECT id FROM semesters WHERE name = ? AND class_name = ?", [data.name, data.class_name], (err, existing) => {
        if (err) return res.status(500).json({ message: "Lỗi kiểm tra", detail: err.message });
        if (existing.length > 0) {
            return res.status(400).json({ message: "Học kỳ đã tồn tại cho lớp này!" });
        }

        const row = {
            name: data.name,
            start_date: data.start_date,
            end_date: data.end_date,
        };
        if (data.status) row.status = data.status;
        if (data.description) row.description = data.description;
        if (data.class_name) row.class_name = data.class_name;

        db.query("INSERT INTO semesters SET ?", row, (err, result) => {
            if (err) {
                console.error('[POST /semesters] INSERT error:', err);
                return res.status(500).json({ message: "Lỗi INSERT", detail: err.message, code: err.code });
            }
            res.json({ message: "Tạo kỳ học thành công", id: result.insertId });
        });
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
