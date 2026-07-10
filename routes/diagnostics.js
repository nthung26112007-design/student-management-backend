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

// Debug endpoint to check table structure
router.get('/debug-tables', verifyToken, (req, res) => {
  const results = {};
  const tables = ['tuition_invoices', 'tuition_payments', 'students'];
  
  let completed = 0;
  tables.forEach(table => {
    db.query(`DESCRIBE ${table}`, (err, rows) => {
      if (err) {
        results[table] = { error: err.message };
      } else {
        results[table] = rows;
      }
      completed++;
      if (completed === tables.length) {
        res.json(results);
      }
    });
  });
});

// Test invoice query
router.get('/test-invoice-query', verifyToken, (req, res) => {
  const { student_id } = req.query;
  let query = `
    SELECT i.id, i.student_id, i.amount, i.status, i.due_date, i.note, i.invoice_code, i.title, i.class_name, i.created_at, i.updated_at,
      s.full_name, s.student_code, s.class_name AS student_class_name
    FROM tuition_invoices i
    LEFT JOIN students s ON s.id = i.student_id
    WHERE 1=1
  `;
  const params = [];
  
  if (student_id) {
    query += ' AND i.student_id = ?';
    params.push(student_id);
  }
  
  query += ' ORDER BY i.due_date DESC, i.id DESC LIMIT 10';
  
  db.query(query, params, (err, result) => {
    if (err) return res.status(500).json({ message: 'Query error', error: err.message, sql: query });
    res.json(result);
  });
});

module.exports = router;
