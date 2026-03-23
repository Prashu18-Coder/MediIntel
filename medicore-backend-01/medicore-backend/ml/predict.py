#!/usr/bin/env python3
"""
MediCore ML Inference Server
Reads a JSON request from stdin, returns a JSON response to stdout.
Called by Node.js via child_process.spawn.

Usage (from Node):
  python3 ml/predict.py < request.json

Request format:
  { "model": "symptoms" | "diabetes" | "mental", "data": { ... } }

Response format:
  { "ok": true, "result": { ... } }
  { "ok": false, "error": "..." }
"""

import sys, json, os, traceback

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")

def load_symptom_model():
    import joblib
    kb_path  = os.path.join(MODELS_DIR, "symptom_kb.json")
    vec_path = os.path.join(MODELS_DIR, "symptom_model.pkl")
    with open(kb_path) as f:
        kb = json.load(f)
    pkg = joblib.load(vec_path)
    return kb, pkg

def load_diabetes_model():
    import joblib
    meta_path  = os.path.join(MODELS_DIR, "diabetes_meta.json")
    model_path = os.path.join(MODELS_DIR, "diabetes_model.pkl")
    with open(meta_path) as f:
        meta = json.load(f)
    model = joblib.load(model_path)
    return model, meta

def load_mental_model():
    import joblib
    meta_path  = os.path.join(MODELS_DIR, "mental_meta.json")
    model_path = os.path.join(MODELS_DIR, "mental_model.pkl")
    with open(meta_path) as f:
        meta = json.load(f)
    pipeline = joblib.load(model_path)
    return pipeline, meta

# ── Symptom prediction ─────────────────────────────────────────────────────────
def predict_symptoms(data):
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np

    symptoms_input = data.get("symptoms", [])
    if not symptoms_input:
        return {"error": "No symptoms provided"}

    kb, pkg = load_symptom_model()
    vectorizer   = pkg["vectorizer"]
    tfidf_matrix = pkg["tfidf_matrix"]
    disease_names = pkg["disease_names"]
    diseases_map  = {d["disease"]: d for d in kb["diseases"]}
    inverted      = kb["inverted_index"]

    # Normalise input symptoms
    sym_lower = [s.strip().lower() for s in symptoms_input]
    query_text = " ".join(sym_lower)

    # --- Method 1: exact inverted-index match ---
    candidate_scores = {}
    for sym in sym_lower:
        if sym in inverted:
            for disease in inverted[sym]:
                candidate_scores[disease] = candidate_scores.get(disease, 0) + 1

    # --- Method 2: TF-IDF cosine similarity ---
    q_vec = vectorizer.transform([query_text])
    sims  = cosine_similarity(q_vec, tfidf_matrix).flatten()

    # Combine: score = (exact_matches * 2) + cosine_sim
    combined = {}
    for i, name in enumerate(disease_names):
        exact  = candidate_scores.get(name, 0)
        cosine = float(sims[i])
        combined[name] = exact * 2 + cosine

    top_names = sorted(combined, key=lambda x: combined[x], reverse=True)[:5]

    conditions = []
    for name in top_names:
        if combined[name] < 0.05:
            continue
        d    = diseases_map.get(name, {})
        score = combined[name]
        # Map to probability band
        if score >= 4:   prob = 85
        elif score >= 3: prob = 72
        elif score >= 2: prob = 58
        elif score >= 1: prob = 42
        else:            prob = 25

        conditions.append({
            "name":        name.title(),
            "probability": prob,
            "severity":    d.get("risk", "varies"),
            "description": f"Linked symptoms: {', '.join(d.get('symptoms', [])[:4])}.",
            "cures":       d.get("cures", []),
            "doctors":     d.get("doctors", []),
        })

    if not conditions:
        conditions = [{"name": "Common Cold", "probability": 60, "severity": "low",
                       "description": "No strong match found. Likely a common viral infection.",
                       "cures": ["rest", "fluids"], "doctors": ["family doctor"]}]

    # Urgency from top condition
    top_risk = conditions[0]["severity"] if conditions else "low"
    urgency_map = {"high": "immediately", "moderate": "within_24h", "low": "within_week", "varies": "within_week"}
    emergency_symptoms = {"chest pain","shortness of breath","unconscious","seizure","stroke","heart attack"}
    is_emergency = bool(set(sym_lower) & emergency_symptoms)

    specialist = conditions[0]["doctors"][0] if conditions and conditions[0].get("doctors") else "General Physician"

    recs_map = {
        "high":     ["Seek emergency care immediately", "Call 108 / 112 now", "Do not drive yourself"],
        "moderate": ["Rest and stay hydrated — 8–10 glasses of water daily",
                     "Take paracetamol for fever management",
                     "Consult a doctor if symptoms persist beyond 2 days"],
        "low":      ["Rest adequately", "Monitor symptoms",
                     "Visit a doctor if no improvement in 3 days"],
        "varies":   ["Monitor closely", "Consult a specialist for accurate diagnosis"],
    }

    return {
        "conditions":      conditions[:4],
        "recommendations": recs_map.get(top_risk, recs_map["low"]),
        "specialist":      specialist,
        "urgency":         urgency_map.get(top_risk, "within_week"),
        "emergency":       is_emergency,
        "disclaimer":      "AI-assisted analysis only. Not a substitute for professional medical advice.",
        "source":          "dataset_ml",
    }

