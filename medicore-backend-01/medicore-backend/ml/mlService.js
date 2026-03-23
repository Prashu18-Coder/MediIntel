/**
 * MediCore — ML Service
 * Calls ml/predict.py via child_process.spawn
 * All three models (symptoms, diabetes, mental) go through this single bridge.
 */

const { spawn, execSync } = require('child_process');
const path                = require('path');

const PREDICT_SCRIPT = path.join(__dirname, 'predict.py');

/* Detect correct python command — Windows uses 'python', Linux/Mac use 'python3' */
function getPythonCmd() {
  for (const cmd of ['python3', 'python']) {
    try {
      const out = execSync(`${cmd} --version 2>&1`, { timeout: 3000 }).toString();
      if (out.includes('Python 3')) return cmd;
    } catch {}
  }
  return 'python3'; // fallback — will show clear error if missing
}
const PYTHON_CMD = getPythonCmd();
console.log('[ML] Using Python command:', PYTHON_CMD);

function predict(modelName, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ model: modelName, data });

    const py = spawn(PYTHON_CMD, [PREDICT_SCRIPT], {
      cwd:   path.dirname(PREDICT_SCRIPT),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    py.stdout.on('data', chunk => { stdout += chunk.toString(); });
    py.stderr.on('data', chunk => { stderr += chunk.toString(); });

    py.on('close', code => {
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed.ok) {
          resolve(parsed.result);
        } else {
          const msg = parsed.error || 'ML prediction failed';
          console.error('[ML] Python error:', msg);
          reject(new Error(msg));
        }
      } catch (e) {
        console.error('[ML] Failed to parse Python output:', stdout);
        if (stderr) console.error('[ML] stderr:', stderr);
        reject(new Error('ML service returned invalid response'));
      }
    });

    py.on('error', err => {
      console.error('[ML] spawn error:', err.message);
      reject(new Error(`Could not start ML service: ${err.message}`));
    });

    py.stdin.write(payload);
    py.stdin.end();
  });
}

/* ── AI Analysis bridge (report + scan) ──────────────────────────────────── */
const ANALYZE_SCRIPT = path.join(__dirname, 'analyze.py');

function analyze(task, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ task, data });

    const py = spawn(PYTHON_CMD, [ANALYZE_SCRIPT], {
      cwd:   path.dirname(ANALYZE_SCRIPT),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    py.stdout.on('data', chunk => { stdout += chunk.toString(); });
    py.stderr.on('data', chunk => { stderr += chunk.toString(); });

    py.on('close', () => {
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed.ok) {
          resolve(parsed.result);
        } else {
          console.error('[ML:analyze] Python error:', parsed.error);
          reject(new Error(parsed.error || 'Analysis failed'));
        }
      } catch (e) {
        console.error('[ML:analyze] Failed to parse output:', stdout.slice(0, 200));
        if (stderr) console.error('[ML:analyze] stderr:', stderr.slice(0, 200));
        reject(new Error('AI analysis service returned invalid response'));
      }
    });

    py.on('error', err => {
      console.error('[ML:analyze] spawn error:', err.message);
      reject(new Error(`Could not start AI analysis service: ${err.message}`));
    });

    py.stdin.write(payload);
    py.stdin.end();
  });
}

/* Convenience wrappers */
const mlService = {
  symptoms:      (data) => predict('symptoms', data),
  diabetes:      (data) => predict('diabetes', data),
  mental:        (data) => predict('mental',   data),
  analyzeReport: (data) => analyze('report',   data),
  analyzeScan:   (data) => analyze('scan',     data),
};

module.exports = mlService;