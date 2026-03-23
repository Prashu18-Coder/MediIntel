/**
 * MediCore — Groq AI Service
 * Uses llama-3.3-70b-versatile via Groq's OpenAI-compatible API
 * Powers: Report Analysis, Medicine Scan, Mental Health Chat,
 *         Symptom Checker enhancement, Diabetes interpretation
 *
 * All calls are wrapped with graceful fallback — if Groq is unavailable
 * or GROQ_API_KEY is missing, the caller's existing fallback runs instead.
 */

const axios = require('axios');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL        = 'llama-3.3-70b-versatile';

/**
 * Core call to Groq API.
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object} opts  - { temperature, max_tokens, json }
 * @returns {Promise<string>}  raw text response
 */
async function callGroq(systemPrompt, userPrompt, opts = {}) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set in environment');

  const { temperature = 0.3, max_tokens = 1024, json = false } = opts;

  const body = {
    model:       MODEL,
    temperature,
    max_tokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ],
  };
  if (json) body.response_format = { type: 'json_object' };

  const response = await axios.post(GROQ_API_URL, body, {
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type':  'application/json',
    },
    timeout: 30000,
  });

  return response.data.choices[0].message.content.trim();
}

/**
 * Parse JSON from Groq response safely.
 * Strips markdown fences if present.
 */
function parseJSON(text) {
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  return JSON.parse(clean);
}

// ── 1. REPORT ANALYSIS ────────────────────────────────────────────────────────
/**
 * Analyse extracted lab values with Groq Llama.
 * @param {Array}  values   - [{ name, value, unit, normal, status }]
 * @param {string} filename
 */
async function analyzeReportWithGroq(values, filename) {
  const systemPrompt = `You are a senior clinical pathologist and physician AI assistant.
Analyse blood test results and give a COMPLETE, DETAILED clinical report.
Be specific — mention exact values, exact conditions, specific foods, specific tests needed.
Write as if explaining to an educated patient. Be thorough and helpful.
Respond ONLY with valid JSON. No markdown, no preamble.`;

  const valuesText = values.map(v =>
    v.name + ': ' + v.value + ' ' + v.unit + ' (normal: ' + v.normal + ', status: ' + v.status + ')'
  ).join('\n');

  const abnormal = values.filter(v => v.status !== 'normal');
  const normal   = values.filter(v => v.status === 'normal');

  const userPrompt = 'Analyse this blood test report and return a COMPLETE clinical analysis as JSON.\n\n' +
    'File: ' + filename + '\n' +
    'Total parameters: ' + values.length + '\n' +
    'Abnormal: ' + abnormal.length + '\n\n' +
    'All Values:\n' + valuesText + '\n\n' +
    'Abnormal parameters: ' + (abnormal.length > 0 ? abnormal.map(v => v.name + ' (' + v.status + ')').join(', ') : 'None') + '\n\n' +
    'Return this exact JSON (fill ALL fields with real specific content, not placeholder text):\n' +
    '{\n' +
    '  "report_type": "e.g. Complete Blood Count / Lipid Profile / Diabetes Panel",\n' +
    '  "summary": "3-4 sentence overview of overall health status based on ALL values",\n' +
    '  "severity": "normal OR mild OR moderate OR severe",\n' +
    '  "clinical_interpretation": "Detailed 3-5 sentence paragraph explaining what the abnormal values mean clinically, how they relate to each other, and what this pattern suggests about the patient health",\n' +
    '  "possible_conditions": [\n' +
    '    { "condition": "specific condition name", "likelihood": "High OR Moderate OR Low", "note": "why this condition is suspected based on the specific values" }\n' +
    '  ],\n' +
    '  "what_each_means": [\n' +
    '    { "parameter": "parameter name", "explanation": "what this specific value means for this patient" }\n' +
    '  ],\n' +
    '  "recommendations": ["specific actionable recommendation 1", "specific recommendation 2", "specific recommendation 3"],\n' +
    '  "diet": ["specific Indian food to eat or avoid with reason", "another specific food recommendation"],\n' +
    '  "lifestyle": ["specific lifestyle change with detail", "another specific change"],\n' +
    '  "tests_to_do_next": ["specific follow-up test and why"],\n' +
    '  "urgency": "routine OR within_week OR within_48h OR immediate",\n' +
    '  "urgency_reason": "why this urgency level",\n' +
    '  "specialist_needed": "specific specialist type or General Physician",\n' +
    '  "disclaimer": "AI analysis only. Always verify with a licensed physician."\n' +
    '}';

  const raw    = await callGroq(systemPrompt, userPrompt, { json: true, max_tokens: 2000 });
  const parsed = parseJSON(raw);

  return {
    ...parsed,
    groq_powered: true,
    model:        MODEL,
  };
}

