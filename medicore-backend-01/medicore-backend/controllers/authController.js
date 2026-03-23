/**
 * Auth Controller
 */
const User = require('../models/User');

exports.register = async (req, res) => {
  const { full_name, email, password, age, gender } = req.body;
  if (!full_name || !email || !password)
    return res.status(400).json({ message: 'full_name, email, and password are required.' });

  const user  = await User.create({ full_name, email, password, age, gender });
  const token = user.generateToken();
  res.status(201).json({
    message: 'Registered successfully.',
    access_token: token,
    token_type: 'Bearer',
    user: { id: user._id, full_name: user.full_name, email: user.email, role: user.role },
  });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required.' });

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password)))
    return res.status(401).json({ message: 'Invalid email or password.' });

  const token = user.generateToken();
  res.json({
    access_token: token,
    token_type: 'Bearer',
    expires_in: 604800,
    user: { id: user._id, full_name: user.full_name, email: user.email, role: user.role },
  });
};

exports.logout = (req, res) => res.json({ message: 'Logged out. Please discard your token.' });

exports.me = (req, res) => res.json(req.user);