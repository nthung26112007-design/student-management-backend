const express = require("express");
const router = express.Router();

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");

// LOGIN
router.post("/login", (req, res) => {
    const { username, password } = req.body;

    db.query(
        `SELECT u.*, s.full_name, s.student_code, s.class_name, s.gender, s.birth_date, s.email, s.phone, s.academic_status
         FROM users u
         LEFT JOIN students s ON u.student_id = s.id
         WHERE u.username = ?`,
        [username],
        async (err, result) => {

            if (err) return res.status(500).json(err);

            if (result.length === 0) {
                return res.status(404).json("User not found");
            }

            const user = result[0];

            const match = await bcrypt.compare(password, user.password);

            if (!match) {
                return res.status(401).json("Wrong password");
            }

            const token = jwt.sign(
                {
                    id: user.id,
                    role: user.role,
                    student_id: user.student_id
                },
                process.env.JWT_SECRET || "secret",
                { expiresIn: "1d" }
            );

            res.json({ token, user });
        }
    );
});

module.exports = router;

