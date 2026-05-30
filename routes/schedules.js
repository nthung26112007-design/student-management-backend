const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, verifyAdmin } = require('../controllers/middleware/auth');

const isStaff = (user) => user.role === 'admin' || user.role === 'teacher';

router.get('/', verifyToken, (req, res) => {
  const { type, className } = req.query;
  const user = req.user;

  const loadSchedules = (resolvedClassName = null) => {
    let query = `SELECT * FROM schedules WHERE 1=1`;
    const params = [];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    const finalClassName = className || resolvedClassName;
    if (finalClassName) {
      query += ' AND class_name = ?';
      params.push(finalClassName);
    }

    query += ' ORDER BY schedule_date ASC, schedule_time ASC, id DESC';
    db.query(query, params, (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result);
    });
  };

  if (user.role === 'student' && !className) {
    return db.query('SELECT class_name FROM students WHERE id = ?', [user.student_id], (err, rows) => {
      if (err) return res.status(500).json(err);
      loadSchedules(rows?.[0]?.class_name);
    });
  }

  loadSchedules();
});

router.post('/', verifyToken, (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json('Forbidden');
  db.query('INSERT INTO schedules SET ?', req.body, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Tạo lịch thành công', id: result.insertId });
  });
});

router.put('/:id', verifyToken, (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json('Forbidden');
  db.query('UPDATE schedules SET ? WHERE id = ?', [req.body, req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Cập nhật lịch thành công', affectedRows: result.affectedRows });
  });
});

router.delete('/:id', verifyToken, (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json('Forbidden');
  db.query('DELETE FROM schedules WHERE id = ?', [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Xóa lịch thành công', affectedRows: result.affectedRows });
  });
});

module.exports = router;
