const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../controllers/middleware/auth');

const isStaff = (user) => user.role === 'admin' || user.role === 'teacher';
const resolveStudentId = (req, requested) => req.user.role === 'student' ? req.user.student_id : (requested || null);

router.get('/invoices', verifyToken, (req, res) => {
  const studentId = resolveStudentId(req, req.query.studentId);
  let query = `
    SELECT i.*, s.full_name, s.student_code, s.class_name student_class_name,
           COALESCE(pay.paid_amount,0) paid_amount,
           GREATEST(i.amount-COALESCE(pay.paid_amount,0),0) remaining_amount,
           CASE
             WHEN COALESCE(pay.paid_amount,0) >= i.amount AND i.amount > 0 THEN 'paid'
             WHEN COALESCE(pay.paid_amount,0) > 0 THEN 'partial'
             ELSE 'unpaid'
           END calculated_status
    FROM tuition_invoices i
    LEFT JOIN students s ON s.id=i.student_id
    LEFT JOIN (
      SELECT invoice_id, SUM(amount) paid_amount
      FROM tuition_payments GROUP BY invoice_id
    ) pay ON pay.invoice_id=i.id
    WHERE 1=1
  `;
  const params = [];
  if (studentId) {
    query += ' AND i.student_id=?';
    params.push(studentId);
  }
  query += ' ORDER BY i.due_date DESC, i.id DESC';
  db.query(query, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Không tải được hóa đơn', error: err.message });
    res.json(rows.map((r) => ({ ...r, status: r.calculated_status || r.status })));
  });
});

router.post('/invoices', verifyToken, (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ message: 'Không có quyền tạo hóa đơn' });
  const { student_id, amount, due_date, note, invoice_code, title, class_name } = req.body;
  const numericAmount = Number(amount);
  if (!student_id || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ message: 'Sinh viên và số tiền hợp lệ là bắt buộc' });
  }
  db.query('SELECT id, class_name FROM students WHERE id=?', [student_id], (findErr, students) => {
    if (findErr) return res.status(500).json({ message: 'Không kiểm tra được sinh viên', error: findErr.message });
    if (!students.length) return res.status(404).json({ message: 'Không tìm thấy sinh viên' });
    const code = String(invoice_code || `INV${Date.now()}`).trim();
    db.query(
      `INSERT INTO tuition_invoices
       (student_id, amount, status, due_date, note, invoice_code, title, class_name)
       VALUES (?, ?, 'unpaid', ?, ?, ?, ?, ?)`,
      [student_id, numericAmount, due_date || new Date().toISOString().slice(0, 10), note || null,
        code, title || 'Học phí', class_name || students[0].class_name || null],
      (err, result) => {
        if (err) return res.status(500).json({ message: 'Không tạo được hóa đơn', error: err.message });
        res.status(201).json({ message: 'Tạo hóa đơn học phí thành công', id: result.insertId, invoice_code: code });
      },
    );
  });
});

router.put('/invoices/:id', verifyToken, (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ message: 'Không có quyền sửa hóa đơn' });
  const allowed = ['student_id', 'amount', 'due_date', 'note', 'invoice_code', 'title', 'class_name'];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      fields.push(`${key}=?`);
      values.push(req.body[key]);
    }
  }
  if (!fields.length) return res.status(400).json({ message: 'Không có dữ liệu cập nhật' });
  values.push(req.params.id);
  db.query(`UPDATE tuition_invoices SET ${fields.join(',')} WHERE id=?`, values, (err, result) => {
    if (err) return res.status(500).json({ message: 'Không cập nhật được hóa đơn', error: err.message });
    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy hóa đơn' });
    res.json({ message: 'Cập nhật hóa đơn thành công', affectedRows: result.affectedRows });
  });
});

router.delete('/invoices/:id', verifyToken, (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ message: 'Không có quyền xóa hóa đơn' });
  db.getConnection((connectionErr, connection) => {
    if (connectionErr) return res.status(500).json({ message: 'Không kết nối được cơ sở dữ liệu', error: connectionErr.message });
    connection.beginTransaction((beginErr) => {
      if (beginErr) {
        connection.release();
        return res.status(500).json({ message: 'Không bắt đầu được giao dịch', error: beginErr.message });
      }
      connection.query('DELETE FROM tuition_payments WHERE invoice_id=?', [req.params.id], (paymentErr) => {
        if (paymentErr) return connection.rollback(() => {
          connection.release();
          res.status(500).json({ message: 'Không xóa được thanh toán liên quan', error: paymentErr.message });
        });
        connection.query('DELETE FROM tuition_invoices WHERE id=?', [req.params.id], (invoiceErr, result) => {
          if (invoiceErr) return connection.rollback(() => {
            connection.release();
            res.status(500).json({ message: 'Không xóa được hóa đơn', error: invoiceErr.message });
          });
          connection.commit((commitErr) => {
            if (commitErr) return connection.rollback(() => {
              connection.release();
              res.status(500).json({ message: 'Không hoàn tất xóa hóa đơn', error: commitErr.message });
            });
            connection.release();
            res.json({ message: 'Xóa hóa đơn thành công', affectedRows: result.affectedRows });
          });
        });
      });
    });
  });
});

