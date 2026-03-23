"""
Train mental health text classification model from Combined Data.csv
Features: statement (raw text)
Target:   status (Anxiety, Normal, Depression, Suicidal, Stress, Bipolar, Personality disorder)
Model:    TF-IDF + LogisticRegression (fast inference, good accuracy on text)
Output:   ml/models/mental_model.pkl      (pipeline: vectorizer + classifier)
          ml/models/mental_meta.json
"""

import os, json
import pandas as pd
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import (accuracy_score, classification_report,
                              confusion_matrix)
from sklearn.preprocessing import LabelEncoder
import joblib

BASE   = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA   = os.path.join(BASE, "ml", "data", "mental_combined.csv")
MODELS = os.path.join(BASE, "ml", "models")

print("── Mental Health Model Training ─────────────────────────────────────")
print(f"Loading: {DATA}")

df = pd.read_csv(DATA)
print(f"Shape: {df.shape}")

# Rename columns if needed
if "statement" not in df.columns:
    df.columns = ["idx", "statement", "status"]
df = df.dropna(subset=["statement", "status"])
df["statement"] = df["statement"].astype(str).str.strip()

print(f"Class distribution:\n{df['status'].value_counts()}\n")

LABELS = sorted(df["status"].unique().tolist())
print(f"Labels ({len(LABELS)}): {LABELS}")

X = df["statement"]
y = df["status"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y)

print(f"\nTrain: {len(X_train)}  |  Test: {len(X_test)}")

# ── Pipeline: TF-IDF → Logistic Regression ────────────────────────────────────
print("\nBuilding TF-IDF + LogisticRegression pipeline…")
pipeline = Pipeline([
    ("tfidf", TfidfVectorizer(
        max_features=30000,
        ngram_range=(1, 2),      # unigrams + bigrams
        sublinear_tf=True,       # log-scale TF
        min_df=2,
        stop_words="english",
    )),
    ("clf", LogisticRegression(
        max_iter=1000,
        C=5.0,
        solver="lbfgs",
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )),
])

pipeline.fit(X_train, y_train)

# ── Evaluate ───────────────────────────────────────────────────────────────────
y_pred  = pipeline.predict(X_test)
y_proba = pipeline.predict_proba(X_test)

acc    = accuracy_score(y_test, y_pred)
report = classification_report(y_test, y_pred, output_dict=True)

print(f"\nAccuracy : {acc:.4f}")
print(classification_report(y_test, y_pred))

# ── Save ───────────────────────────────────────────────────────────────────────
os.makedirs(MODELS, exist_ok=True)
model_path = os.path.join(MODELS, "mental_model.pkl")
meta_path  = os.path.join(MODELS, "mental_meta.json")

joblib.dump(pipeline, model_path)
print(f"\nModel saved → {model_path}")

meta = {
    "model":         "TfidfVectorizer + LogisticRegression",
    "labels":        LABELS,
    "accuracy":      round(acc, 4),
    "train_samples": int(len(X_train)),
    "test_samples":  int(len(X_test)),
    "per_class":     {k: round(v["f1-score"], 4)
                      for k, v in report.items()
                      if k in LABELS},
}
with open(meta_path, "w") as f:
    json.dump(meta, f, indent=2)
print(f"Meta saved  → {meta_path}")
print("── Done ─────────────────────────────────────────────────────────────")
