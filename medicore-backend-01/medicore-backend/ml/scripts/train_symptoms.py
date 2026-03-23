"""
Build symptom-disease knowledge base from dataset.csv
DS1 is a lookup table (98 diseases), NOT a supervised ML problem.
We build:
  1. Inverted symptom → [diseases] index
  2. TF-IDF similarity model for fuzzy symptom matching
  3. Full disease detail store

Output:  ml/models/symptom_kb.json       (full knowledge base)
         ml/models/symptom_model.pkl     (TF-IDF vectorizer for similarity)
         ml/models/symptom_meta.json
"""

import os, json, re, csv
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import joblib

BASE   = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA   = os.path.join(BASE, "ml", "data", "symptom_disease.csv")
MODELS = os.path.join(BASE, "ml", "models")

print("── Symptom Knowledge Base Builder ───────────────────────────────────")
print(f"Loading: {DATA}")

# ── Parse CSV ──────────────────────────────────────────────────────────────────
diseases = []
with open(DATA, encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    for row in reader:
        disease  = row.get("disease", "").strip().lower()
        symptoms = [s.strip().lower() for s in row.get("symptoms","").split(",") if s.strip()]
        cures    = [c.strip() for c in row.get("cures","").split(",") if c.strip()]
        doctors  = [d.strip() for d in row.get("doctor","").split(",") if d.strip()]
        risk_raw = row.get("risk level","").strip()

        # Normalise risk level → low / moderate / high / varies
        risk_lower = risk_raw.lower()
        if any(x in risk_lower for x in ["high","70%","25%","20%","15%"]):
            risk_norm = "high"
        elif any(x in risk_lower for x in ["moderate","1%"]):
            risk_norm = "moderate"
        elif any(x in risk_lower for x in ["low","0.1%","0.5%"]):
            risk_norm = "low"
        else:
            risk_norm = "varies"

        if disease and symptoms:
            diseases.append({
                "disease":   disease,
                "symptoms":  symptoms,
                "cures":     cures,
                "doctors":   doctors,
                "risk_raw":  risk_raw,
                "risk":      risk_norm,
                "symptom_text": " ".join(symptoms),   # for TF-IDF
            })

print(f"Parsed {len(diseases)} disease records")

# ── Deduplicate (keep richest symptom set per disease) ─────────────────────────
seen = {}
for d in diseases:
    name = d["disease"]
    if name not in seen or len(d["symptoms"]) > len(seen[name]["symptoms"]):
        seen[name] = d
diseases_dedup = list(seen.values())
print(f"After dedup: {len(diseases_dedup)} unique diseases")

# ── Inverted index: symptom → list of diseases ─────────────────────────────────
inverted = {}
for d in diseases_dedup:
    for sym in d["symptoms"]:
        inverted.setdefault(sym, [])
        if d["disease"] not in inverted[sym]:
            inverted[sym].append(d["disease"])

print(f"Unique symptoms indexed: {len(inverted)}")

# ── TF-IDF similarity model ────────────────────────────────────────────────────
corpus     = [d["symptom_text"] for d in diseases_dedup]
disease_names = [d["disease"] for d in diseases_dedup]

vectorizer = TfidfVectorizer(ngram_range=(1,2), min_df=1)
tfidf_matrix = vectorizer.fit_transform(corpus)
print(f"TF-IDF matrix: {tfidf_matrix.shape}")

# Quick self-test
query = "fever cough fatigue body pain"
q_vec = vectorizer.transform([query])
sims  = cosine_similarity(q_vec, tfidf_matrix).flatten()
top3  = sims.argsort()[-3:][::-1]
print(f"\nSelf-test query='{query}'")
for i in top3:
    print(f"  {disease_names[i]:35s}  sim={sims[i]:.3f}")

# ── Save ───────────────────────────────────────────────────────────────────────
os.makedirs(MODELS, exist_ok=True)

# Full knowledge base JSON
kb = {
    "diseases":     diseases_dedup,
    "inverted_index": inverted,
    "disease_names":  disease_names,
}
kb_path = os.path.join(MODELS, "symptom_kb.json")
with open(kb_path, "w") as f:
    json.dump(kb, f, indent=2)
print(f"\nKnowledge base saved → {kb_path}")

# TF-IDF vectorizer + matrix
vec_path = os.path.join(MODELS, "symptom_model.pkl")
joblib.dump({
    "vectorizer":   vectorizer,
    "tfidf_matrix": tfidf_matrix,
    "disease_names": disease_names,
}, vec_path)
print(f"Symptom model saved → {vec_path}")

meta = {
    "diseases_total":  len(diseases_dedup),
    "symptoms_indexed": len(inverted),
    "risk_distribution": {
        r: sum(1 for d in diseases_dedup if d["risk"] == r)
        for r in ["low","moderate","high","varies"]
    },
}
meta_path = os.path.join(MODELS, "symptom_meta.json")
with open(meta_path, "w") as f:
    json.dump(meta, f, indent=2)
print(f"Meta saved          → {meta_path}")
print("── Done ─────────────────────────────────────────────────────────────")
