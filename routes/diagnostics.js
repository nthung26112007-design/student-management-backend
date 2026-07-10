const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, verifyAdmin } = require('../controllers/middleware/auth');

router.get('/courses-class-mismatch', verifyToken, verifyAdmin, (req, res) => {
  const { semester_id } = req.query;

  let query = `
    SELECT c.id, c.name AS subject_name, c.class_name, c.semester_id, s.name AS semester_name
    FROM courses c
    LEFT JOIN semesters s ON s.id = c.semester_id
    WHERE 1=1
  `;
  const params = [];

  if (semester_id) {
    query += ' AND c.semester_id = ?';
    params.push(semester_id);
  }

  query += `
    AND EXISTS (
      SELECT 1
      FROM students st
      WHERE LOWER(TRIM(st.class_name)) = LOWER(TRIM(c.class_name))
    )
    ORDER BY c.semester_id DESC, c.class_name ASC, c.subject_name ASC
  `;

  db.query(query, params, (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
});

module.exports = router;
