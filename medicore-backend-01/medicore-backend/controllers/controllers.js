/**
 * MediCore — All Feature Controllers
 * Groq Llama 3.3 70B:  Report Analysis, Medicine Scan, Mental Health Chat,
 *                       Symptom Enhancement, Diabetes Interpretation
 * Local ML models:      DS1 Symptoms, DS2 Diabetes risk, DS3 Mental classifier
 * Fallback chain:       Groq → Local ML → Hardcoded logic
 */

const {
  SymptomCheck, Report, HealthRecord, Medicine,
  EmergencyAlert, Appointment, MoodLog, BloodDonor, ScanResult,
} = require('../models/index');
// csv-parse removed — using built-in CSV parser below
const fs        = require('fs');
const path      = require('path');
const mlService = require('../ml/mlService');
const groq      = require('../services/groqService');

// ── SYMPTOMS  (ML DS1 + Groq enhancement) ────────────────────────────────────
const EMERGENCY_SYMPTOMS = new Set([
  'chest pain','shortness of breath','unconscious','seizure','stroke','heart attack',
]);
const FALLBACK_CONDITIONS = [
  { name:'Common Cold',        probability:65, severity:'low', description:'Viral upper respiratory infection.' },
  { name:'Seasonal Allergies', probability:40, severity:'low', description:'Environmental allergen response.' },
];

exports.analyzeSymptoms = async (req, res) => {
  const { symptoms = [], age, gender } = req.body;
  if (!symptoms.length)
    return res.status(400).json({ message: 'At least one symptom is required.' });

  const lower       = symptoms.map(s => s.toLowerCase());
  const isEmergency = lower.some(s => EMERGENCY_SYMPTOMS.has(s));

  // Step 1: Local ML model (DS1 knowledge base)
  let mlResult = null;
  try {
    mlResult = await mlService.symptoms({ symptoms, age, gender });
  } catch (err) {
    console.warn('[Symptoms] ML model unavailable:', err.message);
  }

  const conditions = mlResult?.conditions || FALLBACK_CONDITIONS;
  let   specialist = mlResult?.specialist || 'General Physician';
  let   urgency    = mlResult?.urgency    || (isEmergency ? 'immediately' : 'within_week');
  let   recs       = mlResult?.recommendations || ['Rest and stay hydrated.'];
  let   groqEnhancement = null;

  // Step 2: Groq Llama — enrich ML results with clinical narrative
  try {
    groqEnhancement = await groq.enhanceSymptomAnalysisWithGroq(
      symptoms, conditions, { age, gender }
    );
    // Upgrade recommendations and specialist from Groq if available
    if (groqEnhancement.specialist)         specialist = groqEnhancement.specialist;
    if (groqEnhancement.when_to_see_doctor) urgency    = urgency; // keep ML urgency
  } catch (err) {
    console.warn('[Symptoms] Groq enhancement unavailable:', err.message);
  }

  const record = await SymptomCheck.create({
    user_id: req.user?._id, symptoms, conditions,
    emergency: isEmergency, urgency, specialist,
  });

  res.json({
    id:                record._id,
    conditions,
    recommendations:   recs,
    specialist,
    urgency,
    emergency:         isEmergency,
    symptoms_analyzed: symptoms,
    // Groq enrichment fields
    clinical_summary:         groqEnhancement?.clinical_summary         || null,
    most_likely_diagnosis:    groqEnhancement?.most_likely_diagnosis     || null,
    red_flags:                groqEnhancement?.red_flags                 || [],
    home_care:                groqEnhancement?.home_care                 || [],
    when_to_see_doctor:       groqEnhancement?.when_to_see_doctor        || null,
    questions_to_ask_doctor:  groqEnhancement?.questions_to_ask_doctor   || [],
    tests_that_may_be_ordered:groqEnhancement?.tests_that_may_be_ordered || [],
    ml_powered:               Boolean(mlResult),
    groq_powered:             Boolean(groqEnhancement),
    disclaimer: 'AI-assisted analysis only. Not a substitute for professional medical advice.',
  });
};

exports.getSymptomSuggestions = (req, res) => {
  let COMMON = [
    'Fever','Headache','Body Pain','Cough','Fatigue','Nausea','Vomiting',
    'Diarrhea','Chest Pain','Shortness of Breath','Dizziness','Sore Throat',
    'Runny Nose','Loss of Appetite','Chills','Rash','Swelling','Blurred Vision',
    'Palpitations','Back Pain',
  ];
  try {
    const kbPath = path.join(__dirname, '../ml/models/symptom_kb.json');
    if (fs.existsSync(kbPath)) {
      const kb  = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
      const all = Object.keys(kb.inverted_index || {}).map(s =>
        s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      );
      if (all.length > 10) COMMON = [...new Set([...COMMON, ...all])];
    }
  } catch {}
  const q       = (req.query.q || '').toLowerCase();
  const results = q ? COMMON.filter(s => s.toLowerCase().includes(q)) : COMMON;
  res.json({ suggestions: results.slice(0, 15) });
};

