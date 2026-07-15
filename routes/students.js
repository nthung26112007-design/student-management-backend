const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');
const { verifyToken, verifyAdmin } = require('../controllers/middleware/auth');

const allowedStudentFields = [
  'student_code', 'full_name', 'gender', 'birth_date', 'email', 'phone',
  'address', 'class_name', 'academic_status', 'status',
];

const pickStudent = (body) => {
  const row = {};
  for (const key of allowedStudentFields) {
    if (body[key] !== undefined) {
      if (key === 'status' && body.academic_status === undefined) row.academic_status = body[key];
      else if (key !== 'status') row[key] = body[key];
    }
  }
  return row;
};

router.get('/', verifyToken, (req, res) => {
  const { className } = req.query;
  if (req.user.role === 'student') {
    return db.query('SELECT * FROM students WHERE id=?', [req.user.student_id], (err, rows) => {
      if (err) return res.status(500).json({ message: 'Không tải được hồ sơ', error: err.message });
      if (!rows.length) return res.status(404).json({ message: 'Không tìm thấy sinh viên' });
      res.json(rows[0]);
    });
  }
  let query = 'SELECT * FROM students WHERE 1=1';
  const params = [];
  if (className) {
    query += ' AND LOWER(TRIM(class_name)) = LOWER(TRIM(?)) COLLATE utf8mb4_unicode_ci';
    params.push(className);
  }
  query += ' ORDER BY full_name, id';
  db.query(query, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Không tải được danh sách sinh viên', error: err.message });
    res.json(rows);
  });
});

router.post('/', verifyToken, verifyAdmin, (req, res) => {
  const row = pickStudent(req.body);
  const code = String(row.student_code || '').trim();
  const name = String(row.full_name || '').trim();
  if (!code || !name) return res.status(400).json({ message: 'Mã sinh viên và họ tên là bắt buộc' });
  row.student_code = code;
  row.full_name = name;

  db.getConnection((connectionErr, connection) => {
    if (connectionErr) return res.status(500).json({ message: 'Không kết nối được cơ sở dữ liệu', error: connectionErr.message });
    connection.beginTransaction(async (beginErr) => {
      if (beginErr) {
        connection.release();
        return res.status(500).json({ message: 'Không bắt đầu được giao dịch', error: beginErr.message });
      }
      connection.query('SELECT id FROM students WHERE LOWER(TRIM(student_code)) = LOWER(TRIM(?)) COLLATE utf8mb4_unicode_ci', [code], async (findErr, existing) => {
        if (findErr || existing.length) {
          connection.rollback(() => {
            connection.release();
            res.status(findErr ? 500 : 409).json({ message: findErr ? 'Không kiểm tra được mã sinh viên' : 'Mã sinh viên đã tồn tại', error: findErr?.message });
          });
          return;
        }
        connection.query('INSERT INTO students SET ?', row, async (insertErr, result) => {
          if (insertErr) {
            connection.rollback(() => {
              connection.release();
              res.status(500).json({ message: 'Không thêm được sinh viên', error: insertErr.message });
            });
            return;
          }
          try {
            const hash = await bcrypt.hash(code, 10);
            connection.query(
              'INSERT INTO users (username, password, role, student_id) VALUES (?, ?, \'student\', ?)',
              [code, hash, result.insertId],
              (userErr) => {
                if (userErr) {
                  connection.rollback(() => {
                    connection.release();
                    res.status(500).json({ message: 'Không tạo được tài khoản sinh viên', error: userErr.message });
                  });
                  return;
                }
                connection.commit((commitErr) => {
                  if (commitErr) {
                    connection.rollback(() => {
                      connection.release();
                      res.status(500).json({ message: 'Không hoàn tất thêm sinh viên', error: commitErr.message });
                    });
                    return;
                  }
                  connection.release();
                  res.status(201).json({ message: 'Thêm sinh viên và tài khoản thành công', id: result.insertId, username: code });
                });
              },
            );
          } catch (hashErr) {
            connection.rollback(() => {
              connection.release();
              res.status(500).json({ message: 'Không tạo được mật khẩu', error: hashErr.message });
            });
          }
        });
      });
    });
  });
});

