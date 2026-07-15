const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../controllers/middleware/auth');

const isAdmin = (user) => user.role === 'admin';

const parseNote = (raw) => {
  if (!raw) return { note: '' };
  try {
    const value = JSON.parse(raw);
    if (value && value._sync_meta === true) {
      return {
        note: value.note || '',
        subject_code: value.subject_code || '',
        exam_form: value.exam_form || null,
        duration: value.duration || null,
      };
    }
  } catch (_) {}
  return { note: raw };
};

const serializeNote = (body, old = {}) => JSON.stringify({
  _sync_meta: true,
  note: body.note ?? old.note ?? '',
  subject_code: body.subject_code ?? old.subject_code ?? '',
  exam_form: body.exam_form ?? old.exam_form ?? null,
  duration: body.duration ?? old.duration ?? null,
});

const enrich = (rows) => rows.map((row) => ({ ...row, ...parseNote(row.note), note_raw: row.note }));

router.get('/', verifyToken, (req, res) => {
  const { type, className } = req.query;
  const run = (studentClass) => {
    let query = `SELECT sch.*, t.full_name teacher_name, t.teacher_code
                 FROM schedules sch
                 LEFT JOIN teachers t ON t.id = sch.teacher_id
                 WHERE 1=1`;
    const params = [];
    if (type) {
      query += ' AND sch.type=?';
      params.push(type);
    }
    const finalClass = req.user.role === 'student' ? studentClass : className;
    if (finalClass) {
      query += ' AND sch.class_name = ?';
      params.push(finalClass);
    }
    if (req.user.role === 'teacher') {
      query += ` AND sch.teacher_id IN (
        SELECT teacher_account.id
        FROM teachers teacher_account
        INNER JOIN users teacher_user ON BINARY teacher_user.username = BINARY teacher_account.teacher_code
        WHERE teacher_user.id = ?
      )`;
      params.push(req.user.id);
    }
    query += ' ORDER BY sch.schedule_date ASC, sch.schedule_time ASC, sch.id DESC';
    db.query(query, params, (err, rows) => {
      if (err) return res.status(500).json({ message: 'Không tải được lịch', error: err.message });
      res.json(enrich(rows));
    });
  };
  if (req.user.role === 'student') {
    return db.query('SELECT class_name FROM students WHERE id=?', [req.user.student_id], (err, rows) => {
      if (err) return res.status(500).json({ message: 'Không xác định được lớp', error: err.message });
      run(rows[0]?.class_name || null);
    });
  }
  run(null);
});

router.post('/', verifyToken, (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ message: 'Chỉ quản trị viên được tạo lịch' });
  const { type, title, class_name, subject_name, schedule_date, schedule_time, room, teacher_id } = req.body;
  if (!class_name || !schedule_date || !schedule_time) {
    return res.status(400).json({ message: 'Thiếu lớp, ngày hoặc thời gian' });
  }
  const row = {
    type: type || 'study',
    title: title || subject_name || 'Lịch học',
    class_name,
    subject_name: subject_name || title || null,
    schedule_date,
    schedule_time,
    room: room || null,
    teacher_id: teacher_id || null,
    note: serializeNote(req.body),
  };
  db.query('INSERT INTO schedules SET ?', row, (err, result) => {
    if (err) return res.status(500).json({ message: 'Không tạo được lịch', error: err.message });
    res.status(201).json({ message: 'Tạo lịch thành công', id: result.insertId });
  });
});

router.put('/:id', verifyToken, (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ message: 'Chỉ quản trị viên được sửa lịch' });
  db.query('SELECT note FROM schedules WHERE id=?', [req.params.id], (findErr, rows) => {
    if (findErr) return res.status(500).json({ message: 'Không tải được lịch cũ', error: findErr.message });
    if (!rows.length) return res.status(404).json({ message: 'Không tìm thấy lịch' });
    const old = parseNote(rows[0].note);
    const row = {};
    for (const key of ['type', 'title', 'class_name', 'subject_name', 'schedule_date', 'schedule_time', 'room', 'teacher_id']) {
      if (req.body[key] !== undefined) row[key] = req.body[key] || null;
    }
    row.note = serializeNote(req.body, old);
    db.query('UPDATE schedules SET ? WHERE id=?', [row, req.params.id], (err, result) => {
      if (err) return res.status(500).json({ message: 'Không cập nhật được lịch', error: err.message });
      res.json({ message: 'Cập nhật lịch thành công', affectedRows: result.affectedRows });
    });
  });
});

router.delete('/:id', verifyToken, (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ message: 'Chỉ quản trị viên được xóa lịch' });
  db.query('DELETE FROM schedules WHERE id=?', [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Không xóa được lịch', error: err.message });
    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy lịch' });
    res.json({ message: 'Xóa lịch thành công' });
  });
});

module.exports = router;

