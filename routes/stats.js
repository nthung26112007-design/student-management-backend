const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../controllers/middleware/auth');

const query = (sql, params = []) => new Promise((resolve) => {
  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error('[stats]', err.message);
      resolve([]);
    } else {
      resolve(rows || []);
    }
  });
});

router.get('/overview', verifyToken, async (req, res) => {
  const studentFilter = req.user.role === 'student' ? ' WHERE id = ?' : '';
  const studentParams = req.user.role === 'student' ? [req.user.student_id] : [];

  const [students, classes, courses, semesters, schedules, attendance, invoices, scores] = await Promise.all([
    query(`SELECT COUNT(*) total FROM students${studentFilter}`, studentParams),
    query('SELECT COUNT(*) total FROM classes'),
    query('SELECT COUNT(*) total FROM courses'),
    query('SELECT COUNT(*) total FROM semesters'),
    query('SELECT COUNT(*) total FROM schedules'),
    query('SELECT COUNT(*) total FROM attendance_sessions'),
    query(`SELECT COUNT(*) total, COALESCE(SUM(amount),0) total_amount FROM tuition_invoices${req.user.role === 'student' ? ' WHERE student_id = ?' : ''}`, req.user.role === 'student' ? [req.user.student_id] : []),
    query(`SELECT COUNT(*) total, COALESCE(AVG(total_score),0) average_score,
      COALESCE(SUM(CASE WHEN total_score >= 4 THEN 1 ELSE 0 END),0) passed,
      COALESCE(SUM(CASE WHEN total_score < 4 THEN 1 ELSE 0 END),0) failed
      FROM scores${req.user.role === 'student' ? ' WHERE student_id = ?' : ''}`, req.user.role === 'student' ? [req.user.student_id] : []),
  ]);

  res.json({
    students: Number(students[0]?.total || 0),
    classes: Number(classes[0]?.total || 0),
    courses: Number(courses[0]?.total || 0),
    semesters: Number(semesters[0]?.total || 0),
    schedules: Number(schedules[0]?.total || 0),
    attendance_sessions: Number(attendance[0]?.total || 0),
    invoices: Number(invoices[0]?.total || 0),
    tuition_total: Number(invoices[0]?.total_amount || 0),
    grade_records: Number(scores[0]?.total || 0),
    average_score: Number(scores[0]?.average_score || 0),
    passed: Number(scores[0]?.passed || 0),
    failed: Number(scores[0]?.failed || 0),
    server_time: new Date().toISOString(),
  });
});

router.get('/academic-report', verifyToken, async (req, res) => {
  if (req.user.role === 'student') {
    const rows = await query(`
      SELECT st.class_name, st.student_code, st.full_name,
             COUNT(sc.id) grade_records,
             COALESCE(AVG(sc.total_score),0) average_score,
             COALESCE(SUM(CASE WHEN sc.total_score >= 4 THEN 1 ELSE 0 END),0) passed,
             COALESCE(SUM(CASE WHEN sc.total_score < 4 THEN 1 ELSE 0 END),0) failed
      FROM students st
      LEFT JOIN scores sc ON sc.student_id = st.id
      WHERE st.id = ?
      GROUP BY st.id, st.class_name, st.student_code, st.full_name
    `, [req.user.student_id]);
    return res.json(rows);
  }

  const rows = await query(`
    SELECT st.class_name,
           COUNT(DISTINCT st.id) student_count,
           COUNT(sc.id) grade_records,
           COALESCE(AVG(sc.total_score),0) average_score,
           COALESCE(SUM(CASE WHEN sc.total_score >= 4 THEN 1 ELSE 0 END),0) passed,
           COALESCE(SUM(CASE WHEN sc.total_score < 4 THEN 1 ELSE 0 END),0) failed
    FROM students st
    LEFT JOIN scores sc ON sc.student_id = st.id
    GROUP BY st.class_name
    ORDER BY st.class_name
  `);
  res.json(rows);
});

module.exports = router;
