const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../controllers/middleware/auth');

const isStaff = (user) => user.role === 'admin' || user.role === 'teacher';
const allowedFields = [
  'student_id', 'course_id', 'semester_id', 'subject_name',
  'cc_score', 'qkt_score', 'ckt_score', 'total_score', 'grade', 'status', 'note',
];

const pickGrade = (body) => {
  const row = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) row[key] = body[key];
  }
  return row;
};

const ensureGradeClassMatch = (studentId, courseId, callback) => {
  db.query(
    `SELECT st.class_name student_class, c.class_name course_class
     FROM students st CROSS JOIN courses c
     WHERE st.id = ? AND c.id = ? LIMIT 1`,
    [studentId, courseId],
    (err, rows) => {
      if (err) return callback(err);
      if (!rows.length) return callback(null, false, 'Không tìm thấy sinh viên hoặc môn học');
      const studentClass = String(rows[0].student_class || '').trim().toLowerCase();
      const courseClass = String(rows[0].course_class || '').trim().toLowerCase();
      if (!studentClass || !courseClass) return callback(null, false, 'Chưa gán lớp cho sinh viên hoặc môn học');
      callback(null, studentClass === courseClass,
        studentClass === courseClass ? null : 'Sinh viên không thuộc lớp của môn học đã chọn');
    },
  );
};

router.get('/', verifyToken, (req, res) => {
  const { studentId, semesterId, className, courseId } = req.query;
  let query = `
    SELECT sc.*, st.student_code, st.full_name, st.class_name,
           c.code subject_code, c.subject_name, c.credits,
           sem.name semester_name
    FROM scores sc
    INNER JOIN students st ON st.id = sc.student_id
    LEFT JOIN courses c ON c.id = sc.course_id
    LEFT JOIN semesters sem ON sem.id = sc.semester_id
    WHERE 1=1
  `;
  const params = [];

  if (req.user.role === 'student') {
    query += ' AND sc.student_id = ?';
    params.push(req.user.student_id);
  } else if (studentId) {
    query += ' AND sc.student_id = ?';
    params.push(studentId);
  }
  if (semesterId) {
    query += ' AND sc.semester_id = ?';
    params.push(semesterId);
  }
  if (className) {
    query += ' AND st.class_name = ?';
    params.push(className);
  }
  if (courseId) {
    query += ' AND sc.course_id = ?';
    params.push(courseId);
  }
  query += ' ORDER BY st.full_name, sem.start_date DESC, c.code';

  db.query(query, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Không tải được bảng điểm', error: err.message });
    res.json(rows);
  });
});

router.post('/', verifyToken, (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ message: 'Không có quyền nhập điểm' });
  const row = pickGrade(req.body);
  if (!row.student_id || !row.course_id || !row.semester_id) {
    return res.status(400).json({ message: 'Thiếu student_id, course_id hoặc semester_id' });
  }

  ensureGradeClassMatch(row.student_id, row.course_id, (matchErr, matched, message) => {
    if (matchErr) return res.status(500).json({ message: 'Lỗi kiểm tra lớp', error: matchErr.message });
    if (!matched) return res.status(400).json({ message });

    db.query(
      'SELECT id FROM scores WHERE student_id=? AND course_id=? AND semester_id=? LIMIT 1',
      [row.student_id, row.course_id, row.semester_id],
      (findErr, existing) => {
        if (findErr) return res.status(500).json({ message: 'Lỗi kiểm tra điểm', error: findErr.message });
        if (existing.length) {
          return db.query('UPDATE scores SET ? WHERE id=?', [row, existing[0].id], (updateErr) => {
            if (updateErr) return res.status(500).json({ message: 'Không cập nhật được điểm', error: updateErr.message });
            res.json({ message: 'Cập nhật điểm thành công', id: existing[0].id, updated: true });
          });
        }
        db.query('INSERT INTO scores SET ?', row, (insertErr, result) => {
          if (insertErr) return res.status(500).json({ message: 'Không thêm được điểm', error: insertErr.message });
          res.status(201).json({ message: 'Thêm điểm thành công', id: result.insertId });
        });
      },
    );
  });
});

router.put('/:id', verifyToken, (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ message: 'Không có quyền sửa điểm' });
  const row = pickGrade(req.body);
  if (!Object.keys(row).length) return res.status(400).json({ message: 'Không có dữ liệu cập nhật' });

  const runUpdate = () => {
    db.query('UPDATE scores SET ? WHERE id=?', [row, req.params.id], (err, result) => {
      if (err) return res.status(500).json({ message: 'Không cập nhật được điểm', error: err.message });
      if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy điểm' });
      res.json({ message: 'Cập nhật điểm thành công', id: Number(req.params.id) });
    });
  };

  if (row.student_id && row.course_id) {
    return ensureGradeClassMatch(row.student_id, row.course_id, (matchErr, matched, message) => {
      if (matchErr) return res.status(500).json({ message: 'Lỗi kiểm tra lớp', error: matchErr.message });
      if (!matched) return res.status(400).json({ message });
      runUpdate();
    });
  }
  runUpdate();
});

router.delete('/:id', verifyToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Chỉ quản trị viên được xóa điểm' });
  db.query('DELETE FROM scores WHERE id=?', [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Không xóa được điểm', error: err.message });
    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy điểm' });
    res.json({ message: 'Xóa điểm thành công' });
  });
});

module.exports = router;

