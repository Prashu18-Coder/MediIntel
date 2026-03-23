# MediCore — ML Layer

Three trained models, one Python inference server, one Node.js bridge.

---

## Models

| Model | Dataset | Algorithm | Accuracy | Endpoint |
|---|---|---|---|---|
| Symptom checker | DS1 — 98 diseases / 183 symptoms | TF-IDF cosine similarity + inverted index | 84 unique diseases matched | `POST /api/symptoms/analyze` |
| Diabetes risk | DS2 — 100,000 patients | RandomForestClassifier | 91.3% accuracy / 0.978 AUC | `POST /api/dashboard/diabetes-risk` |
| Mental health | DS3 — 53,000 statements | TF-IDF + LogisticRegression | 77.2% accuracy (7 classes) | `POST /api/mental/chat` |

---

## Directory

```
ml/
├── data/                          ← Raw datasets (not committed to git)
│   ├── symptom_disease.csv        ← DS1
│   ├── diabetes_prediction_dataset.csv  ← DS2
│   └── mental_combined.csv        ← DS3
│
├── models/                        ← Trained model files (generated)
│   ├── symptom_kb.json            ← Disease knowledge base + inverted index
│   ├── symptom_model.pkl          ← TF-IDF vectorizer + matrix
│   ├── symptom_meta.json
│   ├── diabetes_model.pkl         ← RandomForestClassifier
│   ├── diabetes_meta.json         ← Feature list, accuracy, AUC
│   ├── mental_model.pkl           ← TF-IDF + LogisticRegression pipeline
│   └── mental_meta.json
│
├── scripts/                       ← Training scripts
│   ├── train_symptoms.py
│   ├── train_diabetes.py
│   └── train_mental.py
│
├── predict.py                     ← Inference server (reads JSON from stdin)
├── mlService.js                   ← Node.js bridge (child_process.spawn)
├── requirements.txt
└── train_all.sh                   ← One-command trainer
```

---

## Quick Start

```bash
# 1. Install Python deps + train all models
bash ml/train_all.sh

# 2. Start the backend (models load on first request)
npm run dev
```

---

## API Usage

### Symptom Checker
```http
POST /api/symptoms/analyze
Content-Type: application/json
Authorization: Bearer <token>

{
  "symptoms": ["fever", "cough", "fatigue"],
  "age": 30,
  "gender": "Male"
}
```

Response includes: `conditions[]`, `recommendations[]`, `specialist`, `urgency`, `emergency`, `ml_powered: true`

---

### Diabetes Risk Prediction
```http
POST /api/dashboard/diabetes-risk
Content-Type: application/json
Authorization: Bearer <token>

{
  "gender": "Female",
  "age": 45,
  "hypertension": 1,
  "heart_disease": 0,
  "smoking_history": "never",
  "bmi": 32.5,
  "HbA1c_level": 7.2,
  "blood_glucose_level": 160
}
```

Response includes: `diabetes_predicted`, `probability`, `risk` (low/moderate/high), `risk_label`, `advice[]`, `model_accuracy`, `model_auc`

**smoking_history values:** `never` | `No Info` | `not current` | `former` | `ever` | `current`

---

### Mental Health Chat (ML-classified)
```http
POST /api/mental/chat
Content-Type: application/json

{
  "message": "I have been feeling really anxious and cannot sleep"
}
```

Response includes: `reply`, `ml_status` (Anxiety/Depression/Suicidal/Stress/Bipolar/Normal/Personality disorder), `confidence`, `all_scores{}`, `is_crisis`, `helpline`, `ml_powered: true`

---

## Graceful Fallback

All three ML endpoints fall back silently to hardcoded logic if:
- Python is not installed
- Model files are missing (not yet trained)
- predict.py throws an error

This means the backend always responds — even without models.

---

## Retrain

```bash
# Retrain a single model
cd medicore-backend
python3 ml/scripts/train_diabetes.py

# Retrain all
bash ml/train_all.sh
```

Models are saved in-place — the server picks up the new files on the next request automatically (no restart needed for `predict.py` since it's spawned fresh per request).