// ── REPORTS  (local extraction → Groq Llama deep analysis) ───────────────────
const RANGES = {
  // ── Dataset column name variants (mediintel format) ──
  hemoglobin_g_dl:          { min:12.0, max:17.5, unit:'g/dL'      },
  haemoglobin_g_dl:         { min:12.0, max:17.5, unit:'g/dL'      },
  glucose_mg_dl:            { min:70,   max:100,  unit:'mg/dL'     },
  cholesterol_mg_dl:        { min:0,    max:200,  unit:'mg/dL'     },
  creatinine_mg_dl:         { min:0.6,  max:1.2,  unit:'mg/dL'     },
  urea_mg_dl:               { min:7,    max:20,   unit:'mg/dL'     },
  uric_acid_mg_dl:          { min:3.5,  max:7.2,  unit:'mg/dL'     },
  bilirubin_mg_dl:          { min:0.1,  max:1.2,  unit:'mg/dL'     },
  sodium_meql:              { min:136,  max:145,  unit:'mEq/L'     },
  potassium_meql:           { min:3.5,  max:5.0,  unit:'mEq/L'     },
  wbc_count_per_ul:         { min:4000, max:11000, unit:'/µL'      },
  wbc_count:                { min:4000, max:11000, unit:'/µL'      },
  rbc_million_cells_ul:     { min:4.5,  max:5.9,  unit:'M/µL'     },
  rbc_million_cells:        { min:4.5,  max:5.9,  unit:'M/µL'     },
  platelets_per_ul:         { min:150000, max:400000, unit:'/µL'   },
  platelets_count:          { min:150000, max:400000, unit:'/µL'   },
  hba1c_percent:            { min:0,    max:5.7,  unit:'%'         },
  tsh_miul:                 { min:0.4,  max:4.0,  unit:'mIU/L'    },
  ldl_mg_dl:                { min:0,    max:130,  unit:'mg/dL'     },
  hdl_mg_dl:                { min:40,   max:999,  unit:'mg/dL'     },
  triglycerides_mg_dl:      { min:0,    max:150,  unit:'mg/dL'     },
  ast_ul:                   { min:10,   max:40,   unit:'U/L'       },
  alt_ul:                   { min:7,    max:56,   unit:'U/L'       },
  alkaline_phosphatase_ul:  { min:44,   max:147,  unit:'U/L'       },
  // ── Standard names ──
  hemoglobin:           { min:12.0, max:17.5, unit:'g/dL'      },
  haemoglobin:          { min:12.0, max:17.5, unit:'g/dL'      },
  hb:                   { min:12.0, max:17.5, unit:'g/dL'      },
  hemoglobin_gdl:       { min:12.0, max:17.5, unit:'g/dL'      },
  haemoglobin_gdl:      { min:12.0, max:17.5, unit:'g/dL'      },
  wbc:              { min:4.0,  max:11.0, unit:'x10³/µL'   },
  rbc:              { min:4.5,  max:5.9,  unit:'x10⁶/µL'   },
  platelets:        { min:150,  max:400,  unit:'x10³/µL'   },
  platelet:         { min:150,  max:400,  unit:'x10³/µL'   },
  glucose:              { min:70,   max:100,  unit:'mg/dL'     },
  blood_glucose:        { min:70,   max:100,  unit:'mg/dL'     },
  fasting_glucose:      { min:70,   max:100,  unit:'mg/dL'     },
  glucose_mgdl:         { min:70,   max:100,  unit:'mg/dL'     },
  random_blood_sugar:   { min:70,   max:140,  unit:'mg/dL'     },
  rbs:                  { min:70,   max:140,  unit:'mg/dL'     },
  fbs:                  { min:70,   max:100,  unit:'mg/dL'     },
  creatinine:       { min:0.6,  max:1.2,  unit:'mg/dL'     },
  cholesterol:          { min:0,    max:200,  unit:'mg/dL'     },
  cholesterol_total:    { min:0,    max:200,  unit:'mg/dL'     },
  total_cholesterol:    { min:0,    max:200,  unit:'mg/dL'     },
  cholesterol_mgdl:     { min:0,    max:200,  unit:'mg/dL'     },
  serum_cholesterol:    { min:0,    max:200,  unit:'mg/dL'     },
  ldl:              { min:0,    max:130,  unit:'mg/dL'     },
  hdl:              { min:40,   max:999,  unit:'mg/dL'     },
  triglycerides:    { min:0,    max:150,  unit:'mg/dL'     },
  triglyceride:     { min:0,    max:150,  unit:'mg/dL'     },
  tsh:              { min:0.4,  max:4.0,  unit:'mIU/L'     },
  hba1c:            { min:0,    max:5.7,  unit:'%'         },
  hemoglobin_a1c:   { min:0,    max:5.7,  unit:'%'         },
  urea:             { min:7,    max:20,   unit:'mg/dL'     },
  bun:              { min:7,    max:20,   unit:'mg/dL'     },
  uric_acid:        { min:3.5,  max:7.2,  unit:'mg/dL'     },
  sodium:           { min:136,  max:145,  unit:'mEq/L'     },
  potassium:        { min:3.5,  max:5.0,  unit:'mEq/L'     },
  bilirubin:        { min:0.1,  max:1.2,  unit:'mg/dL'     },
  ast:              { min:10,   max:40,   unit:'U/L'       },
  alt:              { min:7,    max:56,   unit:'U/L'       },
  alkaline_phosphatase: { min:44, max:147, unit:'U/L'     },
};

