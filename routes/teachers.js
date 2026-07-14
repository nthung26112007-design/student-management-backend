const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcrypt");

// GET all teachers
router.get("/", (req, res) => {
    let query = "SELECT * FROM teachers";
    let params = [];

    if (req.query.teacherCode) {
        query += " WHERE teacher_code = ?";
        params.push(req.query.teacherCode);
    }

    db.query(query, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// POST add a new teacher
router.post("/", (req, res) => {
    const { teacher_code, full_name, email, phone, department, status } = req.body;
    if (!teacher_code || !full_name) {
        return res.status(400).json({ error: "teacher_code and full_name are required" });
    }

    const sqlTeacher = `INSERT INTO teachers (teacher_code, full_name, email, phone, department, status) 
                        VALUES (?, ?, ?, ?, ?, ?)`;
    const st = status || 'active';

    db.query(sqlTeacher, [teacher_code, full_name, email, phone, department, st], (err, result) => {
        if (err) return res.status(500).json({ error: "Failed to create teacher: " + err.message });

        bcrypt.hash(teacher_code, 10, (hashErr, hash) => {
            if (hashErr) {
                return res.status(201).json({ 
                    message: "Teacher added successfully, but failed to create login account", 
                    id: result.insertId 
                });
            }

            const sqlUser = `INSERT INTO users (username, password, role) VALUES (?, ?, 'teacher')`;
            db.query(sqlUser, [teacher_code, hash], (userErr) => {
                if (userErr) {
                    return res.status(201).json({ 
                        message: "Teacher added successfully, but login account already exists or failed", 
                        id: result.insertId 
                    });
                }
                res.status(201).json({ 
                    message: "Teacher and login account created successfully", 
                    id: result.insertId 
                });
            });
        });
    });
});

// PUT update a teacher
router.put("/:id", (req, res) => {
    const { teacher_code, full_name, email, phone, department, status } = req.body;
    
    db.query("SELECT teacher_code FROM teachers WHERE id = ?", [req.params.id], (selErr, selRes) => {
        if (selErr || selRes.length === 0) return res.status(404).json({ error: "Teacher not found" });
        
        const oldCode = selRes[0].teacher_code;

        const sql = `UPDATE teachers SET teacher_code = ?, full_name = ?, email = ?, phone = ?, department = ?, status = ? WHERE id = ?`;
        db.query(sql, [teacher_code, full_name, email, phone, department, status, req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            if (oldCode !== teacher_code) {
                db.query("UPDATE users SET username = ? WHERE username = ?", [teacher_code, oldCode], (updErr) => {
                    res.json({ message: "Teacher updated successfully" });
                });
            } else {
                res.json({ message: "Teacher updated successfully" });
            }
        });
    });
});

// DELETE a teacher
router.delete("/:id", (req, res) => {
    db.query("SELECT teacher_code FROM teachers WHERE id = ?", [req.params.id], (selErr, selRes) => {
        if (selErr) return res.status(500).json({ error: selErr.message });
        if (selRes.length === 0) return res.status(404).json({ error: "Teacher not found" });
        
        const teacherCode = selRes[0].teacher_code;

        db.query("DELETE FROM teachers WHERE id = ?", [req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            
            db.query("DELETE FROM users WHERE username = ?", [teacherCode], (delErr) => {
                res.json({ message: "Teacher and associated account deleted" });
            });
        });
    });
});

module.exports = router;
