/**
 * Auth Middleware — protect routes with JWT
 */
const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ message: 'Not authenticated. Please login.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'medicore_secret');
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ message: 'User no longer exists.' });
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

/* Optional auth — attaches user if token present, does not block */
const optionalAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'medicore_secret');
      req.user = await User.findById(decoded.id).select('-password');
    } catch {}
  }
  next();
};

module.exports = { protect, optionalAuth };
