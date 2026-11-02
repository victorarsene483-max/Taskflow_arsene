import jwt from 'jsonwebtoken';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization ?? '';
 
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log('JWT error:', err.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.userId = decoded.id;
    next();
  });
}

export default authMiddleware;