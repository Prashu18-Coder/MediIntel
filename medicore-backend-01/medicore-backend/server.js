/**
 * MediCore AI — Express Server
 * MERN Stack Backend Entry Point
 */

require('dotenv').config();
require('express-async-errors');

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const connectDB  = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// ── Route imports ─────────────────────────────────────────────────────────────
const authRoutes         = require('./routes/auth');
const symptomRoutes      = require('./routes/symptoms');
const reportRoutes       = require('./routes/reports');
const recordRoutes       = require('./routes/records');
const dashboardRoutes    = require('./routes/dashboard');
const medicineRoutes     = require('./routes/medicines');
const emergencyRoutes    = require('./routes/emergency');
const doctorRoutes       = require('./routes/doctors');
const bloodRoutes        = require('./routes/blood');
const mentalRoutes       = require('./routes/mental');
const scanRoutes         = require('./routes/scan');
const appointmentRoutes  = require('./routes/appointments');
const doctorPortalRoutes = require('./routes/doctorPortal');
const patientCaseRoutes  = require('./routes/Patientcases');
const prescriptionRoutes = require('./routes/Prescriptions');

// ── Connect Database ──────────────────────────────────────────────────────────
connectDB();

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS — wildcard '*' inside an array does NOT work in the cors package.
// Use a function so every localhost port is allowed in development.
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5500',
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (Postman, curl, mobile apps)
    if (!origin) return callback(null, true);
    // In development allow any localhost / 127.0.0.1 port
    if (
      process.env.NODE_ENV !== 'production' ||
      ALLOWED_ORIGINS.includes(origin) ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
// Explicitly handle preflight for all routes (needed for multipart/FormData uploads)
app.options('*', cors(corsOptions));

// ── General middleware ────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      200,
  message:  { message: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// ── Serve uploaded files ──────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/symptoms',     symptomRoutes);
app.use('/api/reports',      reportRoutes);
app.use('/api/records',      recordRoutes);
app.use('/api/dashboard',    dashboardRoutes);
app.use('/api/medicines',    medicineRoutes);
app.use('/api/emergency',    emergencyRoutes);
app.use('/api/doctors',      doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/doctor-portal',  doctorPortalRoutes);
app.use('/api/patient-cases',  patientCaseRoutes);
app.use('/api/prescriptions',  prescriptionRoutes);
app.use('/api/blood',        bloodRoutes);
app.use('/api/mental',       mentalRoutes);
app.use('/api/medicine-scan',scanRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({
  platform: 'MediCore API',
  version:  '1.0.0',
  status:   'running',
  docs:     'http://localhost:5000/api',
}));

app.get('/api', (req, res) => res.json({
  message:  'MediCore API is live',
  endpoints: [
    '/api/auth', '/api/symptoms', '/api/reports', '/api/records',
    '/api/dashboard', '/api/medicines', '/api/emergency', '/api/doctors',
    '/api/appointments', '/api/blood', '/api/mental', '/api/medicine-scan',
  ],
}));

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: `Route ${req.originalUrl} not found` }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ⚕️  MediCore API running
  ───────────────────────────────────────────
  🌐  http://localhost:${PORT}
  ☁️   MongoDB: Atlas (${process.env.MONGO_URI?.split('@')[1]?.split('/')[0] || 'connecting…'})
  🔧  ENV: ${process.env.NODE_ENV || 'development'}
  📖  API root: http://localhost:${PORT}/api
  ───────────────────────────────────────────
  `);
});

module.exports = app;