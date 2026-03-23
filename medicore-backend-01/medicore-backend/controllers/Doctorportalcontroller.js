/**
 * MediCore — Doctor Portal Controller
 * My Patients, Appointments, Analytics — all from MongoDB
 */

const User         = require('../models/User');
const { PatientCase, SymptomCheck, Report, Appointment, EmergencyAlert, MoodLog } = require('../models/index');
const groq         = require('../services/groqService');

const SPECIALTY_CONDITIONS = {
  'Cardiologist':       ['cardiac','heart','chest pain','palpitation','hypertension','bp','arrhythmia'],
  'Neurologist':        ['headache','migraine','seizure','stroke','dizziness','numbness','tremor'],
  'Diabetologist':      ['diabetes','sugar','glucose','hba1c','insulin','hyperglycemia'],
  'General Physician':  ['fever','cold','cough','fatigue','weakness','body pain','flu','infection'],
  'Dermatologist':      ['rash','skin','acne','eczema','itching','allergy','psoriasis'],
  'Orthopedic':         ['joint pain','back pain','knee','fracture','arthritis','bone','spine'],
  'Gastroenterologist': ['stomach','abdomen','nausea','vomiting','diarrhea','constipation','acidity'],
  'Pulmonologist':      ['breathing','asthma','lungs','cough','bronchitis','chest','pneumonia'],
  'Gynecologist':       ['menstrual','pregnancy','pcos','fertility','ovarian','uterus','menopause'],
  'Psychiatrist':       ['anxiety','depression','stress','mental','mood','sleep disorder','panic'],
  'Ophthalmologist':    ['eye','vision','blurred','cataract','retina','glaucoma'],
  'ENT':                ['ear','nose','throat','sinus','tonsil','hearing','nasal'],
  'Urologist':          ['kidney','urinary','bladder','prostate','urine','uti','stones'],
  'Endocrinologist':    ['thyroid','hormone','adrenal','pituitary','cortisol','tsh'],
  'Oncologist':         ['cancer','tumor','malignancy','chemotherapy','biopsy','lymphoma'],
};
const SEVERITY_ORDER = { emergency:5, critical:4, high:3, moderate:2, low:1, unknown:0 };
const URGENCY_ORDER  = { immediate:4, within_48h:3, within_week:2, routine:1 };

// ── 1. GET DOCTOR PROFILE ─────────────────────────────────────────────────────
exports.getDoctorProfile = async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  res.json({ doctor: user });
};

// ── 2. UPDATE DOCTOR PROFILE ─────────────────────────────────────────────────
exports.updateDoctorProfile = async (req, res) => {
  const { specialization, experience, hospital, bio, full_name } = req.body;
  const updates = {};
  if (specialization !== undefined) updates.specialization = specialization;
  if (experience     !== undefined) updates.experience     = experience;
  if (hospital       !== undefined) updates.hospital       = hospital;
  if (bio            !== undefined) updates.bio            = bio;
  if (full_name      !== undefined) updates.full_name      = full_name;

  const user = await User.findByIdAndUpdate(
    req.user._id, { $set: updates }, { new: true, runValidators: true }
  ).select('-password');
  res.json({ message: 'Profile updated.', doctor: user });
};

// ── 3. PATIENT RECOMMENDATIONS ───────────────────────────────────────────────
exports.getPatientRecommendations = async (req, res) => {
  const doctor    = await User.findById(req.user._id).select('specialization');
  const specialty = doctor?.specialization || req.query.specialty || '';

  let cases = await PatientCase.find({ status: { $in: ['pending','reviewed'] } })
    .populate('user_id', 'full_name age gender email')
    .sort({ severity_score: -1, createdAt: -1 })
    .limit(50);

  if (specialty) {
    const keywords = SPECIALTY_CONDITIONS[specialty] || [specialty.toLowerCase()];
    cases = cases.filter(c => {
      if (c.recommended_specialty?.toLowerCase().includes(specialty.toLowerCase())) return true;
      const text = ((c.chief_complaint||'') + ' ' + (c.symptoms||[]).join(' ')).toLowerCase();
      return keywords.some(kw => text.includes(kw));
    });
  }

  cases.sort((a,b) => {
    const sd = (SEVERITY_ORDER[b.severity_label]||0) - (SEVERITY_ORDER[a.severity_label]||0);
    if (sd !== 0) return sd;
    return (URGENCY_ORDER[b.urgency]||0) - (URGENCY_ORDER[a.urgency]||0);
  });

  res.json({ specialty, total: cases.length, cases });
};

