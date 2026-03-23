/**
 * MediCore — Patient Case Controller
 * When a patient submits their problem, Llama 3.3 70B runs triage:
 *   severity score (0-100), label, urgency, recommended specialty
 * The case is stored and surfaced to matching doctors.
 */

const { PatientCase } = require('../models/index');
const User            = require('../models/User');
const groq            = require('../services/groqService');

// ── FALLBACK severity (if Groq is down) ──────────────────────────────────────
const EMERGENCY_KEYWORDS = [
  'chest pain', 'heart attack', 'stroke', 'seizure', 'unconscious', 'fainting',
  'difficulty breathing', 'shortness of breath', 'severe bleeding', 'suicide',
];

function fallbackSeverity(chief_complaint, symptoms) {
  const text = (chief_complaint + ' ' + symptoms.join(' ')).toLowerCase();
  const isEmergency = EMERGENCY_KEYWORDS.some(kw => text.includes(kw));
  if (isEmergency) return { severity_score: 92, severity_label: 'emergency', urgency: 'immediate', recommended_specialty: 'Emergency Medicine' };

  const highKeywords  = ['severe', 'intense', 'unbearable', 'vomiting blood', 'high fever', 'paralysis', 'vision loss'];
  const isHigh        = highKeywords.some(kw => text.includes(kw));
  if (isHigh) return { severity_score: 72, severity_label: 'high', urgency: 'within_48h', recommended_specialty: 'General Physician' };

  return { severity_score: 35, severity_label: 'moderate', urgency: 'within_week', recommended_specialty: 'General Physician' };
}

// ── 1. SUBMIT CASE ─────────────────────────────────────────────────────────────
exports.submitCase = async (req, res) => {
  const { chief_complaint, symptoms = [], duration } = req.body;
  if (!chief_complaint || chief_complaint.trim().length < 5)
    return res.status(400).json({ message: 'chief_complaint is required (min 5 chars).' });

  const user = await require('../models/User').findById(req.user._id).select('full_name age gender');

  // Run Llama triage
  let analysis = null;
  let severityFields = {};
  try {
    analysis = await groq.analyzePatientCaseSeverity({
      chief_complaint,
      symptoms,
      age:      user?.age,
      gender:   user?.gender,
      duration,
    });
    severityFields = {
      severity_score:        analysis.severity_score        || 0,
      severity_label:        analysis.severity_label        || 'unknown',
      urgency:               analysis.urgency               || 'within_week',
      recommended_specialty: analysis.recommended_specialty || '',
      llama_analysis:        analysis,
    };
  } catch (err) {
    console.warn('[PatientCase] Groq unavailable, using fallback:', err.message);
    severityFields = fallbackSeverity(chief_complaint, symptoms);
  }

  const newCase = await PatientCase.create({
    user_id:        req.user._id,
    patient_name:   user?.full_name,
    patient_age:    user?.age,
    patient_gender: user?.gender,
    chief_complaint,
    symptoms,
    duration,
    ...severityFields,
  });

  res.status(201).json({
    message:  'Case submitted and analyzed.',
    case:     newCase,
    analysis: analysis || severityFields,
    llama_powered: Boolean(analysis),
  });
};

// ── 2. LIST MY CASES ──────────────────────────────────────────────────────────
exports.listMyCases = async (req, res) => {
  const cases = await PatientCase.find({ user_id: req.user._id }).sort({ createdAt: -1 });
  res.json({ cases, total: cases.length });
};

// ── 3. GET SINGLE CASE ────────────────────────────────────────────────────────
exports.getCase = async (req, res) => {
  const c = await PatientCase.findOne({ _id: req.params.id, user_id: req.user._id });
  if (!c) return res.status(404).json({ message: 'Case not found.' });
  res.json({ case: c });
};