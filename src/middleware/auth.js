const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const isBearer = authHeader.startsWith('Bearer ');
  const token = isBearer ? authHeader.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'Authentication token required' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