// ── 4. MY PATIENTS (all patients who have appointments with this doctor) ──────
exports.getMyPatients = async (req, res) => {
  const doctorId = req.user._id.toString();
  const doctor   = await User.findById(req.user._id).select('full_name specialization');

  const nameRegex = doctor?.full_name
    ? new RegExp(doctor.full_name.replace(/^Dr\.\s*/i, '').trim(), 'i')
    : null;

  const orConditions = [
    { doctor_user_id: req.user._id },
    { doctor_id: doctorId },
  ];
  if (nameRegex) orConditions.push({ doctor_name: nameRegex });

  const appts = await Appointment.find({ $or: orConditions })
    .populate('user_id', 'full_name age gender email createdAt')
    .sort({ createdAt: -1 });

  // Also include patients who submitted cases matching doctor's specialty
  const specialty = doctor?.specialization || '';
  let patientCases = [];
  if (specialty) {
    patientCases = await PatientCase.find({ status: { $in: ['pending','reviewed','resolved'] } })
      .populate('user_id', 'full_name age gender email createdAt')
      .sort({ severity_score: -1 })
      .limit(30);
    const keywords = SPECIALTY_CONDITIONS[specialty] || [specialty.toLowerCase()];
    patientCases = patientCases.filter(c => {
      if (c.recommended_specialty?.toLowerCase().includes(specialty.toLowerCase())) return true;
      const text = ((c.chief_complaint||'')+' '+(c.symptoms||[]).join(' ')).toLowerCase();
      return keywords.some(kw => text.includes(kw));
    });
  }

  // Build unique patient list
  const seen = new Set();
  const patients = [];

  // From appointments
  for (const a of appts) {
    if (!a.user_id) continue;
    const uid = a.user_id._id.toString();
    if (seen.has(uid)) continue;
    seen.add(uid);
    patients.push({
      _id:        a.user_id._id,
      full_name:  a.user_id.full_name,
      age:        a.user_id.age,
      gender:     a.user_id.gender,
      email:      a.user_id.email,
      source:     'appointment',
      last_visit: a.createdAt,
      status:     a.status,
    });
  }

  // From patient cases
  for (const c of patientCases) {
    if (!c.user_id) continue;
    const uid = c.user_id._id.toString();
    if (seen.has(uid)) continue;
    seen.add(uid);
    patients.push({
      _id:            c.user_id._id,
      full_name:      c.user_id.full_name,
      age:            c.user_id.age,
      gender:         c.user_id.gender,
      email:          c.user_id.email,
      source:         'case',
      last_visit:     c.createdAt,
      severity_label: c.severity_label,
      severity_score: c.severity_score,
      chief_complaint:c.chief_complaint,
      status:         c.status,
    });
  }

  res.json({ total: patients.length, patients });
};

// ── 5. GET FULL PATIENT PROFILE ──────────────────────────────────────────────
exports.getPatientProfile = async (req, res) => {
  const { userId } = req.params;
  const [user, cases, symptomChecks, reports, appointments] = await Promise.all([
    User.findById(userId).select('-password'),
    PatientCase.find({ user_id: userId }).sort({ createdAt:-1 }).limit(10),
    SymptomCheck.find({ user_id: userId }).sort({ createdAt:-1 }).limit(5),
    Report.find({ user_id: userId }).sort({ createdAt:-1 }).limit(5),
    Appointment.find({ user_id: userId }).sort({ createdAt:-1 }).limit(10),
  ]);
  if (!user) return res.status(404).json({ message: 'Patient not found.' });
  res.json({ patient: user, cases, symptomChecks, reports, appointments });
};

// ── 6. DOCTOR APPOINTMENTS (all appts booked with this doctor) ───────────────
exports.getDoctorAppointments = async (req, res) => {
  const { status, date } = req.query;
  const doctor   = await User.findById(req.user._id).select('full_name specialization');
  const doctorId = req.user._id.toString();

  // Match by doctor_user_id OR doctor_id OR doctor_name (for manual bookings)
  const nameRegex = doctor?.full_name
    ? new RegExp(doctor.full_name.replace(/^Dr\.\s*/i, '').trim(), 'i')
    : null;

  const orConditions = [
    { doctor_user_id: req.user._id },
    { doctor_id: doctorId },
  ];
  if (nameRegex) orConditions.push({ doctor_name: nameRegex });

  const filter = { $or: orConditions };
  if (status && status !== 'all') filter.status = status;
  if (date) filter.date = date;

  const appts = await Appointment.find(filter)
    .populate('user_id', 'full_name age gender email')
    .sort({ createdAt: -1 })
    .limit(100);

  res.json({ total: appts.length, appointments: appts });
};

// ── 7. UPDATE APPOINTMENT STATUS ─────────────────────────────────────────────
exports.updateAppointment = async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  const updates = {};
  if (status) updates.status = status;
  if (notes !== undefined) updates.notes = notes;

  const appt = await Appointment.findByIdAndUpdate(id, { $set: updates }, { new: true })
    .populate('user_id', 'full_name age gender email');
  if (!appt) return res.status(404).json({ message: 'Appointment not found.' });
  res.json({ appointment: appt });
};