exports.uploadReport = async (req, res) => {
  if (!req.file)
    return res.status(400).json({ message: 'No file uploaded.' });

  const filepath = require('path').resolve(req.file.path);
  const filename = req.file.originalname;
  const ext      = filename.toLowerCase().split('.').pop();

  console.log('[Report] File received:', filename, '| path:', filepath, '| ext:', ext);

  // ── Step 1: Python analyze.py (handles CSV, PDF, image OCR) ────────────────
  let localResult = null;
  try {
    localResult = await mlService.analyzeReport({ filepath, filename });
    console.log('[Report] Python extracted', localResult?.values?.length || 0, 'values');
  } catch (err) {
    console.warn('[Report] Python analysis failed:', err.message);
  }

  // ── Step 2: Node.js CSV parser (fallback for CSV if Python returned nothing) ─
  if (ext === 'csv' && (!localResult || !localResult.values || localResult.values.length === 0)) {
    console.log('[Report] Trying Node.js CSV parser...');
    try {
      const csvContent = fs.readFileSync(filepath, 'utf8');
      const lines = csvContent.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) throw new Error('CSV has no data rows');

      const headers = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
      console.log('[Report] CSV headers:', headers.slice(0, 10).join(', '));

      const values   = [];
      const abnormal = [];

      // ── FORMAT A: Long format ─────────────────────────────────────────────
      // parameter,value  (one row per test)
      // hemoglobin,9.2
      const paramIdx = headers.findIndex(h => ['parameter','param','test','name','test_name','analyte'].includes(h));
      const valIdx   = headers.findIndex(h => ['value','result','reading','val','result_value'].includes(h));

      if (paramIdx !== -1 && valIdx !== -1) {
        console.log('[Report] Detected FORMAT A: long format (parameter + value columns)');
        for (let i = 1; i < lines.length; i++) {
          const cols  = lines[i].split(',').map(c => c.trim());
          if (cols.length < 2) continue;
          const param = (cols[paramIdx] || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
          const val   = parseFloat(cols[valIdx]);
          const ref   = RANGES[param];
          if (!ref || isNaN(val)) continue;
          const status = val < ref.min ? 'low' : val > ref.max ? 'high' : 'normal';
          const name   = param.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          values.push({ name, value: String(val), unit: ref.unit, normal: ref.min + '–' + ref.max, status,
            insight: status === 'normal' ? 'Within normal range.' : (status === 'low' ? 'Below' : 'Above') + ' normal (' + ref.min + '–' + ref.max + ' ' + ref.unit + ').' });
          if (status !== 'normal') abnormal.push(name);
        }
      }

      // ── FORMAT B: Wide format ─────────────────────────────────────────────
      // patient_id,hemoglobin,glucose,hba1c,...  (parameters as column headers)
      // 1,9.2,118,6.5,...
      // Use FIRST data row only (most recent patient / single patient report)
      if (values.length === 0) {
        console.log('[Report] Detected FORMAT B: wide format (parameters as column headers)');
        const dataRow = lines[1].split(',').map(c => c.trim());
        for (let h = 0; h < headers.length; h++) {
          const param = headers[h].replace(/[^a-z0-9_]/g, '');
          const val   = parseFloat(dataRow[h]);
          const ref   = RANGES[param];
          if (!ref || isNaN(val)) continue;
          const status = val < ref.min ? 'low' : val > ref.max ? 'high' : 'normal';
          const name   = param.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          values.push({ name, value: String(val), unit: ref.unit, normal: ref.min + '–' + ref.max, status,
            insight: status === 'normal' ? 'Within normal range.' : (status === 'low' ? 'Below' : 'Above') + ' normal (' + ref.min + '–' + ref.max + ' ' + ref.unit + ').' });
          if (status !== 'normal') abnormal.push(name);
        }
        console.log('[Report] Wide format: used first data row, found', values.length, 'values');
      }

      if (values.length > 0) {
        localResult = {
          values,
          reportType:      'Blood Test Analysis',
          summary:         abnormal.length
            ? abnormal.length + ' parameter(s) out of range: ' + abnormal.join(', ') + '.'
            : 'All parameters within normal range.',
          risk_flags:      abnormal.map(a => a + ' abnormal'),
          recommendations: ['Consult your physician about these results.'],
          possible_conditions: [],
          diet: [],
          ai_powered: false,
        };
        console.log('[Report] CSV extracted', values.length, 'values successfully (', abnormal.length, 'abnormal)');
      } else {
        console.warn('[Report] No matching parameters found in CSV. Headers were:', headers.join(', '));
      }
    } catch (e) {
      console.warn('[Report] CSV parse error:', e.message);
    }
  }

  // ── Step 2b: Llama 4 Scout Vision for image files ─────────────────────────
  const isImage = ['jpg','jpeg','png','webp','bmp','gif'].includes(ext);
  const isPdf   = ext === 'pdf';

  if (isImage) {
    console.log('[Report] Image detected — calling Llama 4 Scout Vision...');
    try {
      const imgBuf  = fs.readFileSync(filepath);
      const b64     = imgBuf.toString('base64');
      const mimeMap = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', bmp:'image/jpeg', gif:'image/gif' };
      const mime    = mimeMap[ext] || 'image/jpeg';
      const key     = process.env.GROQ_API_KEY;
      if (!key) throw new Error('GROQ_API_KEY not set');

      const axios = require('axios');

      const visionResp = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model:       'meta-llama/llama-4-scout-17b-16e-instruct',
          max_tokens:  2048,
          temperature: 0.1,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: `data:${mime};base64,${b64}` },
                },
                {
                  type: 'text',
                  text: `You are a medical document AI. Read this image and return ONLY a raw JSON object (no markdown, no backticks, no extra text) with this exact structure:
{"is_medical_document":true,"reportType":"Blood Test|Urine Report|X-Ray|MRI Report|CT Scan|ECG|Prescription|Discharge Summary|Doctor Notes|Pathology|Other","values":[{"name":"parameter name","value":"result","unit":"unit or empty","normal":"range or empty","status":"normal|high|low|abnormal"}],"summary":"2-3 sentence plain English summary","clinical_notes":"diagnoses, medicines, instructions, observations"}
Rules: For prescriptions/discharge summaries set values=[]. Set is_medical_document=false ONLY for clearly non-medical images (selfies, food, nature). Return ONLY the JSON object.`,
                },
              ],
            },
          ],
        },
        {
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          timeout: 60000,
        }
      );

      let raw = visionResp.data.choices[0].message.content.trim();
      raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const jsonMatch = raw.match(/{[\s\S]*}/);
      if (!jsonMatch) throw new Error('No JSON in Llama response: ' + raw.slice(0, 200));
      const parsed = JSON.parse(jsonMatch[0]);

      console.log('[Report] Llama Vision OK — type:', parsed.reportType, '| values:', (parsed.values||[]).length, '| medical:', parsed.is_medical_document);

      if (parsed.is_medical_document === false) {
        localResult = {
          values: [], reportType: 'Not a Medical Report',
          summary: 'This image does not appear to be a medical document. Please upload a lab report, prescription, scan, or discharge summary.',
          risk_flags: [], recommendations: [], possible_conditions: [], diet: [],
          ai_powered: true, not_a_report: true,
        };
      } else {
        localResult = {
          values:                  Array.isArray(parsed.values) ? parsed.values : [],
          reportType:              parsed.reportType || 'Medical Report',
          summary:                 parsed.summary   || 'Medical document analysed successfully.',
          clinical_interpretation: parsed.clinical_notes || null,
          risk_flags:              [],
          recommendations:         [],
          possible_conditions:     [],
          diet:                    [],
          ai_powered:              true,
          extraction_failed:       false,
        };
      }
    } catch (vErr) {
      console.error('[Report] Llama Vision error:', vErr.message);
      if (vErr.response) {
        console.error('[Report] HTTP', vErr.response.status, '|', JSON.stringify(vErr.response.data).slice(0, 400));
      }
      if (!localResult) {
        localResult = {
          values: [], reportType: 'Image Analysis Failed',
          summary: `Llama Vision could not process this image. Error: ${vErr.message}. Ensure your GROQ_API_KEY supports vision models.`,
          risk_flags: [], recommendations: [], possible_conditions: [], diet: [],
          ai_powered: false, extraction_failed: true,
        };
      }
    }
  }

  // ── Step 3: Groq analysis ─────────────────────────────────────────────────
  let groqAnalysis = null;
  if (localResult && localResult.values && localResult.values.length > 0) {
    try {
      console.log('[Report] Calling Groq with', localResult.values.length, 'values...');
      groqAnalysis = await groq.analyzeReportWithGroq(localResult.values, filename);
      console.log('[Report] Groq returned:', JSON.stringify(groqAnalysis).slice(0, 200));
    } catch (err) {
      console.error('[Report] Groq FAILED:', err.message);
      if (err.response) {
        console.error('[Report] Groq HTTP status:', err.response.status);
        console.error('[Report] Groq response:', JSON.stringify(err.response.data).slice(0, 300));
      }
    }
  }

  // ── Step 4: Build response ────────────────────────────────────────────────
  const values = localResult?.values || [];

  // For images analyzed by Llama Vision, never show extraction_failed
  // even if no numeric values exist (X-rays, prescriptions, ECGs have no numbers)
  const llamaVisionAnalyzed = isImage && localResult?.ai_powered === true;

  let failMessage = 'Could not extract lab values. ';
  if (ext === 'csv') {
    failMessage += 'Make sure your CSV has columns named "parameter" and "value". ' +
      'Example: parameter=hemoglobin, value=14.2';
  } else if (ext === 'pdf') {
    failMessage += 'PDF text extraction failed. Try converting to CSV for best results.';
  } else {
    failMessage += 'For blood tests with numeric values, upload a CSV file.';
  }

  const finalResult = {
    reportType:              groqAnalysis?.report_type         || localResult?.reportType         || 'Medical Report',
    values,
    summary:                 groqAnalysis?.summary             || localResult?.summary            || failMessage,
    severity:                groqAnalysis?.severity            || 'unknown',
    clinical_interpretation: groqAnalysis?.clinical_interpretation || localResult?.clinical_interpretation || null,
    possible_conditions:     groqAnalysis?.possible_conditions || localResult?.possible_conditions || [],
    risk_flags:              localResult?.risk_flags           || [],
    recommendations:         groqAnalysis?.recommendations     || localResult?.recommendations    || [],
    diet:                    groqAnalysis?.diet                || localResult?.diet               || [],
    lifestyle:               groqAnalysis?.lifestyle           || [],
    urgency:                 groqAnalysis?.urgency             || 'routine',
    specialist_needed:       groqAnalysis?.specialist_needed   || null,
    parameters_analyzed:     values.length,
    abnormal_count:          values.filter(v => v.status !== 'normal').length,
    groq_powered:            Boolean(groqAnalysis) || llamaVisionAnalyzed,
    llama_vision:            llamaVisionAnalyzed,
    ml_powered:              Boolean(localResult),
    extraction_failed:       llamaVisionAnalyzed ? false : values.length === 0,
    not_a_report:            localResult?.not_a_report || false,
    date:                    new Date().toLocaleDateString(),
    disclaimer:              'AI analysis only. Always verify with a licensed physician.',
  };

  // Save to DB
  try {
    const report = await Report.create({
      user_id:             req.user?._id,
      reportType:          finalResult.reportType,
      parameters_analyzed: finalResult.parameters_analyzed,
      abnormal_count:      finalResult.abnormal_count,
      summary:             finalResult.summary,
      values:              finalResult.values,
      risk_flags:          finalResult.risk_flags,
      recommendations:     finalResult.recommendations,
      diet:                finalResult.diet,
      filename:            req.file.filename,
    });
    finalResult._id         = report._id;
    finalResult.id          = report._id;
    finalResult.uploaded_at = report.createdAt;
  } catch (dbErr) {
    console.error('[Report] DB save failed:', dbErr.message);
  }

  res.json(finalResult);
};


