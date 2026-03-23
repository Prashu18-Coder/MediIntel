const mongoose = require('mongoose');

// ── Symptom Check ─────────────────────────────────────────────────────────────
const SymptomCheckSchema = new mongoose.Schema({
  user_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  symptoms:   [String],
  conditions: [{ name: String, probability: Number, severity: String, description: String }],
  emergency:  { type: Boolean, default: false },
  urgency:    String,
  specialist: String,
}, { timestamps: true });

// ── Medical Report ────────────────────────────────────────────────────────────
const ReportSchema = new mongoose.Schema({
  user_id:             { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reportType:          String,
  parameters_analyzed: Number,
  abnormal_count:      Number,
  summary:             String,
  values:              [{ name: String, value: String, unit: String, normal: String, status: String, insight: String }],
  risk_flags:          [String],
  recommendations:     [String],
  diet:                [String],
  filename:            String,
}, { timestamps: true });

// ── Health Record ─────────────────────────────────────────────────────────────
const HealthRecordSchema = new mongoose.Schema({
  user_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  record_type: String,
  data:        mongoose.Schema.Types.Mixed,
}, { timestamps: true });

// ── Medicine Reminder ─────────────────────────────────────────────────────────
const MedicineSchema = new mongoose.Schema({
  user_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name:      { type: String, required: true },
  dose:      String,
  frequency: String,
  time:      String,
  taken:     { type: Boolean, default: false },
  color:     { type: String, default: '#00d4ff' },
}, { timestamps: true });

// ── Emergency Alert ───────────────────────────────────────────────────────────
const EmergencyAlertSchema = new mongoose.Schema({
  user_id:              { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  alert_type:           String,
  location:             { lat: Number, lng: Number },
  message:              String,
  ambulance_dispatched: { type: Boolean, default: false },
  notified_contacts:    [String],
  status:               { type: String, default: 'sent' },
}, { timestamps: true });

// ── Appointment ───────────────────────────────────────────────────────────────
const AppointmentSchema = new mongoose.Schema({
  user_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  doctor_id:     String,
  doctor_user_id:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  doctor_name:   String,
  specialty:     String,
  slot:          String,
  date:          String,
  hospital:      String,
  reason:        String,
  notes:         String,
  status:        { type: String, enum: ['pending','confirmed','completed','cancelled'], default: 'confirmed' },
}, { timestamps: true });

// ── Mood Log ──────────────────────────────────────────────────────────────────
const MoodLogSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  mood:    String,
  score:   Number,
}, { timestamps: true });

// ── Blood Donor ───────────────────────────────────────────────────────────────
const BloodDonorSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  blood:     { type: String, required: true, index: true },
  city:      String,
  area:      String,
  phone:     String,
  available: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = {
  SymptomCheck:   mongoose.model('SymptomCheck',   SymptomCheckSchema),
  Report:         mongoose.model('Report',         ReportSchema),
  HealthRecord:   mongoose.model('HealthRecord',   HealthRecordSchema),
  Medicine:       mongoose.model('Medicine',       MedicineSchema),
  EmergencyAlert: mongoose.model('EmergencyAlert', EmergencyAlertSchema),
  Appointment:    mongoose.model('Appointment',    AppointmentSchema),
  MoodLog:        mongoose.model('MoodLog',        MoodLogSchema),
  BloodDonor:     mongoose.model('BloodDonor',     BloodDonorSchema),
};

// ── Medicine Scan Result ──────────────────────────────────────────────────────
const ScanResultSchema = new mongoose.Schema({
  user_id:              { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  filename:             String,
  status:               { type: String, enum: ['authentic','counterfeit','unknown'], default: 'unknown' },
  authentic:            { type: Boolean, default: false },
  confidence:           { type: Number, default: 0 },
  medicine_name:        String,
  manufacturer:         String,
  batch_no:             String,
  expiry:               String,
  dosage:               String,
  indicators:           [{ label: String, pass: Boolean }],
  groq_analysis:        String,
  recommendation:       String,
  authenticity_signals: [String],
  counterfeit_signals:  [String],
  warnings:             [String],
  ocr_used:             { type: Boolean, default: false },
  groq_powered:         { type: Boolean, default: false },
}, { timestamps: true });

module.exports.ScanResult = mongoose.model('ScanResult', ScanResultSchema);
// ── Patient Case (submitted from Patient Dashboard for doctor recommendations) ──
const PatientCaseSchema = new mongoose.Schema({
  user_id:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patient_name:     String,
  patient_age:      Number,
  patient_gender:   String,
  chief_complaint:  { type: String, required: true },  // main problem/symptoms
  symptoms:         [String],
  duration:         String,   // "3 days", "2 weeks"
  severity_score:   { type: Number, default: 0 },      // 0-100 from Llama
  severity_label:   { type: String, default: 'unknown' }, // low/moderate/high/critical/emergency
  urgency:          { type: String, default: 'within_week' },
  recommended_specialty: String,                        // specialty to route to
  llama_analysis:   mongoose.Schema.Types.Mixed,        // full Llama JSON output
  status:           { type: String, enum: ['pending','reviewed','resolved'], default: 'pending' },
  reviewed_by:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes:            String,
}, { timestamps: true });

module.exports.PatientCase = mongoose.model('PatientCase', PatientCaseSchema);

// ── Prescription ──────────────────────────────────────────────────────────────
const PrescriptionSchema = new mongoose.Schema({
  doctor_user_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patient_user_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  doctor_name:      String,
  doctor_specialty: String,
  patient_name:     String,
  diagnosis:        String,
  medicines: [{
    name:         { type: String, required: true },
    dosage:       String,
    frequency:    String,
    duration:     String,
    instructions: String,
    timing:       String,
  }],
  tests_advised:  [String],
  advice:         String,
  follow_up:      String,
  status:         { type: String, enum: ['active','completed','cancelled'], default: 'active' },
}, { timestamps: true });

module.exports.Prescription = mongoose.model('Prescription', PrescriptionSchema);