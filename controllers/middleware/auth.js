const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authorization = String(req.headers.authorization || '').trim();
  const [scheme, token] = authorization.split(/\s+/);

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ hoặc thiếu token' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    return next();
  } catch (err) {
    const expired = err?.name === 'TokenExpiredError';
    return res.status(expired ? 401 : 403).json({
      message: expired ? 'Phiên đăng nhập đã hết hạn' : 'Token không hợp lệ',
    });
  }
};

const verifyAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Chỉ quản trị viên được phép thực hiện thao tác này' });
  }
  return next();
};

module.exports = { verifyToken, verifyAdmin };