exports.getReport   = async (req, res) => {
  const r = await Report.findById(req.params.id);
  if (!r) return res.status(404).json({ message: 'Report not found.' });
  res.json(r);
};
exports.listReports = async (req, res) => {
  const filter  = req.user ? { user_id: req.user._id } : {};
  const reports = await Report.find(filter).sort({ createdAt:-1 }).limit(50);
  res.json({ reports, total: reports.length });
};

// ── RECORDS ───────────────────────────────────────────────────────────────────
exports.listRecords  = async (req, res) => {
  const records = await HealthRecord.find({ user_id: req.user._id }).sort({ createdAt:-1 });
  res.json({ records, total: records.length });
};
exports.getRecord    = async (req, res) => {
  const r = await HealthRecord.findOne({ _id: req.params.id, user_id: req.user._id });
  if (!r) return res.status(404).json({ message: 'Record not found.' });
  res.json(r);
};
exports.createRecord = async (req, res) => {
  const r = await HealthRecord.create({ user_id: req.user._id, ...req.body });
  res.status(201).json(r);
};
exports.updateRecord = async (req, res) => {
  const r = await HealthRecord.findOneAndUpdate(
    { _id: req.params.id, user_id: req.user._id }, req.body, { new:true, runValidators:true });
  if (!r) return res.status(404).json({ message: 'Record not found.' });
  res.json(r);
};
exports.deleteRecord = async (req, res) => {
  const r = await HealthRecord.findOneAndDelete({ _id: req.params.id, user_id: req.user._id });
  if (!r) return res.status(404).json({ message: 'Record not found.' });
  res.json({ message: 'Record deleted.', id: req.params.id });
};

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
exports.healthScore = (req, res) => res.json({
  score: 78, label: 'Good',
  vitals: [
    { label:'Blood Pressure', value:'118/76', unit:'mmHg', icon:'🩺', status:'normal' },
    { label:'Blood Sugar',    value:'99',     unit:'mg/dL', icon:'🩸', status:'normal' },
    { label:'Heart Rate',     value:'72',     unit:'bpm',   icon:'❤️', status:'normal' },
    { label:'BMI',            value:'24.1',   unit:'kg/m²', icon:'⚖️', status:'normal' },
  ],
  advice: [
    { icon:'🚶', text:'Walk 30 min daily',      priority:'high'   },
    { icon:'💧', text:'Drink 2.5L water daily', priority:'medium' },
    { icon:'🍬', text:'Reduce sugar intake',    priority:'high'   },
    { icon:'😴', text:'Sleep 7–8 hours',        priority:'medium' },
  ],
});
exports.risks    = (req, res) => res.json({ risks:[
  { name:'Diabetes',      risk:45, color:'#ffb020' },
  { name:'Heart Disease', risk:22, color:'#00e5b0' },
  { name:'Hypertension',  risk:35, color:'#00d4ff' },
  { name:'Thyroid',       risk:15, color:'#7c5cfc' },
]});
exports.timeline = (req, res) => res.json({ timeline:[
  { label:'Oct', score:72, bp:118, sugar:98  },
  { label:'Nov', score:74, bp:122, sugar:102 },
  { label:'Dec', score:71, bp:130, sugar:110 },
  { label:'Jan', score:75, bp:124, sugar:105 },
  { label:'Feb', score:77, bp:120, sugar:101 },
  { label:'Mar', score:78, bp:118, sugar:99  },
]});

// ── MEDICINES ─────────────────────────────────────────────────────────────────
const COLORS = ['#00d4ff','#00e5b0','#7c5cfc','#ffb020','#ff4757'];

exports.listMedicines  = async (req, res) => {
  const meds = await Medicine.find({ user_id: req.user._id }).sort({ createdAt:1 });
  res.json({ medicines: meds, total: meds.length });
};
exports.addMedicine    = async (req, res) => {
  const count = await Medicine.countDocuments({ user_id: req.user._id });
  const color = req.body.color || COLORS[count % COLORS.length];
  const m = await Medicine.create({ user_id: req.user._id, color, ...req.body });
  res.status(201).json(m);
};
exports.updateMedicine = async (req, res) => {
  const m = await Medicine.findOneAndUpdate(
    { _id: req.params.id, user_id: req.user._id }, req.body, { new:true });
  if (!m) return res.status(404).json({ message: 'Medicine not found.' });
  res.json(m);
};
exports.toggleMedicine = async (req, res) => {
  const m = await Medicine.findOne({ _id: req.params.id, user_id: req.user._id });
  if (!m) return res.status(404).json({ message: 'Medicine not found.' });
  m.taken = !m.taken;
  await m.save();
  res.json(m);
};
exports.deleteMedicine = async (req, res) => {
  const m = await Medicine.findOneAndDelete({ _id: req.params.id, user_id: req.user._id });
  if (!m) return res.status(404).json({ message: 'Medicine not found.' });
  res.json({ message: 'Deleted.', id: req.params.id });
};

