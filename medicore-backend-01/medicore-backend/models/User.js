/**
 * User Model — with role + doctor specialization
 */
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  full_name:      { type: String, required: [true, 'Full name is required'], trim: true },
  email:          { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
  password:       { type: String, required: [true, 'Password is required'], minlength: 6, select: false },
  age:            { type: Number, min: 0, max: 120 },
  gender:         { type: String, enum: ['male','female','other'] },

  // Role — enforced server-side
  role:           { type: String, enum: ['patient','doctor'], default: 'patient' },

  // Google OAuth
  google_id:      { type: String, default: '' },
  avatar_url:     { type: String, default: '' },

  // Doctor-only fields
  specialization: { type: String, default: '' },
  experience:     { type: String, default: '' },
  hospital:       { type: String, default: '' },
  bio:            { type: String, default: '' },
}, { timestamps: true });

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = function(plain) {
  return bcrypt.compare(plain, this.password);
};

UserSchema.methods.generateToken = function() {
  return jwt.sign(
    { id: this._id, email: this.email, role: this.role },
    process.env.JWT_SECRET || 'medicore_secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

module.exports = mongoose.model('User', UserSchema);