# ── Diabetes prediction ────────────────────────────────────────────────────────
def predict_diabetes(data):
    import pandas as pd
    import numpy as np

    model, meta = load_diabetes_model()

    smoke_map  = meta["smoke_map"]
    gender_map = meta["gender_map"]
    features   = meta["features"]

    gender  = data.get("gender", "Female")
    age     = float(data.get("age", 30))
    htn     = int(data.get("hypertension", 0))
    hd      = int(data.get("heart_disease", 0))
    smoking = data.get("smoking_history", "never")
    bmi     = float(data.get("bmi", 22.0))
    hba1c   = float(data.get("HbA1c_level", 5.5))
    glucose = float(data.get("blood_glucose_level", 90))

    gender_enc = gender_map.get(gender, 0)
    smoke_enc  = smoke_map.get(smoking, 2)

    # Derived
    age_grp      = 0 if age < 30 else (1 if age < 45 else (2 if age < 60 else (3 if age < 75 else 4)))
    glucose_hba1c = glucose * hba1c

    row = {
        "gender_encoded":     gender_enc,
        "age":                age,
        "age_group":          age_grp,
        "hypertension":       htn,
        "heart_disease":      hd,
        "smoking_encoded":    smoke_enc,
        "bmi":                bmi,
        "HbA1c_level":        hba1c,
        "blood_glucose_level": glucose,
        "glucose_hba1c":      glucose_hba1c,
    }
    X = pd.DataFrame([row])[features]

    prob      = float(model.predict_proba(X)[0][1])
    predicted = int(model.predict(X)[0])

    # Risk band
    if prob >= 0.7:   risk, label = "high", "High Risk"
    elif prob >= 0.4: risk, label = "moderate", "Moderate Risk"
    else:             risk, label = "low", "Low Risk"

    advice_map = {
        "high":     ["Consult an endocrinologist immediately",
                     "Monitor blood glucose daily", "Follow a strict low-carb diet",
                     "Begin regular moderate exercise"],
        "moderate": ["Schedule a doctor visit within 2 weeks",
                     "Reduce sugary and processed foods", "Increase physical activity to 30 min/day",
                     "Recheck HbA1c in 3 months"],
        "low":      ["Maintain a balanced diet",
                     "Stay active with regular exercise", "Annual screening recommended"],
    }

    return {
        "diabetes_predicted": predicted,
        "probability":        round(prob * 100, 1),
        "risk":               risk,
        "risk_label":         label,
        "advice":             advice_map.get(risk, []),
        "input_summary": {
            "age": age, "bmi": bmi, "HbA1c": hba1c,
            "glucose": glucose, "hypertension": bool(htn), "heart_disease": bool(hd),
        },
        "model_accuracy": meta["accuracy"],
        "model_auc":      meta["roc_auc"],
        "disclaimer":     "AI prediction only. Consult a physician for diagnosis.",
        "source":         "dataset_ml",
    }

# ── Mental health classification ───────────────────────────────────────────────
def predict_mental(data):
    pipeline, meta = load_mental_model()
    labels = meta["labels"]

    text = data.get("message", data.get("text", "")).strip()
    if not text:
        return {"error": "No text provided"}

    proba  = pipeline.predict_proba([text])[0]
    idx    = int(proba.argmax())
    status = pipeline.classes_[idx]
    conf   = float(proba[idx])

    all_scores = {
        pipeline.classes_[i]: round(float(p) * 100, 1)
        for i, p in enumerate(proba)
    }

    resources_map = {
        "Suicidal":   {"message": "Please reach out for help immediately.",
                       "helpline": "iCall: 9152987821 | Vandrevala Foundation: 1860-2662-345"},
        "Depression": {"message": "You are not alone. Support is available.",
                       "helpline": "iCall: 9152987821"},
        "Anxiety":    {"message": "Breathing exercises can help right now.",
                       "helpline": "NIMHANS helpline: 080-46110007"},
        "Bipolar":    {"message": "A psychiatrist can help manage your condition.",
                       "helpline": "Vandrevala Foundation: 1860-2662-345"},
        "Stress":     {"message": "Try the 4-7-8 breathing technique.",
                       "helpline": None},
        "Normal":     {"message": "You seem to be doing okay. Keep it up!", "helpline": None},
        "Personality disorder": {
                       "message": "Therapy with a licensed psychologist can help significantly.",
                       "helpline": "iCall: 9152987821"},
    }

    resource = resources_map.get(status, {"message": "Take care of yourself.", "helpline": None})

    return {
        "status":          status,
        "confidence":      round(conf * 100, 1),
        "all_scores":      all_scores,
        "message":         resource["message"],
        "helpline":        resource["helpline"],
        "is_crisis":       status == "Suicidal",
        "model_accuracy":  meta["accuracy"],
        "disclaimer":      "AI screening only. Not a clinical diagnosis.",
        "source":          "dataset_ml",
    }

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"ok": False, "error": "Empty input"}))
        sys.exit(1)

    try:
        req = json.loads(raw)
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"Invalid JSON: {e}"}))
        sys.exit(1)

    model_name = req.get("model", "")
    payload    = req.get("data", {})

    try:
        if model_name == "symptoms":
            result = predict_symptoms(payload)
        elif model_name == "diabetes":
            result = predict_diabetes(payload)
        elif model_name == "mental":
            result = predict_mental(payload)
        else:
            result = {"error": f"Unknown model '{model_name}'. Use: symptoms, diabetes, mental"}

        print(json.dumps({"ok": True, "result": result}))

    except Exception as e:
        tb = traceback.format_exc()
        print(json.dumps({"ok": False, "error": str(e), "traceback": tb}))
        sys.exit(1)

if __name__ == "__main__":
    main()