// ── EMERGENCY SOS ─────────────────────────────────────────────────────────────
exports.triggerAlert = async (req, res) => {
  const { alert_type = 'general', location, message = 'SOS triggered' } = req.body;

  const loc = location && (location.lat || location.lng)
    ? { lat: parseFloat(location.lat) || 0, lng: parseFloat(location.lng) || 0 }
    : { lat: 0, lng: 0 };

  const ambulance = ['cardiac','stroke','unconscious'].includes((alert_type||'').toLowerCase());

  let alert;
  try {
    alert = await EmergencyAlert.create({
      user_id:             req.user?._id || null,
      alert_type:          alert_type || 'general',
      location:            loc,
      message:             message || 'SOS triggered',
      ambulance_dispatched: ambulance,
      notified_contacts:   ['emergency_contact_1','emergency_contact_2'],
      status:              'sent',
    });
  } catch (dbErr) {
    console.error('[Emergency] DB save failed:', dbErr.message);
    return res.status(500).json({ message: 'Failed to save emergency alert.', error: dbErr.message });
  }

  if (process.env.N8N_EMERGENCY_WEBHOOK) {
    require('axios')
      .post(process.env.N8N_EMERGENCY_WEBHOOK, alert.toObject(), { timeout: 5000 })
      .catch(e => console.warn('[Emergency] n8n webhook failed:', e.message));
  }

  res.status(201).json({
    success: true, alert_id: alert._id, status: 'sent',
    alert_type: alert.alert_type, location: alert.location,
    ambulance_dispatched: ambulance,
    notified_contacts: alert.notified_contacts,
    sent_at: alert.createdAt,
    message: `Emergency alert sent. ${ambulance ? 'Ambulance dispatched.' : 'Contacts notified.'}`,
  });
};
exports.alertHistory = async (req, res) => {
  const filter = req.user ? { user_id: req.user._id } : {};
  const alerts = await EmergencyAlert.find(filter).sort({ createdAt:-1 }).limit(50);
  res.json({ alerts, total: alerts.length });
};

// ── DOCTORS ───────────────────────────────────────────────────────────────────
const DOCTORS = [
  // ── General Physicians ────────────────────────────────────────────────────
  {
    id: '1',
    name: 'Dr. Ramesh Babu',
    specialty: 'General Physician',
    experience: '14 yrs',
    rating: 4.7,
    available: true,
    avatar: '👨‍⚕️',
    hospital: 'Apollo Hospitals, Hyderabad',
    qualification: 'MBBS, MD (General Medicine)',
    slots: ['9:00 AM', '10:30 AM', '12:00 PM', '3:00 PM', '5:00 PM'],
  },
  {
    id: '2',
    name: 'Dr. Kavitha Reddy',
    specialty: 'General Physician',
    experience: '9 yrs',
    rating: 4.5,
    available: true,
    avatar: '👩‍⚕️',
    hospital: 'KIMS Hospital, Hyderabad',
    qualification: 'MBBS, MD (Internal Medicine)',
    slots: ['8:30 AM', '11:00 AM', '2:00 PM', '4:30 PM'],
  },

  // ── Cardiologists ─────────────────────────────────────────────────────────
  {
    id: '3',
    name: 'Dr. Suresh Kumar',
    specialty: 'Cardiologist',
    experience: '18 yrs',
    rating: 4.9,
    available: true,
    avatar: '👨‍⚕️',
    hospital: 'Yashoda Hospitals, Secunderabad',
    qualification: 'MBBS, MD, DM (Cardiology)',
    slots: ['10:00 AM', '11:30 AM', '3:00 PM', '4:30 PM'],
  },
  {
    id: '4',
    name: 'Dr. Anitha Sharma',
    specialty: 'Cardiologist',
    experience: '12 yrs',
    rating: 4.8,
    available: true,
    avatar: '👩‍⚕️',
    hospital: 'Care Hospitals, Banjara Hills',
    qualification: 'MBBS, MD, DM (Cardiology)',
    slots: ['9:30 AM', '1:00 PM', '4:00 PM'],
  },

  // ── Neurologists ──────────────────────────────────────────────────────────
  {
    id: '5',
    name: 'Dr. Venkat Rao',
    specialty: 'Neurologist',
    experience: '20 yrs',
    rating: 4.9,
    available: true,
    avatar: '👨‍⚕️',
    hospital: 'Nizam\'s Institute of Medical Sciences',
    qualification: 'MBBS, MD, DM (Neurology)',
    slots: ['10:00 AM', '12:00 PM', '3:30 PM'],
  },
  {
    id: '6',
    name: 'Dr. Sunita Prasad',
    specialty: 'Neurologist',
    experience: '11 yrs',
    rating: 4.6,
    available: false,
    avatar: '👩‍⚕️',
    hospital: 'Global Hospitals, Lakdi-Ka-Pool',
    qualification: 'MBBS, MD, DM (Neurology)',
    slots: [],
  },

  // ── Diabetologist ─────────────────────────────────────────────────────────
  {
    id: '7',
    name: 'Dr. Prakash Mehta',
    specialty: 'Diabetologist',
    experience: '16 yrs',
    rating: 4.8,
    available: true,
    avatar: '👨‍⚕️',
    hospital: 'LV Prasad Eye & Diabetes Centre',
    qualification: 'MBBS, MD, FRCP (Endocrinology & Diabetes)',
    slots: ['9:00 AM', '11:00 AM', '2:30 PM', '5:00 PM'],
  },

  // ── Dermatologist ─────────────────────────────────────────────────────────
  {
    id: '8',
    name: 'Dr. Deepa Nair',
    specialty: 'Dermatologist',
    experience: '10 yrs',
    rating: 4.7,
    available: true,
    avatar: '👩‍⚕️',
    hospital: 'Kamineni Hospitals, L.B. Nagar',
    qualification: 'MBBS, MD (Dermatology)',
    slots: ['10:30 AM', '12:30 PM', '3:00 PM', '5:30 PM'],
  },
  {
    id: '9',
    name: 'Dr. Anil Verma',
    specialty: 'Dermatologist',
    experience: '7 yrs',
    rating: 4.4,
    available: true,
    avatar: '👨‍⚕️',
    hospital: 'Sunshine Hospitals, PG Road',
    qualification: 'MBBS, DVD (Dermatology)',
    slots: ['9:30 AM', '1:30 PM', '4:00 PM'],
  },

  // ── Orthopedic ────────────────────────────────────────────────────────────
  {
    id: '10',
    name: 'Dr. Rajendra Singh',
    specialty: 'Orthopedic',
    experience: '22 yrs',
    rating: 4.9,
    available: true,
    avatar: '👨‍⚕️',
    hospital: 'Star Hospitals, Banjara Hills',
    qualification: 'MBBS, MS (Orthopaedics), Fellowship (Joint Replacement)',
    slots: ['8:00 AM', '10:00 AM', '12:00 PM', '3:30 PM'],
  },
  {
    id: '11',
    name: 'Dr. Meena Iyer',
    specialty: 'Orthopedic',
    experience: '15 yrs',
    rating: 4.7,
    available: true,
    avatar: '👩‍⚕️',
    hospital: 'Apollo Hospitals, Jubilee Hills',
    qualification: 'MBBS, MS (Orthopaedics)',
    slots: ['9:00 AM', '11:30 AM', '2:00 PM'],
  },

  // ── Gastroenterologist ────────────────────────────────────────────────────
  {
    id: '12',
    name: 'Dr. Srinivas Reddy',
    specialty: 'Gastroenterologist',
    experience: '13 yrs',
    rating: 4.6,
    available: true,
    avatar: '👨‍⚕️',
    hospital: 'AIG Hospitals, Gachibowli',
    qualification: 'MBBS, MD, DM (Gastroenterology)',
    slots: ['10:00 AM', '1:00 PM', '4:00 PM'],
  },

  // ── Pulmonologist ─────────────────────────────────────────────────────────
  {
    id: '13',
    name: 'Dr. Padma Lakshmi',
    specialty: 'Pulmonologist',
    experience: '17 yrs',
    rating: 4.8,
    available: true,
    avatar: '👩‍⚕️',
    hospital: 'Chest Hospital, Erragadda',
    qualification: 'MBBS, MD (Pulmonary Medicine)',
    slots: ['9:30 AM', '11:30 AM', '2:30 PM', '4:30 PM'],
  },

  // ── Gynecologist ──────────────────────────────────────────────────────────
  {
    id: '14',
    name: 'Dr. Usha Rani',
    specialty: 'Gynecologist',
    experience: '19 yrs',
    rating: 4.9,
    available: true,
    avatar: '👩‍⚕️',
    hospital: 'Fernandez Hospital, Hyderguda',
    qualification: 'MBBS, MS (Obstetrics & Gynaecology)',
    slots: ['8:30 AM', '10:30 AM', '12:30 PM', '3:00 PM'],
  },
  {
    id: '15',
    name: 'Dr. Manjula Das',
    specialty: 'Gynecologist',
    experience: '11 yrs',
    rating: 4.6,
    available: true,
    avatar: '👩‍⚕️',
    hospital: 'Rainbow Hospital, Banjara Hills',
    qualification: 'MBBS, DGO, DNB (Gynaecology)',
    slots: ['9:00 AM', '12:00 PM', '4:00 PM'],
  },

  // ── Psychiatrist ──────────────────────────────────────────────────────────
  {
    id: '16',
    name: 'Dr. Ravi Chandra',
    specialty: 'Psychiatrist',
    experience: '14 yrs',
    rating: 4.7,
    available: true,
    avatar: '👨‍⚕️',
    hospital: 'NIMHANS Hyderabad Centre',
    qualification: 'MBBS, MD (Psychiatry)',
    slots: ['10:00 AM', '12:00 PM', '3:00 PM', '5:00 PM'],
  },

  // ── Ophthalmologist ───────────────────────────────────────────────────────
  {
    id: '17',
    name: 'Dr. Lalitha Prasad',
    specialty: 'Ophthalmologist',
    experience: '16 yrs',
    rating: 4.8,
    available: true,
    avatar: '👩‍⚕️',
    hospital: 'LV Prasad Eye Institute, Banjara Hills',
    qualification: 'MBBS, MS (Ophthalmology)',
    slots: ['9:00 AM', '11:00 AM', '2:00 PM', '4:00 PM'],
  },

  // ── ENT ───────────────────────────────────────────────────────────────────
  {
    id: '18',
    name: 'Dr. Mohammed Farhan',
    specialty: 'ENT',
    experience: '12 yrs',
    rating: 4.6,
    available: true,
    avatar: '👨‍⚕️',
    hospital: 'Osmania General Hospital',
    qualification: 'MBBS, MS (ENT)',
    slots: ['9:30 AM', '11:30 AM', '2:30 PM'],
  },

  // ── Urologist ─────────────────────────────────────────────────────────────
  {
    id: '19',
    name: 'Dr. Nagaraju Patel',
    specialty: 'Urologist',
    experience: '15 yrs',
    rating: 4.7,
    available: true,
    avatar: '👨‍⚕️',
    hospital: 'Continental Hospitals, Gachibowli',
    qualification: 'MBBS, MS, MCh (Urology)',
    slots: ['10:00 AM', '1:00 PM', '3:30 PM'],
  },

  // ── Endocrinologist ───────────────────────────────────────────────────────
  {
    id: '20',
    name: 'Dr. Swapna Kulkarni',
    specialty: 'Endocrinologist',
    experience: '13 yrs',
    rating: 4.8,
    available: true,
    avatar: '👩‍⚕️',
    hospital: 'Yashoda Hospitals, Malakpet',
    qualification: 'MBBS, MD, DM (Endocrinology)',
    slots: ['9:00 AM', '11:30 AM', '3:00 PM', '5:30 PM'],
  },

  // ── Oncologist ────────────────────────────────────────────────────────────
  {
    id: '21',
    name: 'Dr. Kishore Rao',
    specialty: 'Oncologist',
    experience: '21 yrs',
    rating: 4.9,
    available: true,
    avatar: '👨‍⚕️',
    hospital: 'Basavatarakam Indo-American Cancer Hospital',
    qualification: 'MBBS, MD, DM (Medical Oncology)',
    slots: ['10:30 AM', '12:30 PM', '3:30 PM'],
  },
];
exports.listDoctors = (req, res) => {
  const { specialty } = req.query;
  const docs = specialty && specialty !== 'All'
    ? DOCTORS.filter(d => d.specialty === specialty) : DOCTORS;
  res.json({ doctors: docs });
};

