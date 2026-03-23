#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# MediCore — Train All ML Models
# Run from: medicore-backend/
#   bash ml/train_all.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo ""
echo "⚕️  MediCore ML Training Pipeline"
echo "────────────────────────────────────────────────────────────────"

# Install Python deps
echo "📦 Installing Python dependencies..."
pip install -r ml/requirements.txt --quiet

echo ""
echo "1/3  Symptom knowledge base (DS1)..."
python3 ml/scripts/train_symptoms.py

echo ""
echo "2/3  Diabetes prediction model (DS2)..."
python3 ml/scripts/train_diabetes.py

echo ""
echo "3/3  Mental health classifier (DS3)..."
python3 ml/scripts/train_mental.py

echo ""
echo "────────────────────────────────────────────────────────────────"
echo "✅  All models trained and saved to ml/models/"
echo ""
echo "Models:"
ls -lh ml/models/
echo ""
echo "Start the backend:  npm run dev"
