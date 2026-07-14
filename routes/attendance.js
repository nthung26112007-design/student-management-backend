const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../controllers/middleware/auth');

const isStaff = (user) => user.role === 'admin' || user.role === 'teacher';

const parseNote = (raw) => {
  if (!raw) return { note: '' };
  try {
    const value = JSON.parse(raw);
    if (value && typeof value === 'object' && value._sync_meta === true) {
      return {
        note: value.note || '',
        start_time: value.start_time || '',
        end_time: value.end_time || '',
        room: value.room || '',
        subject_code: value.subject_code || '',
        lecturer: value.lecturer || '',
      };
    }
  } catch (_) {}
  return { note: raw };
};

const serializeNote = (body, oldNote = '') => JSON.stringify({
  _sync_meta: true,
  note: body.note ?? oldNote ?? '',
  start_time: body.start_time || '',
  end_time: body.end_time || '',
  room: body.room || '',
  subject_code: body.subject_code || '',
  lecturer: body.lecturer || '',
});

const enrichSessions = (rows) => rows.map((row) => ({
  ...row,
  ...parseNote(row.note),
  note_raw: row.note,
}));

router.get('/sessions', verifyToken, (req, res) => {
  const { className, courseId } = req.query;
  const run = (resolvedClassName) => {
    let query = `
      SELECT ats.*, c.code subject_code_db, c.subject_name,
             (SELECT COUNT(*) FROM students st
              WHERE LOWER(TRIM(st.class_name))=LOWER(TRIM(ats.class_name))) total_count,
             COALESCE(SUM(CASE WHEN ar.status='present' THEN 1 ELSE 0 END),0) present_count,
             COALESCE(SUM(CASE WHEN ar.status='absent' THEN 1 ELSE 0 END),0) absent_count,
             COALESCE(SUM(CASE WHEN ar.status='late' THEN 1 ELSE 0 END),0) late_count,
             COALESCE(SUM(CASE WHEN ar.status='excused' THEN 1 ELSE 0 END),0) excused_count
      FROM attendance_sessions ats
      LEFT JOIN courses c ON c.id=ats.course_id
      LEFT JOIN attendance_records ar ON ar.session_id=ats.id
      WHERE 1=1
    `;
    const params = [];
    const finalClassName = className || resolvedClassName;
    if (finalClassName) {
      query += ' AND LOWER(TRIM(ats.class_name))=LOWER(TRIM(?))';
      params.push(finalClassName);
    }
    if (courseId) {
      query += ' AND ats.course_id=?';
      params.push(courseId);
    }
    query += ' GROUP BY ats.id, c.code, c.subject_name ORDER BY ats.session_date DESC, ats.id DESC';
    db.query(query, params, (err, rows) => {
      if (err) return res.status(500).json({ message: 'Không tải được buổi điểm danh', error: err.message });
      const result = enrichSessions(rows).map((row) => ({
        ...row,
        subject_code: row.subject_code || row.subject_code_db || '',
        subject_name: row.subject_name || row.session_title,
      }));
      res.json(result);
    });
  };

  if (req.user.role === 'student' && !className) {
    return db.query('SELECT class_name FROM students WHERE id=?', [req.user.student_id], (err, rows) => {
      if (err) return res.status(500).json({ message: 'Không xác định được lớp', error: err.message });
      run(rows[0]?.class_name || null);
    });
  }
  run(null);
});

router.get('/sessions/:id', verifyToken, (req, res) => {
  const run = (className) => {
    let sql = 'SELECT * FROM attendance_sessions WHERE id=?';
    const params = [req.params.id];
    if (className) {
      sql += ' AND LOWER(TRIM(class_name))=LOWER(TRIM(?))';
      params.push(className);
    }
    sql += ' LIMIT 1';
    db.query(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ message: 'Không tải được buổi điểm danh', error: err.message });
      if (!rows.length) return res.status(404).json({ message: 'Không tìm thấy buổi điểm danh' });
      return res.json(enrichSessions(rows)[0]);
    });
  };
  if (req.user.role === 'student') {
    return db.query('SELECT class_name FROM students WHERE id=?', [req.user.student_id], (err, rows) => {
      if (err) return res.status(500).json({ message: 'Không xác định được lớp', error: err.message });
      return run(rows[0]?.class_name || '__NO_CLASS__');
    });
  }
  return run(null);
});

