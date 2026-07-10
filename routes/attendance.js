const express = require('express');
const router = express.Router();

const db = require('../db');
const { verifyToken } = require('../controllers/middleware/auth');

const isStaff = (user) => user.role === 'admin' || user.role === 'teacher';

router.get('/sessions', verifyToken, (req, res) => {
  const { className, courseId } = req.query;

  const run = (finalClassName) => {
    let query = 'SELECT * FROM attendance_sessions WHERE 1=1';
    const params = [];

    if (finalClassName) {
      query += ' AND class_name = ?';
      params.push(finalClassName);
    }
    if (courseId) {
      query += ' AND course_id = ?';
      params.push(courseId);
    }

    query += ' ORDER BY session_date DESC, id DESC';
    db.query(query, params, (err, result) => {
      if (err) {
        console.error('GET /attendance/sessions query error:', err);
        return res.status(500).json(err);
      }
      res.json(result);
    });
  };

  if (req.user.role === 'student' && !className) {
    db.query(
      'SELECT class_name FROM students WHERE id = ?',
      [req.user.student_id],
      (err, rows) => {
        if (err) {
          console.error('GET /attendance/sessions student lookup error:', err);
          return res.status(500).json(err);
        }
        run(rows?.[0]?.class_name || null);
      }
    );
    return;
  }

  run(className || null);
});

router.get('/sessions/:id', verifyToken, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json('Invalid session id');
  }

  db.query('SELECT * FROM attendance_sessions WHERE id = ? LIMIT 1', [id], (err, result) => {
    if (err) {
      console.error('GET /attendance/sessions/:id query error:', err);
      return res.status(500).json(err);
    }
    const item = result?.[0];
    if (!item) return res.status(404).json('Not found');
    res.json(item);
  });
});

router.post('/sessions', verifyToken, (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json('Forbidden');
  db.query('INSERT INTO attendance_sessions SET ?', req.body, (err, result) => {
    if (err) {
      console.error('POST /attendance/sessions INSERT error:', err);
      return res.status(500).json({ error: 'INSERT_SESSION_FAILED', message: err.message });
    }
    res.json({ message: 'Tạo buổi điểm danh thành công', id: result.insertId });
  });
});

router.get('/records', verifyToken, (req, res) => {
  const { sessionId, studentId } = req.query;

  const loadRecords = (studentIds = null) => {
    let query = 'SELECT * FROM attendance_records WHERE 1=1';
    const params = [];

    if (sessionId) {
      query += ' AND session_id = ?';
      params.push(sessionId);
    }

    if (Array.isArray(studentIds) && studentIds.length > 0) {
      query += ` AND student_id IN (${studentIds.map(() => '?').join(',')})`;
      params.push(...studentIds);
    } else if (studentIds) {
      query += ' AND student_id = ?';
      params.push(studentIds);
    } else if (studentId) {
      query += ' AND student_id = ?';
      params.push(studentId);
    }

    query += ' ORDER BY id DESC';
    db.query(query, params, (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result);
    });
  };

  if (req.user.role === 'student' && !studentId) {
    return db.query(
      'SELECT class_name FROM students WHERE id = ?',
      [req.user.student_id],
      (err, rows) => {
        if (err) return res.status(500).json(err);
        const className = rows?.[0]?.class_name;
        if (!className) return loadRecords(req.user.student_id);
        db.query(
          'SELECT id FROM students WHERE class_name = ?',
          [className],
          (err2, studentRows) => {
            if (err2) return res.status(500).json(err2);
            const studentIds = studentRows.map((s) => s.id);
            loadRecords(studentIds.length ? studentIds : req.user.student_id);
          }
        );
      }
    );
  }

  loadRecords();
});

router.get('/records/:id', verifyToken, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json('Invalid record id');
  }

  db.query('SELECT * FROM attendance_records WHERE id = ? LIMIT 1', [id], (err, result) => {
    if (err) {
      console.error('GET /attendance/records/:id query error:', err);
      return res.status(500).json(err);
    }
    const item = result?.[0];
    if (!item) return res.status(404).json('Not found');
    res.json(item);
  });
});

router.post('/records/bulk', verifyToken, (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json('Forbidden');
  const { sessionId, records } = req.body;
  if (!sessionId || !Array.isArray(records)) return res.status(400).json('Invalid payload');

  const values = records.map((record) => [
    sessionId,
    record.student_id,
    record.status,
    record.note || null,
  ]);

  db.query(
    'INSERT INTO attendance_records (session_id, student_id, status, note) VALUES ?',
    [values],
    (err, result) => {
      if (err) {
        console.error('POST /attendance/records/bulk INSERT error:', err);
        return res.status(500).json({ error: 'INSERT_RECORDS_FAILED', message: err.message });
      }
      res.json({ message: 'Lưu điểm danh thành công', affectedRows: result.affectedRows });
    }
  );
});

router.put('/records/:id', verifyToken, (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json('Forbidden');
  const { id } = req.params;
  db.query('UPDATE attendance_records SET ? WHERE id = ?', [req.body, id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Cập nhật điểm danh thành công', affectedRows: result.affectedRows });
  });
});

router.get('/summary', verifyToken, (req, res) => {
  const { studentId, className, courseId } = req.query;

  const buildBaseQuery = () => {
    let query = `
      SELECT
        s.id AS student_id,
        s.full_name,
        s.student_code,
        s.class_name,
        COUNT(ar.id) AS total_sessions,
        COALESCE(SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END), 0) AS present_count,
        COALESCE(SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END), 0) AS absent_count,
        COALESCE(SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END), 0) AS late_count,
        COALESCE(SUM(CASE WHEN ar.status = 'excused' THEN 1 ELSE 0 END), 0) AS excused_count
      FROM students s
      LEFT JOIN attendance_records ar ON ar.student_id = s.id
      LEFT JOIN attendance_sessions ats ON ats.id = ar.session_id
      WHERE 1=1
    `;
    const params = [];

    if (studentId) {
      query += ' AND s.id = ?';
      params.push(studentId);
    }
    if (className) {
      query += ' AND s.class_name = ?';
      params.push(className);
    }
    if (courseId) {
      query += ' AND EXISTS (SELECT 1 FROM attendance_records ar2 INNER JOIN attendance_sessions ats2 ON ats2.id = ar2.session_id WHERE ar2.student_id = s.id AND ats2.course_id = ?)' ;
      params.push(courseId);
    }

    query += ' GROUP BY s.id, s.full_name, s.student_code, s.class_name ORDER BY s.full_name';
    return { query, params };
  };

  const runSummary = () => {
    const { query, params } = buildBaseQuery();
    db.query(query, params, (err, result) => {
      if (err) {
        console.error('GET /attendance/summary query error:', err);
        return res.status(500).json(err);
      }
      res.json(result);
    });
  };

  if (req.user.role === 'student' && !studentId) {
    return db.query('SELECT class_name FROM students WHERE id = ?', [req.user.student_id], (err, rows) => {
      if (err) {
        console.error('GET /attendance/summary student lookup error:', err);
        return res.status(500).json(err);
      }
      const classNameFromDb = rows?.[0]?.class_name;
      if (classNameFromDb && !className) {
        req.query.className = classNameFromDb;
      } else if (!classNameFromDb) {
        req.query.studentId = req.user.student_id;
      }
      runSummary();
    });
  }

  runSummary();
});

module.exports = router;