// ── 2. MEDICINE SCAN ──────────────────────────────────────────────────────────
/**
 * Analyse medicine packaging text with Groq Llama.
 * @param {string} ocrText   - text extracted from packaging image (or empty)
 * @param {string} filename
 */
async function analyzeScanWithGroq(ocrText, filename, imageFilepath = null) {
  const systemPrompt = `You are a helpful medicine verification assistant for Indian patients.
Your job is to read medicine packaging and extract information — NOT to flag medicines as counterfeit unless there are clear signs.

IMPORTANT RULES:
- Most Indian medicines ARE genuine. Default to authentic unless you see clear red flags.
- Do NOT mark authentic if ONLY some fields are missing — small print is often hard to read in photos.
- Only mark counterfeit if you see: obvious spelling errors in drug name, clearly wrong manufacturer, or packaging looks obviously fake.
- A medicine can be authentic even if you cannot read every field from the photo.
- Be helpful and extract whatever information you CAN see.
- Confidence should be 60-85 for normal medicines where some fields are visible.
- Only give confidence below 40 if the image is completely unreadable or clearly fake.

Respond ONLY with valid JSON. No markdown, no preamble.`;

  const jsonStructure = `{
  "authentic": true or false,
  "confidence": number 0-100 (use 65-80 for normal readable packaging),
  "medicine_name": "name you can identify or Unknown",
  "manufacturer": "manufacturer name or Unknown",
  "batch_no": "batch number if visible or Not found",
  "expiry": "expiry date if visible or Not found",
  "mfg_date": "manufacturing date if visible or Not found",
  "mrp": "MRP if visible or Not found",
  "dosage": "dosage strength if visible or Not found",
  "indicators": [
    { "label": "what you checked", "pass": true or false }
  ],
  "authenticity_signals": ["things that look legitimate"],
  "counterfeit_signals": ["only real red flags, not missing fields"],
  "warning": null (use null for genuine medicines, only add warning if clearly fake),
  "recommendation": "brief helpful advice",
  "groq_analysis": "1-2 sentences about what you can see on the packaging"
}`;

  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set');

  const hasText = ocrText && ocrText.trim().length > 20;

  // If we have OCR text, use text-based analysis
  if (hasText) {
    const userPrompt = `Analyse this medicine packaging text and determine authenticity.

Filename: ${filename}
OCR Text:
"""
${ocrText.slice(0, 2000)}
"""

Respond with this JSON:
${jsonStructure}`;

    const raw    = await callGroq(systemPrompt, userPrompt, { json: true, max_tokens: 900 });
    const parsed = parseJSON(raw);
    return { ...parsed, groq_powered: true, model: MODEL };
  }

  // No OCR text — try Groq Vision if image file is available
  if (imageFilepath) {
    try {
      const fs   = require('fs');
      const path = require('path');
      const ext  = path.extname(imageFilepath).toLowerCase();
      const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
      const mimeType = mimeMap[ext] || 'image/jpeg';

      if (fs.existsSync(imageFilepath)) {
        const imageData = fs.readFileSync(imageFilepath).toString('base64');

        // Use vision-capable model
        const visionModel = 'meta-llama/llama-4-scout-17b-16e-instruct';

        const response = await axios.post(GROQ_API_URL, {
          model:       visionModel,
          temperature: 0.2,
          max_tokens:  900,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: 'data:' + mimeType + ';base64,' + imageData },
                },
                {
                  type: 'text',
                  text: 'Analyse this medicine packaging image and determine if it is authentic or counterfeit. Respond with this JSON: ' + jsonStructure,
                },
              ],
            },
          ],
        }, {
          headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
          timeout: 45000,
        });

        const raw    = response.data.choices[0].message.content.trim();
        const parsed = parseJSON(raw);
        return { ...parsed, groq_powered: true, model: visionModel, vision_used: true };
      }
    } catch (visionErr) {
      console.warn('[Groq] Vision analysis failed:', visionErr.message);
      // Fall through to no-text response
    }
  }

  // No OCR, no vision — return helpful message
  return {
    authentic:            false,
    confidence:           0,
    medicine_name:        'Could not identify',
    manufacturer:         'Unknown',
    batch_no:             'Not readable',
    expiry:               'Not readable',
    mfg_date:             'Not readable',
    mrp:                  'Not readable',
    dosage:               'Not readable',
    indicators:           [
      { label: 'Install Tesseract OCR for text extraction', pass: false },
      { label: 'Manual verification required', pass: false },
    ],
    authenticity_signals: [],
    counterfeit_signals:  [],
    warning:              'Could not read the image. Install Tesseract OCR (pip install pytesseract) for best results.',
    recommendation:       'Install Tesseract OCR for automatic text extraction, or verify this medicine manually with a pharmacist.',
    groq_analysis:        'No text could be extracted from the image. Install Tesseract OCR for full scan functionality.',
    groq_powered:         true,
    model:                MODEL,
  };
}

