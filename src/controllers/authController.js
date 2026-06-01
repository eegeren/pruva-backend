const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw { status: 500, message: 'JWT_SECRET is not configured' };
  }
  return process.env.JWT_SECRET;
}

exports.register = async (req, res, next) => {
  const client = await db.connect();
  try {
    const { email, username, password } = req.body;
    if (!email || !username || !password) {
      return res.status(400).json({ error: 'email, username and password are required' });
    }
    const jwtSecret = getJwtSecret();

    const hash = await bcrypt.hash(password, 10);
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO users (email, username, password_hash)
       VALUES ($1, $2, $3) RETURNING id, email, username`,
      [email, username, hash]
    );

    const token = jwt.sign({ id: result.rows[0].id }, jwtSecret, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });
    await client.query('COMMIT');

    res.status(201).json({ user: result.rows[0], token });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email or username already exists' });
    }
    next(err);
  } finally {
    client.release();
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Wrong credentials' });
    }

    const token = jwt.sign({ id: user.id }, getJwtSecret(), {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });

    res.json({ user: { id: user.id, email: user.email, username: user.username, is_premium: user.is_premium }, token });
  } catch (err) {
    next(err);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, email, username, full_name, phone, country, age, bio, avatar_color, is_premium, created_at
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { full_name, phone, country, age, bio, username, avatar_color } = req.body;

    if (username) {
      const existing = await db.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, req.user.id]
      );
      if (existing.rows[0]) {
        return res.status(409).json({ error: 'Username already taken' });
      }
    }

    const result = await db.query(
      `UPDATE users SET
        full_name    = COALESCE($1, full_name),
        phone        = COALESCE($2, phone),
        country      = COALESCE($3, country),
        age          = COALESCE($4, age),
        bio          = COALESCE($5, bio),
        username     = COALESCE($6, username),
        avatar_color = COALESCE($7, avatar_color)
       WHERE id = $8
       RETURNING id, email, username, full_name, phone, 
                 country, age, bio, avatar_color, is_premium, created_at`,
      [full_name, phone, country, age, bio, username, avatar_color, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};
