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

// ── GOOGLE AUTH ───────────────────────────────────────────────────────────────
exports.googleAuth = async (req, res) => {
  const { credential, role } = req.body;
  if (!credential) return res.status(400).json({ message: 'Google credential token is required.' });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(500).json({ message: 'GOOGLE_CLIENT_ID is not set in server .env file.' });

  try {
    const { verifyGoogleToken } = require('../services/Googleauthservice');
    const payload = await verifyGoogleToken(credential, clientId);
    const { email, name, picture, sub: googleId } = payload;

    if (!email) return res.status(400).json({ message: 'Could not get email from Google account.' });

    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        full_name:  name || email.split('@')[0],
        email,
        password:   'google_oauth_' + googleId,
        role:       role || 'patient',
        google_id:  googleId,
        avatar_url: picture || '',
      });
      console.log('[Google Auth] New user created:', email, '| role:', user.role);
    } else {
      if (!user.google_id) {
        user.google_id  = googleId;
        user.avatar_url = picture || user.avatar_url;
        await user.save();
      }
      console.log('[Google Auth] Existing user signed in:', email);
    }

    const token = user.generateToken();
    res.json({
      access_token: token,
      token_type:   'Bearer',
      expires_in:   604800,
      user: {
        id:         user._id,
        full_name:  user.full_name,
        email:      user.email,
        role:       user.role,
        avatar_url: user.avatar_url || picture || '',
      },
      google: true,
    });
  } catch (err) {
    console.error('[Google Auth] Error:', err.message);
    if (err.message?.includes('jwt') || err.message?.includes('signature') || err.message?.includes('audience')) {
      return res.status(401).json({ message: 'Invalid Google token. Please try signing in again.' });
    }
    res.status(500).json({ message: 'Google authentication failed: ' + err.message });
  }
};