router.put('/:id', verifyToken, verifyAdmin, (req, res) => {
  const row = pickStudent(req.body);
  if (!Object.keys(row).length) return res.status(400).json({ message: 'Không có dữ liệu cập nhật' });

  db.getConnection((connectionErr, connection) => {
    if (connectionErr) return res.status(500).json({ message: 'Không kết nối được cơ sở dữ liệu', error: connectionErr.message });
    connection.beginTransaction((beginErr) => {
      if (beginErr) {
        connection.release();
        return res.status(500).json({ message: 'Không bắt đầu được giao dịch', error: beginErr.message });
      }
      connection.query('UPDATE students SET ? WHERE id=?', [row, req.params.id], (updateErr, result) => {
        if (updateErr || !result.affectedRows) return connection.rollback(() => {
          connection.release();
          res.status(updateErr ? 500 : 404).json({ message: updateErr ? 'Không cập nhật được sinh viên' : 'Không tìm thấy sinh viên', error: updateErr?.message });
        });
        const finish = () => connection.commit((commitErr) => {
          if (commitErr) return connection.rollback(() => {
            connection.release();
            res.status(500).json({ message: 'Không hoàn tất cập nhật', error: commitErr.message });
          });
          connection.release();
          res.json({ message: 'Cập nhật sinh viên thành công' });
        });
        if (row.student_code) {
          connection.query('UPDATE users SET username=? WHERE student_id=?', [row.student_code, req.params.id], (userErr) => {
            if (userErr) return connection.rollback(() => {
              connection.release();
              res.status(500).json({ message: 'Không đồng bộ được tài khoản', error: userErr.message });
            });
            finish();
          });
        } else finish();
      });
    });
  });
});

router.post('/:id/reset-password', verifyToken, verifyAdmin, async (req, res) => {
  const password = String(req.body.password || '').trim();
  if (password.length < 6) return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự' });
  try {
    const hash = await bcrypt.hash(password, 10);
    db.query('UPDATE users SET password=? WHERE student_id=?', [hash, req.params.id], (err, result) => {
      if (err) return res.status(500).json({ message: 'Không đặt lại được mật khẩu', error: err.message });
      if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy tài khoản sinh viên' });
      res.json({ message: 'Đặt lại mật khẩu thành công' });
    });
  } catch (err) {
    res.status(500).json({ message: 'Không mã hóa được mật khẩu', error: err.message });
  }
});

router.delete('/:id', verifyToken, verifyAdmin, (req, res) => {
  db.getConnection((connectionErr, connection) => {
    if (connectionErr) return res.status(500).json({ message: 'Không kết nối được cơ sở dữ liệu', error: connectionErr.message });
    connection.beginTransaction((beginErr) => {
      if (beginErr) {
        connection.release();
        return res.status(500).json({ message: 'Không bắt đầu được giao dịch', error: beginErr.message });
      }
      const operations = [
        ['DELETE FROM attendance_records WHERE student_id=?', [req.params.id]],
        ['DELETE FROM tuition_payments WHERE student_id=?', [req.params.id]],
        ['DELETE FROM tuition_invoices WHERE student_id=?', [req.params.id]],
        ['DELETE FROM scores WHERE student_id=?', [req.params.id]],
        ['DELETE FROM users WHERE student_id=?', [req.params.id]],
        ['DELETE FROM students WHERE id=?', [req.params.id]],
      ];
      let index = 0;
      let finalResult = null;
      const next = () => {
        if (index >= operations.length) {
          return connection.commit((commitErr) => {
            if (commitErr) return connection.rollback(() => {
              connection.release();
              res.status(500).json({ message: 'Không hoàn tất xóa sinh viên', error: commitErr.message });
            });
            connection.release();
            if (!finalResult?.affectedRows) return res.status(404).json({ message: 'Không tìm thấy sinh viên' });
            res.json({ message: 'Xóa sinh viên và dữ liệu liên quan thành công' });
          });
        }
        const [sql, params] = operations[index++];
        connection.query(sql, params, (err, result) => {
          if (err) return connection.rollback(() => {
            connection.release();
            res.status(500).json({ message: 'Không xóa được dữ liệu liên quan', error: err.message });
          });
          if (sql.startsWith('DELETE FROM students')) finalResult = result;
          next();
        });
      };
      next();
    });
  });
});

module.exports = router;