router.post('/sessions', verifyToken, (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ message: 'Không có quyền tạo buổi điểm danh' });
  const { session_title, session_date, class_name, course_id } = req.body;
  if (!session_title || !session_date || !class_name) {
    return res.status(400).json({ message: 'Thiếu tên buổi, ngày hoặc lớp' });
  }
  const row = {
    session_title,
    session_date,
    class_name,
    course_id: course_id || null,
    note: serializeNote(req.body),
  };
  db.query('INSERT INTO attendance_sessions SET ?', row, (err, result) => {
    if (err) return res.status(500).json({ message: 'Không tạo được buổi điểm danh', error: err.message });
    res.status(201).json({ message: 'Tạo buổi điểm danh thành công', id: result.insertId });
  });
});

router.put('/sessions/:id', verifyToken, (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ message: 'Không có quyền sửa buổi điểm danh' });
  db.query('SELECT note FROM attendance_sessions WHERE id=?', [req.params.id], (findErr, rows) => {
    if (findErr) return res.status(500).json({ message: 'Không tải được dữ liệu cũ', error: findErr.message });
    if (!rows.length) return res.status(404).json({ message: 'Không tìm thấy buổi điểm danh' });
    const old = parseNote(rows[0].note);
    const row = {};
    for (const key of ['session_title', 'session_date', 'class_name', 'course_id']) {
      if (req.body[key] !== undefined) row[key] = req.body[key] || null;
    }
    row.note = serializeNote({ ...old, ...req.body }, old.note);
    db.query('UPDATE attendance_sessions SET ? WHERE id=?', [row, req.params.id], (err, result) => {
      if (err) return res.status(500).json({ message: 'Không cập nhật được buổi điểm danh', error: err.message });
      res.json({ message: 'Cập nhật buổi điểm danh thành công', affectedRows: result.affectedRows });
    });
  });
});

router.delete('/sessions/:id', verifyToken, (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ message: 'Không có quyền xóa buổi điểm danh' });
  db.query('DELETE FROM attendance_sessions WHERE id=?', [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Không xóa được buổi điểm danh', error: err.message });
    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy buổi điểm danh' });
    res.json({ message: 'Xóa buổi điểm danh thành công' });
  });
});

router.get('/records', verifyToken, (req, res) => {
  const { sessionId, studentId } = req.query;
  let query = `
    SELECT ar.*, st.student_code, st.full_name, st.class_name
    FROM attendance_records ar
    INNER JOIN students st ON st.id=ar.student_id
    WHERE 1=1
  `;
  const params = [];
  if (sessionId) {
    query += ' AND ar.session_id=?';
    params.push(sessionId);
  }
  if (req.user.role === 'student') {
    query += ' AND ar.student_id=?';
    params.push(req.user.student_id);
  } else if (studentId) {
    query += ' AND ar.student_id=?';
    params.push(studentId);
  }
  query += ' ORDER BY st.full_name, ar.id DESC';
  db.query(query, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Không tải được điểm danh', error: err.message });
    res.json(rows);
  });
});