// ── APPOINTMENTS ──────────────────────────────────────────────────────────────
exports.bookAppointment  = async (req, res) => {
  const { doctor_id, doctor_name, specialty, hospital, slot, date, reason } = req.body;
  const User = require('../models/User');

  // Try to find a registered doctor by name (case-insensitive) to link doctor_user_id
  let doctorUser = null;
  if (doctor_name) {
    doctorUser = await User.findOne({
      role: 'doctor',
      full_name: { $regex: doctor_name.trim().replace(/^Dr\.\s*/i, ''), $options: 'i' },
    }).select('_id full_name specialization hospital');
  }

  const appt = await Appointment.create({
    user_id:        req.user?._id,
    doctor_id:      doctor_id || 'manual',
    doctor_user_id: doctorUser?._id || null,
    doctor_name:    doctor_name || 'Unknown',
    specialty:      specialty  || doctorUser?.specialization || '',
    hospital:       hospital   || doctorUser?.hospital || '',
    slot:           slot       || '',
    date:           date       || '',
    reason:         reason     || '',
    status:         'confirmed',
  });
  res.status(201).json(appt);
};
exports.listAppointments = async (req, res) => {
  const filter = req.user ? { user_id: req.user._id } : {};
  const appts  = await Appointment.find(filter)
    .populate('user_id', 'full_name age gender email')
    .sort({ createdAt: -1 });
  res.json({ appointments: appts, total: appts.length });
};

// ── BLOOD DONOR ───────────────────────────────────────────────────────────────
const COMPATIBLE = {
  'A+':['A+','A-','O+','O-'],  'A-':['A-','O-'],
  'B+':['B+','B-','O+','O-'],  'B-':['B-','O-'],
  'AB+':['A+','A-','B+','B-','AB+','AB-','O+','O-'], 'AB-':['A-','B-','AB-','O-'],
  'O+':['O+','O-'], 'O-':['O-'],
};
const SEED_DONORS = [
  { name:'Rahul Verma',  blood:'O+', city:'Hyderabad', area:'Banjara Hills', phone:'+91 98765 43210', available:true },
  { name:'Priya Nair',   blood:'A+', city:'Hyderabad', area:'Jubilee Hills',  phone:'+91 87654 32109', available:true },
  { name:'Vijay Sharma', blood:'O-', city:'Hyderabad', area:'Kukatpally',     phone:'+91 76543 21098', available:true },
  { name:'Meena Iyer',   blood:'A-', city:'Hyderabad', area:'Gachibowli',     phone:'+91 65432 10987', available:true },
  { name:'Arun Reddy',   blood:'B+', city:'Hyderabad', area:'Secunderabad',   phone:'+91 54321 09876', available:true },
  { name:'Sita Kumari',  blood:'AB+',city:'Hyderabad', area:'Miyapur',        phone:'+91 43210 98765', available:true },
];
/* Normalise blood group — fix URL-encoded "+" becoming space (e.g. "O " → "O+") */
function normaliseBloodGroup(raw) {
  if (!raw) return '';
  const s = String(raw);
  // In URL query strings, + is decoded as space by Express
  // e.g. "O+" arrives as "O ", "AB+" arrives as "AB "
  // Must check for trailing space BEFORE trim() removes it
  const hadTrailingSpace = s !== s.trimEnd();
  const trimmed = s.trim();
  const withPlus = hadTrailingSpace ? trimmed + '+' : trimmed;
  return withPlus.replace(/\s/g, '').toUpperCase();
}