router.get('/payments', verifyToken, (req, res) => {
  const studentId = resolveStudentId(req, req.query.studentId);
  let query = `
    SELECT p.*, i.invoice_code, i.amount invoice_amount, i.due_date,
           s.full_name, s.student_code, s.class_name
    FROM tuition_payments p
    LEFT JOIN tuition_invoices i ON i.id=p.invoice_id
    LEFT JOIN students s ON s.id=p.student_id
    WHERE 1=1
  `;
  const params = [];
  if (studentId) {
    query += ' AND p.student_id=?';
    params.push(studentId);
  }
  query += ' ORDER BY p.payment_date DESC, p.id DESC';
  db.query(query, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Không tải được lịch sử thanh toán', error: err.message });
    res.json(rows);
  });
});

router.post('/payments', verifyToken, (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ message: 'Không có quyền ghi nhận thanh toán' });
  const { invoice_id, amount, payment_date, note } = req.body;
  const numericAmount = Number(amount);
  if (!invoice_id || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ message: 'Hóa đơn và số tiền hợp lệ là bắt buộc' });
  }

  db.getConnection((connectionErr, connection) => {
    if (connectionErr) return res.status(500).json({ message: 'Không kết nối được cơ sở dữ liệu', error: connectionErr.message });
    connection.beginTransaction((beginErr) => {
      if (beginErr) {
        connection.release();
        return res.status(500).json({ message: 'Không bắt đầu được giao dịch', error: beginErr.message });
      }
      connection.query(
        `SELECT i.student_id, i.amount, COALESCE(SUM(p.amount),0) paid
         FROM tuition_invoices i LEFT JOIN tuition_payments p ON p.invoice_id=i.id
         WHERE i.id=? GROUP BY i.id FOR UPDATE`,
        [invoice_id],
        (findErr, rows) => {
          if (findErr || !rows.length) return connection.rollback(() => {
            connection.release();
            res.status(findErr ? 500 : 404).json({ message: findErr ? 'Không kiểm tra được hóa đơn' : 'Không tìm thấy hóa đơn', error: findErr?.message });
          });
          const remaining = Number(rows[0].amount) - Number(rows[0].paid);
          if (numericAmount > remaining + 0.001) return connection.rollback(() => {
            connection.release();
            res.status(400).json({ message: `Số tiền vượt quá số còn phải đóng (${remaining})` });
          });
          connection.query(
            'INSERT INTO tuition_payments (invoice_id, student_id, amount, payment_date, note) VALUES (?, ?, ?, ?, ?)',
            [invoice_id, rows[0].student_id, numericAmount, payment_date || new Date().toISOString().slice(0, 10), note || null],
            (insertErr, result) => {
              if (insertErr) return connection.rollback(() => {
                connection.release();
                res.status(500).json({ message: 'Không ghi nhận được thanh toán', error: insertErr.message });
              });
              const newPaid = Number(rows[0].paid) + numericAmount;
              const status = newPaid >= Number(rows[0].amount) ? 'paid' : 'partial';
              connection.query('UPDATE tuition_invoices SET status=? WHERE id=?', [status, invoice_id], (updateErr) => {
                if (updateErr) return connection.rollback(() => {
                  connection.release();
                  res.status(500).json({ message: 'Không cập nhật được trạng thái hóa đơn', error: updateErr.message });
                });
                connection.commit((commitErr) => {
                  if (commitErr) return connection.rollback(() => {
                    connection.release();
                    res.status(500).json({ message: 'Không hoàn tất thanh toán', error: commitErr.message });
                  });
                  connection.release();
                  res.status(201).json({ message: 'Ghi nhận thanh toán thành công', id: result.insertId, status });
                });
              });
            },
          );
        },
      );
    });
  });
});

router.get('/summary', verifyToken, (req, res) => {
  const studentId = resolveStudentId(req, req.query.studentId);
  let query = `
    SELECT s.id student_id, s.full_name, s.student_code, s.class_name,
           COALESCE(inv.total_invoiced,0) total_invoiced,
           COALESCE(pay.total_paid,0) total_paid,
           GREATEST(COALESCE(inv.total_invoiced,0)-COALESCE(pay.total_paid,0),0) balance
    FROM students s
    LEFT JOIN (SELECT student_id, SUM(amount) total_invoiced FROM tuition_invoices GROUP BY student_id) inv ON inv.student_id=s.id
    LEFT JOIN (SELECT student_id, SUM(amount) total_paid FROM tuition_payments GROUP BY student_id) pay ON pay.student_id=s.id
    WHERE 1=1
  `;
  const params = [];
  if (studentId) {
    query += ' AND s.id=?';
    params.push(studentId);
  }
  query += ' ORDER BY s.full_name';
  db.query(query, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Không tải được tổng hợp học phí', error: err.message });
    res.json(rows);
  });
});

module.exports = router;