router.post('/records/bulk', verifyToken, (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ message: 'Không có quyền lưu điểm danh' });
  const sessionId = Number(req.body.sessionId);
  const records = Array.isArray(req.body.records) ? req.body.records : [];
  if (!sessionId || !records.length) return res.status(400).json({ message: 'Danh sách điểm danh trống' });

  db.getConnection((connectionErr, connection) => {
    if (connectionErr) return res.status(500).json({ message: 'Không kết nối được cơ sở dữ liệu', error: connectionErr.message });
    connection.beginTransaction((beginErr) => {
      if (beginErr) {
        connection.release();
        return res.status(500).json({ message: 'Không bắt đầu được giao dịch', error: beginErr.message });
      }
      const ids = records.map((r) => Number(r.student_id)).filter(Boolean);
      if (!ids.length) {
        return connection.rollback(() => {
          connection.release();
          res.status(400).json({ message: 'Không có mã sinh viên hợp lệ để đồng bộ' });
        });
      }
      const placeholders = ids.map(() => '?').join(',');
      connection.query(
        `DELETE FROM attendance_records WHERE session_id=? AND student_id IN (${placeholders})`,
        [sessionId, ...ids],
        (deleteErr) => {
          if (deleteErr) return connection.rollback(() => {
            connection.release();
            res.status(500).json({ message: 'Không đồng bộ được bản ghi cũ', error: deleteErr.message });
          });
          const values = records.map((r) => [sessionId, r.student_id, r.status || 'unmarked', r.note || null]);
          connection.query(
            'INSERT INTO attendance_records (session_id, student_id, status, note) VALUES ?',
            [values],
            (insertErr, result) => {
              if (insertErr) return connection.rollback(() => {
                connection.release();
                res.status(500).json({ message: 'Không lưu được điểm danh', error: insertErr.message });
              });
              connection.commit((commitErr) => {
                if (commitErr) return connection.rollback(() => {
                  connection.release();
                  res.status(500).json({ message: 'Không hoàn tất đồng bộ', error: commitErr.message });
                });
                connection.release();
                res.json({ message: 'Đồng bộ điểm danh thành công', affectedRows: result.affectedRows });
              });
            },
          );
        },
      );
    });
  });
});

router.put('/records/:id', verifyToken, (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ message: 'Không có quyền sửa điểm danh' });
  const row = {};
  if (req.body.status !== undefined) row.status = req.body.status;
  if (req.body.note !== undefined) row.note = req.body.note;
  if (!Object.keys(row).length) return res.status(400).json({ message: 'Không có dữ liệu cập nhật' });
  db.query('UPDATE attendance_records SET ? WHERE id=?', [row, req.params.id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Không cập nhật được điểm danh', error: err.message });
    res.json({ message: 'Cập nhật điểm danh thành công', affectedRows: result.affectedRows });
  });
});

router.get('/summary', verifyToken, (req, res) => {
  const { studentId, className, courseId } = req.query;
  let query = `
    SELECT st.id student_id, st.full_name, st.student_code, st.class_name,
           COUNT(ar.id) total_sessions,
           COALESCE(SUM(CASE WHEN ar.status='present' THEN 1 ELSE 0 END),0) present_count,
           COALESCE(SUM(CASE WHEN ar.status='absent' THEN 1 ELSE 0 END),0) absent_count,
           COALESCE(SUM(CASE WHEN ar.status='late' THEN 1 ELSE 0 END),0) late_count,
           COALESCE(SUM(CASE WHEN ar.status='excused' THEN 1 ELSE 0 END),0) excused_count
    FROM students st
    LEFT JOIN attendance_records ar ON ar.student_id=st.id
    LEFT JOIN attendance_sessions ats ON ats.id=ar.session_id
    WHERE 1=1
  `;
  const params = [];
  if (req.user.role === 'student') {
    query += ' AND st.id=?';
    params.push(req.user.student_id);
  } else if (studentId) {
    query += ' AND st.id=?';
    params.push(studentId);
  }
  if (className) {
    query += ' AND LOWER(TRIM(st.class_name))=LOWER(TRIM(?))';
    params.push(className);
  }
  if (courseId) {
    query += ' AND ats.course_id=?';
    params.push(courseId);
  }
  query += ' GROUP BY st.id, st.full_name, st.student_code, st.class_name ORDER BY st.full_name';
  db.query(query, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Không tải được tổng hợp điểm danh', error: err.message });
    res.json(rows);
  });
});

module.exports = router;
