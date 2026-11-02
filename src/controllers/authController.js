import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/index.js';

async function register(req, res) {
  const { username, email, password } = req.body ?? {};

  if ([username, email, password].some((v) => typeof v !== 'string' || !v.trim())) {
    return res.status(400).json({ error: 'username, email and password are required' });
  }
  if (!email.includes('@')) {
    return res.status(400).json({ error: 'email is not valid' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, created_at`,
      [username.trim(), email.trim().toLowerCase(), hash]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username or email already in use' });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
}

async function login(req, res) {
  const { email, password } = req.body ?? {};

  if ([email, password].some((v) => typeof v !== 'string' || !v.trim())) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const { rows } = await pool.query(
      'SELECT id, username, email, password_hash FROM users WHERE email = $1',
      [cleanEmail]
    );
    const user = rows[0];

    const passwordMatches = user && (await bcrypt.compare(password, user.password_hash));
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.status(200).json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Something went wrong signing you in. Please try again.' });
  }
}

async function getMe(req,res) {
try{
 const {rows} = await pool.query(
  `SELECT id,username,email FROM users WHERE id=$1`,
  [req.userId]
 );
 const user = rows[0];
 if(!user){return res.status(404).json({error:'User not found'})
 } res.status(200).json(user);
} catch(err){
  console.error('getMe error:',err);
  res.status(500).json({error:'Something went wrong.Please try again.'})
}
}

export { register,getMe, login };