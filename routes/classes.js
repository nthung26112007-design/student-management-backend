const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, verifyAdmin } = require('../controllers/middleware/auth');

router.get('/stats/summary', verifyToken, (req, res) => {
  const query = `
    SELECT COUNT(*) total_classes,
           COUNT(DISTINCT course_year) total_years,
           COUNT(DISTINCT faculty) total_faculties,
           (SELECT COUNT(*) FROM students) total_students
    FROM classes
  `;
  db.query(query, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Lỗi truy vấn', error: err.message });
    res.json(rows[0] || {});
  });
});

router.get('/', verifyToken, (req, res) => {
  const { search, course_year, faculty } = req.query;
  let query = `
      SELECT c.*,
             (SELECT COUNT(*) FROM students s
              WHERE s.class_name = c.name) student_count
      FROM classes c WHERE 1=1
  `;
  const params = [];
  if (search) {
    query += ' AND (LOWER(c.name) LIKE ? OR LOWER(COALESCE(c.description,\'\')) LIKE ?)';
    params.push(`%${String(search).toLowerCase()}%`, `%${String(search).toLowerCase()}%`);
  }
  if (course_year) {
    query += ' AND c.course_year = ?';
    params.push(course_year);
  }
  if (faculty) {
    query += ' AND c.faculty = ?';
    params.push(faculty);
  }
  query += ' ORDER BY c.course_year DESC, c.name ASC';
  db.query(query, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Lỗi truy vấn', error: err.message });
    res.json(rows);
  });
});

router.get('/:id', verifyToken, (req, res) => {
  db.query('SELECT * FROM classes WHERE id = ?', [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Lỗi truy vấn', error: err.message });
    if (!rows.length) return res.status(404).json({ message: 'Không tìm thấy lớp' });
    res.json(rows[0]);
  });
});

router.post('/', verifyToken, verifyAdmin, (req, res) => {
  const { name, course_year, faculty, description } = req.body;
  const cleanName = String(name || '').trim();
  if (!cleanName) return res.status(400).json({ message: 'Tên lớp không được để trống' });

  db.query('SELECT id FROM classes WHERE name = ?', [cleanName], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Lỗi kiểm tra trùng', error: err.message });
    if (rows.length) return res.status(409).json({ message: 'Tên lớp đã tồn tại' });
    db.query(
      'INSERT INTO classes (name, course_year, faculty, description) VALUES (?, ?, ?, ?)',
      [cleanName, course_year || null, faculty || null, description || null],
      (insertErr, result) => {
        if (insertErr) return res.status(500).json({ message: 'Lỗi thêm lớp', error: insertErr.message });
        res.status(201).json({ message: 'Thêm lớp thành công', id: result.insertId, name: cleanName });
      },
    );
  });
});

router.put('/:id', verifyToken, verifyAdmin, (req, res) => {
  const { name, course_year, faculty, description } = req.body;
  const cleanName = String(name || '').trim();
  if (!cleanName) return res.status(400).json({ message: 'Tên lớp không được để trống' });

  db.query(
    'SELECT id FROM classes WHERE name = ? AND id != ?',
    [cleanName, req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Lỗi kiểm tra trùng', error: err.message });
      if (rows.length) return res.status(409).json({ message: 'Tên lớp đã tồn tại' });
      db.query(
        'UPDATE classes SET name=?, course_year=?, faculty=?, description=? WHERE id=?',
        [cleanName, course_year || null, faculty || null, description || null, req.params.id],
        (updateErr, result) => {
          if (updateErr) return res.status(500).json({ message: 'Lỗi cập nhật', error: updateErr.message });
          if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy lớp' });
          res.json({ message: 'Cập nhật lớp thành công' });
        },
      );
    },
  );
});

router.delete('/:id', verifyToken, verifyAdmin, (req, res) => {
  db.query(
    'SELECT c.name, (SELECT COUNT(*) FROM students s WHERE s.class_name = c.name) count FROM classes c WHERE c.id=?',
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Lỗi kiểm tra ràng buộc', error: err.message });
      if (!rows.length) return res.status(404).json({ message: 'Không tìm thấy lớp' });
      if (Number(rows[0].count) > 0) {
        return res.status(409).json({ message: `Không thể xóa: lớp đang có ${rows[0].count} sinh viên.` });
      }
      db.query('DELETE FROM classes WHERE id=?', [req.params.id], (deleteErr) => {
        if (deleteErr) return res.status(500).json({ message: 'Lỗi xóa lớp', error: deleteErr.message });
        res.json({ message: 'Xóa lớp thành công' });
      });
    },
  );
});

module.exports = router;