// ── 3. MENTAL HEALTH CHAT ─────────────────────────────────────────────────────
/**
 * Compassionate mental health response with Groq Llama.
 * @param {string} message        - user's message
 * @param {object} mlClassification - result from the DS3 ML model (optional)
 * @param {Array}  history        - [{ role: 'user'|'assistant', content: '...' }]
 */
async function mentalHealthChatWithGroq(message, mlClassification = null, history = []) {
  const isCrisis   = mlClassification?.is_crisis || false;
  const mlStatus   = mlClassification?.status    || 'Unknown';
  const confidence = mlClassification?.confidence || 0;

  const systemPrompt = `You are a compassionate, professional mental wellness companion named MediCore AI.
You provide emotional support, coping strategies, and mental health guidance.

CRITICAL RULES:
- Never diagnose mental health conditions
- If someone expresses suicidal ideation or self-harm, ALWAYS provide crisis helpline numbers immediately
- Be warm, empathetic, and non-judgmental
- Keep responses concise (3-5 sentences max)
- Suggest practical coping techniques when appropriate
- Never replace professional therapy — always encourage seeking professional help when needed
- Indian crisis helplines: iCall: 9152987821 | Vandrevala Foundation: 1860-2662-345 | NIMHANS: 080-46110007
${isCrisis ? '\n⚠️ CRISIS DETECTED: The user may be experiencing suicidal ideation. Lead with crisis resources immediately.' : ''}
${mlStatus !== 'Unknown' ? `\nML Classification: ${mlStatus} (${confidence}% confidence) — use this to guide your tone.` : ''}`;

  // Build message history for multi-turn context
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6),  // last 3 exchanges
    { role: 'user',   content: message },
  ];

  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set');

  const response = await axios.post(GROQ_API_URL, {
    model:       MODEL,
    temperature: 0.7,
    max_tokens:  300,
    messages,
  }, {
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    timeout: 20000,
  });

  const reply = response.data.choices[0].message.content.trim();

  return {
    reply,
    groq_powered: true,
    model:        MODEL,
    is_crisis:    isCrisis,
    ml_status:    mlStatus,
    ml_confidence: confidence,
  };
}

// ── 4. SYMPTOM ANALYSIS ENHANCEMENT ──────────────────────────────────────────
/**
 * Enrich ML symptom results with Groq Llama narrative + specialist advice.
 * @param {Array}  symptoms    - ['fever', 'cough', ...]
 * @param {Array}  mlConditions - conditions from DS1 ML model
 * @param {object} patient     - { age?, gender? }
 */
async function enhanceSymptomAnalysisWithGroq(symptoms, mlConditions, patient = {}) {
  const systemPrompt = `You are an experienced general physician AI assistant.
Given a list of symptoms and preliminary ML-identified conditions, provide enhanced 
clinical guidance. Be clear, concise, and patient-friendly.
Respond ONLY with valid JSON. No markdown, no preamble.`;

  const conditionsList = mlConditions.slice(0, 3)
    .map(c => `${c.name} (${c.probability}% probability, ${c.severity} severity)`)
    .join(', ');

  const userPrompt = `Patient presents with: ${symptoms.join(', ')}
${patient.age ? `Age: ${patient.age}` : ''}
${patient.gender ? `Gender: ${patient.gender}` : ''}

ML model identified these possible conditions: ${conditionsList}

Provide enhanced clinical guidance as JSON:
{
  "clinical_summary": "brief clinical assessment in 2 sentences",
  "most_likely_diagnosis": "single most likely diagnosis given the symptom pattern",
  "red_flags": ["symptom or sign that would warrant immediate emergency care"],
  "home_care": ["safe home care step", "..."],
  "when_to_see_doctor": "within how long and why",
  "questions_to_ask_doctor": ["relevant question", "..."],
  "tests_that_may_be_ordered": ["test name", "..."],
  "specialist": "most appropriate specialist type"
}`;

  const raw    = await callGroq(systemPrompt, userPrompt, { json: true, max_tokens: 700 });
  const parsed = parseJSON(raw);

  return { ...parsed, groq_powered: true, model: MODEL };
}

// ── 5. DIABETES RESULT INTERPRETATION ─────────────────────────────────────────
/**
 * Provide personalized Groq interpretation of the ML diabetes prediction.
 * @param {object} mlResult  - result from DS2 RandomForest model
 * @param {object} patient   - raw input { age, bmi, HbA1c_level, blood_glucose_level, ... }
 */
