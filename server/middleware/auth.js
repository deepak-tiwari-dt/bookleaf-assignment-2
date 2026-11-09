import jwt from 'jsonwebtoken';

export function signInToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role, authorId: user.author?.authorId || null }, process.env.JWT_SECRET, { expiresIn: '12h' });
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.bookleaf_session;
  if (!token) return res.status(401).json({ error: 'Please sign in' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ error: 'Not authorized' });
}
