module.exports = (err, req, res, next) => {
  console.error(err.stack);
  if (err.code) {
    return res.status(err.status || 500).json({
      error: 'The server could not complete this request. Please try again.',
    });
  }
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
};