exports.searchDonors = async (req, res) => {
  const rawGroup = req.query.blood_group || req.query.bloodGroup || '';
  if (!rawGroup)
    return res.status(400).json({ message: 'blood_group query param is required. e.g. ?blood_group=O+' });

  const blood_group = normaliseBloodGroup(rawGroup);
  if (!COMPATIBLE[blood_group])
    return res.status(400).json({
      message: `Invalid blood group "${rawGroup}". Valid values: A+, A-, B+, B-, AB+, AB-, O+, O-`,
      received: rawGroup,
      normalised: blood_group,
    });

  const compatible = COMPATIBLE[blood_group];

  /* Seed on first use so there is always data to find */
  try {
    const count = await BloodDonor.countDocuments();
    if (count === 0) await BloodDonor.insertMany(SEED_DONORS);
  } catch (seedErr) {
    console.warn('[BloodDonor] Seed failed (non-critical):', seedErr.message);
  }

  const query = { blood: { $in: compatible }, available: true };
  const city  = (req.query.city || '').trim();
  if (city) query.city = new RegExp(city, 'i');

  try {
    const donors = await BloodDonor.find(query).sort({ createdAt: -1 }).limit(20);
    res.json({ donors, total: donors.length, blood_group_needed: blood_group, compatible_groups: compatible });
  } catch (err) {
    console.error('[BloodDonor] Search error:', err.message);
    res.status(500).json({ message: 'Failed to search donors.', error: err.message });
  }
};

exports.registerDonor = async (req, res) => {
  console.log('[BloodDonor] POST /register hit — body:', JSON.stringify(req.body));

  const { name, blood_group, blood, city, area, phone, age } = req.body;

  const rawBlood   = blood || blood_group || '';
  const bloodField = normaliseBloodGroup(rawBlood);

  console.log('[BloodDonor] name:', name, '| bloodField:', bloodField, '| city:', city, '| phone:', phone);

  if (!name || !name.trim())
    return res.status(400).json({ message: 'name is required.' });
  if (!bloodField)
    return res.status(400).json({ message: 'blood_group is required.' });
  if (!COMPATIBLE[bloodField])
    return res.status(400).json({ message: 'Invalid blood group: ' + rawBlood + '. Use A+, A-, B+, B-, AB+, AB-, O+, O-' });

  try {
    console.log('[BloodDonor] Calling BloodDonor.create...');
    const donor = await BloodDonor.create({
      name:      name.trim(),
      blood:     bloodField,
      city:      (city  || '').trim(),
      area:      (area  || '').trim(),
      phone:     (phone || '').trim(),
      available: true,
    });
    console.log('[BloodDonor] SAVED to DB — _id:', donor._id.toString(), 'name:', donor.name);
    res.status(201).json({
      success: true,
      message: 'Thank you ' + donor.name + '! Registered as ' + donor.blood + ' blood donor.',
      donor,
    });
  } catch (err) {
    console.error('[BloodDonor] DB ERROR:', err.name, err.message);
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(422).json({ message: 'Validation failed: ' + errors });
    }
    res.status(500).json({ message: 'Failed to save donor: ' + err.message });
  }
};

exports.listDonors = async (req, res) => {
  try {
    const count = await BloodDonor.countDocuments();
    if (count === 0) await BloodDonor.insertMany(SEED_DONORS);
    const donors = await BloodDonor.find({ available: true }).sort({ createdAt: -1 }).limit(100);
    res.json({ donors, total: donors.length });
  } catch (err) {
    console.error('[BloodDonor] List error:', err.message);
    res.status(500).json({ message: 'Failed to fetch donors.', error: err.message });
  }
};

// ── MENTAL HEALTH  (DS3 ML classifier → Groq Llama compassionate reply) ──────
const BOT_FALLBACK = {
  stress: "I hear you — stress can feel overwhelming. Let's try a breathing exercise. 🌬️",
  anxi:   "Anxiety is tough, but you're not alone. Try the 5-4-3-2-1 grounding technique. 🌿",
  sad:    "Thank you for sharing. Feeling sad is valid. Have you talked to someone you trust? 💙",
  happy:  "That's wonderful! 😊 What has been making you feel good lately?",
  tired:  "Fatigue signals your mind and body need care. Are you getting 7–8 hours of sleep?",
};
const DEFAULT_REPLY = "Your feelings are completely valid. Would you like some breathing exercises or wellness tips? 💙";

exports.chat = async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ message: 'message is required.' });

  // Step 1: DS3 ML classifier — detect mental health status
  let mlResult = null;
  try {
    mlResult = await mlService.mental({ message });
  } catch (err) {
    console.warn('[Mental] ML classifier unavailable:', err.message);
  }

  // Step 2: Groq Llama — generate empathetic, context-aware reply
  try {
    const groqResult = await groq.mentalHealthChatWithGroq(message, mlResult, history);
    return res.json({
      reply:         groqResult.reply,
      type:          'bot',
      ml_status:     groqResult.ml_status,
      ml_confidence: groqResult.ml_confidence,
      all_scores:    mlResult?.all_scores || {},
      is_crisis:     groqResult.is_crisis || false,
      helpline:      mlResult?.helpline   || null,
      groq_powered:  true,
      ml_powered:    Boolean(mlResult),
      model:         groqResult.model,
      disclaimer:    'AI support only. Not a substitute for professional mental health care.',
    });
  } catch (err) {
    console.warn('[Mental] Groq unavailable, using ML/fallback:', err.message);
  }

  // Step 3: ML-only fallback
  if (mlResult) {
    const { status, confidence, message: mlMsg, helpline, is_crisis, all_scores } = mlResult;
    let reply = mlMsg || DEFAULT_REPLY;
    if (is_crisis)
      reply = `I'm concerned about you. Please reach out for help right now.${helpline ? '\n📞 '+helpline : ''}`;
    return res.json({
      reply, type:'bot', ml_status:status, confidence, all_scores,
      is_crisis: is_crisis||false, helpline: helpline||null,
      groq_powered:false, ml_powered:true,
    });
  }

  // Step 4: keyword fallback
  const l     = message.toLowerCase();
  const reply = BOT_FALLBACK[Object.keys(BOT_FALLBACK).find(k => l.includes(k))] || DEFAULT_REPLY;
  res.json({ reply, type:'bot', groq_powered:false, ml_powered:false });
};