// ── 8. RE-PRIORITIZE PATIENT CASE ────────────────────────────────────────────
exports.reprioritizePatients = async (req, res) => {
  const { case_id } = req.body;
  const patientCase = await PatientCase.findById(case_id).populate('user_id','full_name age gender');
  if (!patientCase) return res.status(404).json({ message: 'Case not found.' });

  try {
    const analysis = await groq.analyzePatientCaseSeverity({
      chief_complaint: patientCase.chief_complaint,
      symptoms:        patientCase.symptoms,
      age:             patientCase.user_id?.age,
      gender:          patientCase.user_id?.gender,
      duration:        patientCase.duration,
    });
    await PatientCase.findByIdAndUpdate(case_id, {
      severity_score:        analysis.severity_score || 0,
      severity_label:        analysis.severity_label || 'unknown',
      urgency:               analysis.urgency || 'within_week',
      recommended_specialty: analysis.recommended_specialty || '',
      llama_analysis:        analysis,
    });
    res.json({ message: 'Re-prioritized.', analysis });
  } catch (err) {
    res.status(500).json({ message: 'Llama analysis failed.', error: err.message });
  }
};

// ── 9. MARK CASE REVIEWED ────────────────────────────────────────────────────
exports.reviewCase = async (req, res) => {
  const { case_id, notes, status } = req.body;
  const updated = await PatientCase.findByIdAndUpdate(
    case_id,
    { $set: { status: status || 'reviewed', reviewed_by: req.user._id, notes } },
    { new: true }
  );
  if (!updated) return res.status(404).json({ message: 'Case not found.' });
  res.json({ message: 'Case updated.', case: updated });
};

// ── 10. ANALYTICS ────────────────────────────────────────────────────────────
exports.getAnalytics = async (req, res) => {
  const doctorId = req.user._id;
  const doctor   = await User.findById(doctorId).select('specialization');
  const specialty = doctor?.specialization || '';

  // Date ranges
  const now       = new Date();
  const today     = new Date(now.setHours(0,0,0,0));
  const last7     = new Date(Date.now() - 7 * 24*60*60*1000);
  const last30    = new Date(Date.now() - 30 * 24*60*60*1000);

  const [
    totalCases, pendingCases, criticalCases,
    totalAppts, todayAppts, completedAppts,
    casesSeverityBreakdown, specialtyBreakdown,
    monthlyCases,
  ] = await Promise.all([
    PatientCase.countDocuments(),
    PatientCase.countDocuments({ status: 'pending' }),
    PatientCase.countDocuments({ severity_label: { $in: ['critical','emergency'] } }),
    Appointment.countDocuments({ $or: [{ doctor_user_id: doctorId }, { doctor_id: doctorId.toString() }] }),
    Appointment.countDocuments({ $or: [{ doctor_user_id: doctorId }, { doctor_id: doctorId.toString() }], createdAt: { $gte: today } }),
    Appointment.countDocuments({ $or: [{ doctor_user_id: doctorId }, { doctor_id: doctorId.toString() }], status: 'completed' }),
    PatientCase.aggregate([
      { $group: { _id: '$severity_label', count: { $sum: 1 } } }
    ]),
    PatientCase.aggregate([
      { $match: { recommended_specialty: { $ne: '' } } },
      { $group: { _id: '$recommended_specialty', count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 8 }
    ]),
    // Monthly new cases (last 6 months)
    PatientCase.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 180*24*60*60*1000) } } },
      { $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        count: { $sum: 1 },
        critical: { $sum: { $cond: [{ $in: ['$severity_label',['critical','emergency']] }, 1, 0] } },
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]),
  ]);

  // Urgency breakdown
  const urgencyBreakdown = await PatientCase.aggregate([
    { $group: { _id: '$urgency', count: { $sum: 1 } } }
  ]);

  // Status breakdown
  const statusBreakdown = await PatientCase.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const MONTH_NAMES = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthlyFormatted = monthlyCases.map(m => ({
    label:    MONTH_NAMES[m._id.month],
    cases:    m.count,
    critical: m.critical,
  }));

  res.json({
    stats: {
      total_cases:     totalCases,
      pending_cases:   pendingCases,
      critical_cases:  criticalCases,
      total_appts:     totalAppts,
      today_appts:     todayAppts,
      completed_appts: completedAppts,
    },
    severity_breakdown:  casesSeverityBreakdown,
    specialty_breakdown: specialtyBreakdown,
    urgency_breakdown:   urgencyBreakdown,
    status_breakdown:    statusBreakdown,
    monthly_trend:       monthlyFormatted,
    specialty,
  });
};

// ── 11. DASHBOARD STATS (summary for overview tab) ───────────────────────────
exports.getDoctorStats = exports.getAnalytics;