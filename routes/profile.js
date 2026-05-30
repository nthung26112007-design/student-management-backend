const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../controllers/middleware/auth');

router.get('/me', verifyToken, (req, res) => {
  db.query(
    `SELECT u.id, u.username, u.role, u.student_id,
            s.full_name, s.student_code, s.class_name, s.gender, s.birth_date,
            s.email, s.phone, s.academic_status AS status,
            u.avatar_url
     FROM users u
     LEFT JOIN students s ON u.student_id = s.id
     WHERE u.id = ?`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      if (!rows.length) return res.status(404).json('User not found');
      res.json(rows[0]);
    }
  );
});

router.put('/avatar', verifyToken, (req, res) => {
  const { avatar_url } = req.body;
  if (!avatar_url) return res.status(400).json('Missing avatar_url');

  db.query(
    'UPDATE users SET avatar_url = ? WHERE id = ?',
    [avatar_url, req.user.id],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ message: 'Avatar updated', affectedRows: result.affectedRows });
    }
  );
});

router.put('/change-password', verifyToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Missing currentPassword or newPassword' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters' });
  }

  db.query(
    'SELECT password FROM users WHERE id = ?',
    [req.user.id],
    async (err, rows) => {
      if (err) return res.status(500).json(err);
      if (!rows.length) return res.status(404).json({ message: 'User not found' });

      const user = rows[0];
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      db.query(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashed, req.user.id],
        (updateErr, result) => {
          if (updateErr) return res.status(500).json(updateErr);
          res.json({ message: 'Password updated', affectedRows: result.affectedRows });
        }
      );
    }
  );
});

module.exports = router;
