/**
 * MediCore — Prescription Controller
 * Doctor writes prescriptions → stored in MongoDB → patient can view them
 */

const User         = require('../models/User');
const { Prescription } = require('../models/index');

// ── 1. CREATE PRESCRIPTION ────────────────────────────────────────────────────
exports.createPrescription = async (req, res) => {
  const {
    patient_user_id, patient_name,
    diagnosis, medicines, tests_advised, advice, follow_up,
  } = req.body;

  if (!medicines || medicines.length === 0) return res.status(400).json({ message: 'At least one medicine is required.' });
  if (!patient_name && !patient_user_id) return res.status(400).json({ message: 'Patient name or patient selection is required.' });

  const doctor = await User.findById(req.user._id).select('full_name specialization');

  const rx = await Prescription.create({
    doctor_user_id:   req.user._id,
    patient_user_id,
    doctor_name:      doctor?.full_name || 'Doctor',
    doctor_specialty: doctor?.specialization || '',
    patient_name:     patient_name || 'Patient',
    diagnosis,
    medicines,
    tests_advised:    tests_advised || [],
    advice,
    follow_up,
  });

  res.status(201).json({ message: 'Prescription created.', prescription: rx });
};

// ── 2. LIST PRESCRIPTIONS WRITTEN BY THIS DOCTOR ─────────────────────────────
exports.listDoctorPrescriptions = async (req, res) => {
  const { patient_id } = req.query;
  const filter = { doctor_user_id: req.user._id };
  if (patient_id) filter.patient_user_id = patient_id;

  const rxs = await Prescription.find(filter)
    .populate('patient_user_id', 'full_name age gender email')
    .sort({ createdAt: -1 });

  res.json({ prescriptions: rxs, total: rxs.length });
};

// ── 3. GET SINGLE PRESCRIPTION ────────────────────────────────────────────────
exports.getPrescription = async (req, res) => {
  const rx = await Prescription.findById(req.params.id)
    .populate('doctor_user_id',  'full_name specialization hospital')
    .populate('patient_user_id', 'full_name age gender email');
  if (!rx) return res.status(404).json({ message: 'Prescription not found.' });
  res.json({ prescription: rx });
};

// ── 4. UPDATE PRESCRIPTION ────────────────────────────────────────────────────
exports.updatePrescription = async (req, res) => {
  const { diagnosis, medicines, tests_advised, advice, follow_up, status } = req.body;
  const updates = {};
  if (diagnosis     !== undefined) updates.diagnosis     = diagnosis;
  if (medicines     !== undefined) updates.medicines     = medicines;
  if (tests_advised !== undefined) updates.tests_advised = tests_advised;
  if (advice        !== undefined) updates.advice        = advice;
  if (follow_up     !== undefined) updates.follow_up     = follow_up;
  if (status        !== undefined) updates.status        = status;

  const rx = await Prescription.findOneAndUpdate(
    { _id: req.params.id, doctor_user_id: req.user._id },
    { $set: updates },
    { new: true }
  );
  if (!rx) return res.status(404).json({ message: 'Prescription not found or unauthorized.' });
  res.json({ message: 'Updated.', prescription: rx });
};

// ── 5. DELETE PRESCRIPTION ────────────────────────────────────────────────────
exports.deletePrescription = async (req, res) => {
  await Prescription.findOneAndDelete({ _id: req.params.id, doctor_user_id: req.user._id });
  res.json({ message: 'Deleted.' });
};

// ── 6. PATIENT — VIEW MY PRESCRIPTIONS ───────────────────────────────────────
exports.myPrescriptions = async (req, res) => {
  const rxs = await Prescription.find({ patient_user_id: req.user._id })
    .populate('doctor_user_id', 'full_name specialization hospital')
    .sort({ createdAt: -1 });
  res.json({ prescriptions: rxs, total: rxs.length });
};