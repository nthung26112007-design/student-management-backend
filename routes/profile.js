const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../controllers/middleware/auth');

router.get('/me', verifyToken, (req, res) => {
  db.query(
    `SELECT u.id, u.username, u.role, u.student_id,
            s.full_name, s.student_code, s.class_name, s.gender, s.birth_date,
            s.email, s.phone, s.address, s.major, s.faculty, s.training_level, s.status,
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

module.exports = router;
