const express = require('express');
const router = express.Router();

const db = require('../db');
const { verifyToken } = require('../controllers/middleware/auth');

const isStaff = (user) => user.role === 'admin' || user.role === 'teacher';
const isStudent = (user) => user.role === 'student';

const resolveStudentId = (req, requestedStudentId) => {
  if (isStudent(req.user)) return req.user.student_id;
  return requestedStudentId || null;
};

router.get('/invoices', verifyToken, (req, res) => {
  const studentId = resolveStudentId(req, req.query.studentId);
  let query = `
    SELECT i.*, s.full_name, s.student_code, s.class_name,
      COALESCE(SUM(p.amount), 0) AS paid_amount,
      GREATEST(i.amount - COALESCE(SUM(p.amount), 0), 0) AS remaining_amount
    FROM tuition_invoices i
    LEFT JOIN students s ON s.id = i.student_id
    LEFT JOIN tuition_payments p ON p.invoice_id = i.id
    WHERE 1=1
  `;
  const params = [];

  if (studentId) {
    query += ' AND i.student_id = ?';
    params.push(studentId);
  }

  query += ' GROUP BY i.id ORDER BY i.due_date DESC, i.id DESC';
  db.query(query, params, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

router.post('/invoices', verifyToken, (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json('Forbidden');

  const { student_id, amount, status, due_date, note } = req.body;
  if (!student_id || !amount) {
    return res.status(400).json({ message: 'student_id và amount là bắt buộc' });
  }

  db.query(
    'INSERT INTO tuition_invoices (student_id, amount, status, due_date, note) VALUES (?, ?, ?, ?, ?)',
    [student_id, amount, status || 'unpaid', due_date || new Date().toISOString().slice(0, 10), note || null],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Không tạo được hóa đơn', error: err.message });
      res.json({ message: 'Tạo hóa đơn học phí thành công', id: result.insertId });
    }
  );
});

router.put('/invoices/:id', verifyToken, (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json('Forbidden');
  const { id } = req.params;
  db.query('UPDATE tuition_invoices SET ? WHERE id = ?', [req.body, id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Cập nhật hóa đơn thành công', affectedRows: result.affectedRows });
  });
});

router.post('/payments', verifyToken, (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json('Forbidden');
  const { invoice_id, student_id, amount, payment_date, note } = req.body;

  db.query(
    'INSERT INTO tuition_payments (invoice_id, student_id, amount, payment_date, note) VALUES (?, ?, ?, ?, ?)',
    [invoice_id, student_id, amount, payment_date || new Date().toISOString().slice(0, 10), note || null],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ message: 'Ghi nhận thanh toán thành công', id: result.insertId });
    }
  );
});

router.get('/payments', verifyToken, (req, res) => {
  const studentId = resolveStudentId(req, req.query.studentId);
  let query = `
    SELECT p.*, i.amount AS invoice_amount, i.due_date, i.status AS invoice_status,
           s.full_name, s.student_code, s.class_name
    FROM tuition_payments p
    LEFT JOIN tuition_invoices i ON i.id = p.invoice_id
    LEFT JOIN students s ON s.id = p.student_id
    WHERE 1=1
  `;
  const params = [];

  if (studentId) {
    query += ' AND p.student_id = ?';
    params.push(studentId);
  }

  query += ' ORDER BY p.payment_date DESC, p.id DESC';
  db.query(query, params, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

router.get('/summary', verifyToken, (req, res) => {
  const studentId = resolveStudentId(req, req.query.studentId);
  let query = `
    SELECT
      s.id AS student_id,
      s.full_name,
      s.student_code,
      s.class_name,
      COALESCE(SUM(DISTINCT i.amount), 0) AS total_invoiced,
      COALESCE(SUM(DISTINCT p.amount), 0) AS total_paid,
      COALESCE(SUM(DISTINCT i.amount), 0) - COALESCE(SUM(DISTINCT p.amount), 0) AS balance
    FROM students s
    LEFT JOIN tuition_invoices i ON i.student_id = s.id
    LEFT JOIN tuition_payments p ON p.student_id = s.id
    WHERE 1=1
  `;
  const params = [];

  if (studentId) {
    query += ' AND s.id = ?';
    params.push(studentId);
  }

  query += ' GROUP BY s.id ORDER BY s.full_name';

  db.query(query, params, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

module.exports = router;
