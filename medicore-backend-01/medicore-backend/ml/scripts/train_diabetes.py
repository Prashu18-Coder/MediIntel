"""
Train diabetes prediction model from diabetes_prediction_dataset.csv
Features: gender, age, hypertension, heart_disease, smoking_history, bmi, HbA1c_level, blood_glucose_level
Target:   diabetes (0/1)
Model:    RandomForestClassifier — best balance of accuracy + inference speed
Output:   ml/models/diabetes_model.pkl
          ml/models/diabetes_meta.json
"""

import os, json
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (accuracy_score, classification_report,
                              roc_auc_score, confusion_matrix)
import joblib

BASE   = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA   = os.path.join(BASE, "ml", "data", "diabetes_prediction_dataset.csv")
MODELS = os.path.join(BASE, "ml", "models")

print("── Diabetes Model Training ──────────────────────────────────────────")
print(f"Loading: {DATA}")

df = pd.read_csv(DATA)
print(f"Shape: {df.shape}  |  Columns: {list(df.columns)}")
print(f"Class distribution:\n{df['diabetes'].value_counts()}\n")

# ── Feature engineering ────────────────────────────────────────────────────────
SMOKE_ORDER = ["never", "No Info", "not current", "former", "ever", "current"]
smoke_map   = {v: i for i, v in enumerate(SMOKE_ORDER)}
df["smoking_encoded"] = df["smoking_history"].map(smoke_map).fillna(2)

gender_map = {"Male": 1, "Female": 0, "Other": 2}
df["gender_encoded"] = df["gender"].map(gender_map).fillna(0)

# Age bins — add clinical age-risk signal
df["age_group"] = pd.cut(df["age"],
    bins=[0, 30, 45, 60, 75, 120],
    labels=[0, 1, 2, 3, 4]).astype(int)

# Interaction: high glucose + high HbA1c
df["glucose_hba1c"] = df["blood_glucose_level"] * df["HbA1c_level"]

FEATURES = [
    "gender_encoded", "age", "age_group",
    "hypertension", "heart_disease",
    "smoking_encoded", "bmi",
    "HbA1c_level", "blood_glucose_level",
    "glucose_hba1c",
]

X = df[FEATURES]
y = df["diabetes"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y)

print(f"Train: {X_train.shape}  |  Test: {X_test.shape}")

# ── Train ──────────────────────────────────────────────────────────────────────
print("\nTraining RandomForestClassifier…")
model = RandomForestClassifier(
    n_estimators=150,
    max_depth=12,
    min_samples_split=10,
    min_samples_leaf=5,
    class_weight="balanced",
    random_state=42,
    n_jobs=-1,
)
model.fit(X_train, y_train)

# ── Evaluate ───────────────────────────────────────────────────────────────────
y_pred  = model.predict(X_test)
y_proba = model.predict_proba(X_test)[:, 1]

acc     = accuracy_score(y_test, y_pred)
auc     = roc_auc_score(y_test, y_proba)
cm      = confusion_matrix(y_test, y_pred).tolist()
report  = classification_report(y_test, y_pred, output_dict=True)

print(f"\nAccuracy : {acc:.4f}")
print(f"ROC-AUC  : {auc:.4f}")
print(f"Confusion matrix: {cm}")
print(classification_report(y_test, y_pred))

# Feature importances
importances = dict(zip(FEATURES, model.feature_importances_.tolist()))
top = sorted(importances.items(), key=lambda x: x[1], reverse=True)
print("Top features:", top[:5])

# ── Save ───────────────────────────────────────────────────────────────────────
os.makedirs(MODELS, exist_ok=True)
model_path = os.path.join(MODELS, "diabetes_model.pkl")
meta_path  = os.path.join(MODELS, "diabetes_meta.json")

joblib.dump(model, model_path)
print(f"\nModel saved → {model_path}")

meta = {
    "model":        "RandomForestClassifier",
    "features":     FEATURES,
    "smoke_map":    smoke_map,
    "gender_map":   gender_map,
    "accuracy":     round(acc, 4),
    "roc_auc":      round(auc, 4),
    "confusion_matrix": cm,
    "feature_importances": importances,
    "train_samples": int(X_train.shape[0]),
    "test_samples":  int(X_test.shape[0]),
}
with open(meta_path, "w") as f:
    json.dump(meta, f, indent=2)
print(f"Meta saved  → {meta_path}")
print("── Done ─────────────────────────────────────────────────────────────")
