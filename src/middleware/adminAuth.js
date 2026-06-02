module.exports = (req, res, next) => {
  const configuredToken = process.env.ADMIN_IMPORT_TOKEN;
  const providedToken = req.headers['x-admin-token'];

  if (configuredToken) {
    if (providedToken !== configuredToken) {
      return res.status(403).json({ error: 'Admin import token required' });
    }
    return next();
  }

  if (req.user?.role === 'admin' || req.user?.is_admin === true) {
    return next();
  }

  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  return res.status(403).json({ error: 'Admin permission required' });
};