async function interpretDiabetesWithGroq(mlResult, patient) {
  const systemPrompt = `You are an endocrinology AI assistant specializing in diabetes care.
Given diabetes risk prediction results, provide personalized, actionable guidance.
Respond ONLY with valid JSON. No markdown, no preamble.`;

  const userPrompt = `Patient diabetes risk assessment:

Risk Level: ${mlResult.risk_label} (${mlResult.probability}% probability)
Age: ${patient.age}, BMI: ${patient.bmi}
HbA1c: ${patient.HbA1c_level}%, Fasting Glucose: ${patient.blood_glucose_level} mg/dL
Hypertension: ${patient.hypertension ? 'Yes' : 'No'}
Heart Disease: ${patient.heart_disease ? 'Yes' : 'No'}
Smoking: ${patient.smoking_history || 'never'}

Provide personalized diabetes guidance as JSON:
{
  "interpretation": "2-3 sentence clinical interpretation of these specific values",
  "key_risk_factors": ["most significant risk factor found", "..."],
  "immediate_actions": ["action to take this week", "..."],
  "dietary_plan": {
    "foods_to_eat": ["specific food", "..."],
    "foods_to_avoid": ["specific food", "..."],
    "meal_timing": "advice on meal frequency and timing"
  },
  "exercise_plan": "specific exercise recommendation for this patient",
  "monitoring": "what to monitor and how often",
  "next_tests": ["HbA1c recheck in X months", "..."],
  "target_values": {
    "bmi": "target BMI range",
    "hba1c": "target HbA1c",
    "glucose": "target fasting glucose"
  }
}`;

  const raw    = await callGroq(systemPrompt, userPrompt, { json: true, max_tokens: 900 });
  const parsed = parseJSON(raw);

  return { ...parsed, groq_powered: true, model: MODEL };
}

module.exports = {
  callGroq,
  analyzeReportWithGroq,
  analyzeScanWithGroq,
  mentalHealthChatWithGroq,
  enhanceSymptomAnalysisWithGroq,
  interpretDiabetesWithGroq,
};
// ── 6. PATIENT CASE SEVERITY ANALYSIS (for doctor recommendations) ────────────
/**
 * Analyse a patient's chief complaint + symptoms with Llama.
 * Returns severity score, specialty routing, urgency, and clinical summary.
 * @param {object} caseData - { chief_complaint, symptoms, age, gender, duration }
 */
async function analyzePatientCaseSeverity(caseData) {
  const { chief_complaint, symptoms = [], age, gender, duration } = caseData;

  const systemPrompt = `You are a senior triage physician AI assistant at a multi-specialty hospital.
Your job is to assess patient-reported problems and:
1. Score the severity from 0-100
2. Assign a severity label: low, moderate, high, critical, or emergency
3. Determine the most appropriate medical specialty to route this patient to
4. Provide a brief clinical assessment for the doctor
5. Determine urgency: routine, within_week, within_48h, or immediate

Be accurate and prioritize patient safety. If there is any sign of emergency (chest pain, stroke symptoms, breathing difficulty, severe trauma, etc.), score >=90 and mark emergency.

Respond ONLY with valid JSON. No markdown, no preamble.`;

  const userPrompt = `Patient case for triage assessment:

Chief Complaint: ${chief_complaint}
Symptoms: ${symptoms.length ? symptoms.join(', ') : 'Not specified'}
Duration: ${duration || 'Not specified'}
Patient Age: ${age || 'Not specified'}
Patient Gender: ${gender || 'Not specified'}

Assess this case and return JSON:
{
  "severity_score": <0-100 integer>,
  "severity_label": "low|moderate|high|critical|emergency",
  "urgency": "routine|within_week|within_48h|immediate",
  "recommended_specialty": "e.g. Cardiologist, Neurologist, General Physician, Orthopedic, etc.",
  "specialty_reason": "why this specialty is recommended",
  "clinical_summary": "2-3 sentence assessment for the doctor",
  "red_flags": ["any concerning symptoms that need immediate attention"],
  "possible_conditions": ["top 2-3 differential diagnoses"],
  "triage_priority": "P1 (immediate)|P2 (urgent)|P3 (less urgent)|P4 (routine)",
  "doctor_notes": "specific things the doctor should ask or check first"
}`;

  const raw    = await callGroq(systemPrompt, userPrompt, { json: true, max_tokens: 800, temperature: 0.2 });
  const parsed = parseJSON(raw);

  return {
    ...parsed,
    groq_powered: true,
    model:        MODEL,
  };
}

module.exports.analyzePatientCaseSeverity = analyzePatientCaseSeverity;