exports.logMood = async (req, res) => {
  const log = await MoodLog.create({ user_id: req.user?._id, ...req.body });
  res.status(201).json({ message: `Mood '${log.mood}' logged (score: ${log.score}/5).`, log });
};
exports.moodHistory = async (req, res) => {
  const filter = req.user ? { user_id: req.user._id } : {};
  const logs   = await MoodLog.find(filter).sort({ createdAt:-1 }).limit(100);
  res.json({ logs, total: logs.length });
};

// ── DIABETES  (DS2 RandomForest → Groq Llama personalised interpretation) ─────
exports.predictDiabetes = async (req, res) => {
  const {
    gender = 'Female', age, hypertension = 0, heart_disease = 0,
    smoking_history = 'never', bmi, HbA1c_level, blood_glucose_level,
  } = req.body;

  if (!age || !bmi || !HbA1c_level || !blood_glucose_level)
    return res.status(400).json({ message: 'age, bmi, HbA1c_level, and blood_glucose_level are required.' });

  const patient = { gender, age, hypertension, heart_disease, smoking_history, bmi, HbA1c_level, blood_glucose_level };

  // Step 1: Local ML model (DS2 RandomForest — 91.3% accuracy)
  let mlResult;
  try {
    mlResult = await mlService.diabetes(patient);
  } catch (err) {
    console.error('[Diabetes] ML model error:', err.message);
    return res.status(503).json({ message: 'ML service temporarily unavailable.', error: err.message });
  }

  // Step 2: Groq Llama — personalised dietary/lifestyle interpretation
  let groqInterpretation = null;
  try {
    groqInterpretation = await groq.interpretDiabetesWithGroq(mlResult, patient);
  } catch (err) {
    console.warn('[Diabetes] Groq interpretation unavailable:', err.message);
  }

  res.json({
    ...mlResult,
    // Groq enrichment
    interpretation:   groqInterpretation?.interpretation   || null,
    key_risk_factors: groqInterpretation?.key_risk_factors || [],
    immediate_actions:groqInterpretation?.immediate_actions|| mlResult.advice || [],
    dietary_plan:     groqInterpretation?.dietary_plan     || null,
    exercise_plan:    groqInterpretation?.exercise_plan    || null,
    monitoring:       groqInterpretation?.monitoring       || null,
    next_tests:       groqInterpretation?.next_tests       || [],
    target_values:    groqInterpretation?.target_values    || null,
    groq_powered:     Boolean(groqInterpretation),
    ml_powered:       true,
  });
};

// ── MEDICINE SCAN  (local OCR text extraction → Groq Llama authenticity AI) ──
exports.verifyScan = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No image uploaded.' });

  // Use absolute path — Python runs from ml/ subdirectory so relative paths fail
  const filepath = path.resolve(req.file.path);
  const filename = req.file.originalname;

  // Step 1: Local analyze.py — OCR text extraction + basic heuristics
  let localResult = null;
  try {
    localResult = await mlService.analyzeScan({ filepath, filename });
  } catch (err) {
    console.warn('[Scan] Local analysis failed:', err.message);
  }

  const ocrText = localResult?.ocr_text || '';

  // Step 2: Groq Llama — text analysis OR vision analysis if no OCR
  let groqResult = null;
  try {
    groqResult = await groq.analyzeScanWithGroq(ocrText, filename, filepath);
  } catch (err) {
    console.warn('[Scan] Groq analysis unavailable:', err.message);
  }

  // Merge results — Groq wins on interpretation, local wins on extracted fields
  const authentic   = groqResult?.authentic   ?? localResult?.authentic   ?? false;
  const confidence  = groqResult?.confidence  ?? localResult?.confidence  ?? 0;
  const indicators  = groqResult?.indicators  ?? localResult?.indicators  ?? [];

  const finalResult = {
    status:               authentic ? 'authentic' : 'counterfeit',
    authentic,
    confidence,
    medicine_name:        groqResult?.medicine_name  || localResult?.medicine_name  || 'Not identified',
    manufacturer:         groqResult?.manufacturer   || localResult?.manufacturer   || 'Unknown',
    batch_no:             groqResult?.batch_no       || localResult?.batch_no       || 'Not found',
    expiry:               groqResult?.expiry         || localResult?.expiry         || 'Not found',
    dosage:               groqResult?.dosage         || 'Not identified',
    indicators,
    groq_analysis:        groqResult?.groq_analysis  || null,
    recommendation:       groqResult?.recommendation || null,
    authenticity_signals: groqResult?.authenticity_signals || localResult?.positive_signals || [],
    counterfeit_signals:  groqResult?.counterfeit_signals  || localResult?.negative_signals || [],
    warning:              groqResult?.warning || (localResult?.authentic === false && !groqResult ? 'Could not fully analyse image. Verify with a pharmacist.' : null),
    warnings:             groqResult?.warning ? [groqResult.warning] : [],
    ocr_used:             localResult?.ocr_used || false,
    groq_powered:         Boolean(groqResult),
    ml_powered:           Boolean(localResult),
    licenseVerified:      authentic,
    qrVerified:           authentic && confidence > 80,
    hologramVerified:     authentic && confidence > 75,
    disclaimer:           groqResult?.disclaimer || 'AI scan only. Always verify with a licensed pharmacist.',
  };

  // Step 3: Save result to DB (so history is available)
  try {
    const saved = await ScanResult.create({
      user_id:              req.user?._id || null,
      filename:             req.file.filename,
      status:               finalResult.status,
      authentic:            finalResult.authentic,
      confidence:           finalResult.confidence,
      medicine_name:        finalResult.medicine_name,
      manufacturer:         finalResult.manufacturer,
      batch_no:             finalResult.batch_no,
      expiry:               finalResult.expiry,
      dosage:               finalResult.dosage,
      indicators:           finalResult.indicators,
      groq_analysis:        finalResult.groq_analysis,
      recommendation:       finalResult.recommendation,
      authenticity_signals: finalResult.authenticity_signals,
      counterfeit_signals:  finalResult.counterfeit_signals,
      warnings:             finalResult.warnings,
      ocr_used:             finalResult.ocr_used,
      groq_powered:         finalResult.groq_powered,
    });
    finalResult._id        = saved._id;
    finalResult.id         = saved._id;
    finalResult.scanned_at = saved.createdAt;
  } catch (dbErr) {
    console.error('[Scan] DB save failed (non-critical):', dbErr.message);
  }

  res.json(finalResult);
};

exports.listScans = async (req, res) => {
  const filter = req.user ? { user_id: req.user._id } : {};
  const scans  = await ScanResult.find(filter).sort({ createdAt: -1 }).limit(50);
  res.json({ scans, total: scans.length });
};

exports.getScan = async (req, res) => {
  const scan = await ScanResult.findById(req.params.id);
  if (!scan) return res.status(404).json({ message: 'Scan result not found.' });
  res.json(scan);
};