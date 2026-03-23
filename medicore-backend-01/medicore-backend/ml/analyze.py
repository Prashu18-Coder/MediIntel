#!/usr/bin/env python3
"""
MediCore — AI Analysis for Reports & Medicine Scan
Reads a JSON request from stdin, returns structured JSON to stdout.
Called by Node.js via child_process.spawn.

Request:  { "task": "report" | "scan", "data": { "filepath": "...", "filename": "..." } }
Response: { "ok": true,  "result": { ... } }
          { "ok": false, "error": "..." }
"""

import sys, json, os, re, traceback

# ═══════════════════════════════════════════════════════════════════════════════
# SHARED — Normal ranges for lab report analysis
# ═══════════════════════════════════════════════════════════════════════════════

NORMAL_RANGES = {
    "hemoglobin":          (12.0, 17.5, "g/dL"),
    "haemoglobin":         (12.0, 17.5, "g/dL"),
    "hb":                  (12.0, 17.5, "g/dL"),
    "wbc":                 (4.0,  11.0, "x10³/µL"),
    "white blood cell":    (4.0,  11.0, "x10³/µL"),
    "rbc":                 (4.5,   5.9, "x10⁶/µL"),
    "red blood cell":      (4.5,   5.9, "x10⁶/µL"),
    "platelets":           (150,   400, "x10³/µL"),
    "platelet":            (150,   400, "x10³/µL"),
    "glucose":             (70,    100, "mg/dL"),
    "blood glucose":       (70,    100, "mg/dL"),
    "fasting glucose":     (70,    100, "mg/dL"),
    "hba1c":               (0,     5.7, "%"),
    "hemoglobin a1c":      (0,     5.7, "%"),
    "creatinine":          (0.6,   1.2, "mg/dL"),
    "cholesterol":         (0,     200, "mg/dL"),
    "total cholesterol":   (0,     200, "mg/dL"),
    "ldl":                 (0,     130, "mg/dL"),
    "hdl":                 (40,    999, "mg/dL"),
    "triglycerides":       (0,     150, "mg/dL"),
    "triglyceride":        (0,     150, "mg/dL"),
    "tsh":                 (0.4,   4.0, "mIU/L"),
    "thyroid":             (0.4,   4.0, "mIU/L"),
    "sodium":              (136,   145, "mEq/L"),
    "potassium":           (3.5,   5.0, "mEq/L"),
    "urea":                (7,     20,  "mg/dL"),
    "bun":                 (7,     20,  "mg/dL"),
    "uric acid":           (3.5,   7.2, "mg/dL"),
    "bilirubin":           (0.1,   1.2, "mg/dL"),
    "ast":                 (10,    40,  "U/L"),
    "alt":                 (7,     56,  "U/L"),
    "alkaline phosphatase":(44,   147,  "U/L"),
}

DIET_ADVICE = {
    "hemoglobin": ["Spinach and dark leafy greens", "Red meat and liver", "Legumes and lentils", "Vitamin C foods to boost iron absorption"],
    "glucose":    ["Reduce refined carbohydrates and sugars", "Increase fibre intake", "Choose low-glycaemic foods", "Regular small meals"],
    "cholesterol":["Oats and whole grains", "Fatty fish (omega-3)", "Avoid trans fats and fried food", "Garlic and olive oil"],
    "creatinine": ["Limit protein-heavy meals", "Increase water intake", "Avoid NSAIDs", "Include cranberry and cucumber"],
    "tsh":        ["Iodine-rich foods (seaweed, dairy)", "Selenium (Brazil nuts)", "Avoid excessive soy and raw cruciferous vegetables"],
    "uric acid":  ["Reduce red meat and shellfish", "Avoid alcohol especially beer", "Increase water to 2-3 litres/day", "Cherries and berries"],
}

# ═══════════════════════════════════════════════════════════════════════════════
# IMAGE OCR — Enhanced preprocessing pipeline for medicine scan
# ═══════════════════════════════════════════════════════════════════════════════

def preprocess_image_for_ocr(img):
    """
    Apply multiple preprocessing techniques to maximise OCR accuracy
    on medicine packaging photos.
    Returns the best preprocessed image based on estimated text density.
    """
    try:
        import cv2
        import numpy as np
        from PIL import Image as PILImage

        # Convert PIL to OpenCV
        img_array = np.array(img.convert("RGB"))
        img_cv    = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)

        # ── Resize if too small (OCR needs at least 300dpi equivalent) ──
        h, w = img_cv.shape[:2]
        if w < 800:
            scale  = 800 / w
            img_cv = cv2.resize(img_cv, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

        # ── Generate multiple versions and pick the best ──
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)

        candidates = {}

        # Version 1: Simple grayscale
        candidates["gray"] = gray

        # Version 2: Adaptive threshold (handles uneven lighting)
        adaptive = cv2.adaptiveThreshold(
            gray, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 31, 10
        )
        candidates["adaptive"] = adaptive

        # Version 3: OTSU threshold (good for clean packaging)
        _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        candidates["otsu"] = otsu

        # Version 4: Sharpen then threshold (blurry photos)
        kernel_sharp = np.array([[-1,-1,-1],[-1,9,-1],[-1,-1,-1]])
        sharpened    = cv2.filter2D(gray, -1, kernel_sharp)
        _, sharp_bin = cv2.threshold(sharpened, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        candidates["sharp"] = sharp_bin

        # Version 5: Denoise + threshold (noisy/textured backgrounds)
        denoised     = cv2.fastNlMeansDenoising(gray, h=10)
        _, denoise_bin = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        candidates["denoise"] = denoise_bin

        # Version 6: Deskew if image is tilted
        # Detect text angle and correct it
        try:
            coords   = np.column_stack(np.where(gray < 128))
            if len(coords) > 100:
                angle    = cv2.minAreaRect(coords.astype(np.float32))[-1]
                if angle < -45:
                    angle = 90 + angle
                if abs(angle) > 1:  # only deskew if tilt > 1 degree
                    (h2, w2) = gray.shape
                    center   = (w2 // 2, h2 // 2)
                    M        = cv2.getRotationMatrix2D(center, angle, 1.0)
                    deskewed = cv2.warpAffine(gray, M, (w2, h2),
                                              flags=cv2.INTER_CUBIC,
                                              borderMode=cv2.BORDER_REPLICATE)
                    _, deskew_bin = cv2.threshold(deskewed, 0, 255,
                                                  cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                    candidates["deskew"] = deskew_bin
        except Exception:
            pass

        # ── Score each candidate by text pixel density ──
        # More dark pixels on white background = more text = better OCR candidate
        best_name  = "gray"
        best_score = -1
        for name, candidate in candidates.items():
            dark_pixels = np.sum(candidate < 128)
            total       = candidate.size
            density     = dark_pixels / total
            # Sweet spot: 5-40% dark pixels (too few = blank, too many = noise)
            score = 1.0 - abs(density - 0.15) * 2
            if score > best_score:
                best_score = score
                best_name  = name

        best = candidates[best_name]

        # ── Final morphological cleanup ──
        # Remove tiny noise dots
        kernel  = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 1))
        cleaned = cv2.morphologyEx(best, cv2.MORPH_CLOSE, kernel)

        return PILImage.fromarray(cleaned)

    except Exception:
        # If OpenCV not available or any error, return original image
        return img


def extract_text_from_image(filepath):
    """
    Extract text from a medicine packaging image using:
    1. OpenCV preprocessing (if available) for best accuracy
    2. Pytesseract OCR with medicine-optimised config
    3. Multiple OCR passes with different configs, pick the longest result
    Returns: (text, ocr_method_used)
    """
    try:
        from PIL import Image
        import pytesseract

        img = Image.open(filepath)

        # On Windows, set Tesseract path if not in PATH
        import platform
        if platform.system() == "Windows":
            possible_paths = [
                r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
                r"C:\Users\{}\AppData\Local\Programs\Tesseract-OCR\tesseract.exe".format(
                    os.environ.get("USERNAME", "user")
                ),
            ]
            for p in possible_paths:
                if os.path.exists(p):
                    pytesseract.pytesseract.tesseract_cmd = p
                    break

        # ── OCR configuration options ──
        # PSM modes for medicine packaging:
        #   6 = Assume a single uniform block of text (standard)
        #   11 = Sparse text — find as much text as possible (best for labels)
        #   3 = Fully automatic (default)
        ocr_configs = [
            "--psm 11 --oem 3",   # sparse text — best for labels with scattered text
            "--psm 6  --oem 3",   # uniform block
            "--psm 3  --oem 3",   # auto
        ]

        results = []

        # Pass 1: preprocessed image
        try:
            preprocessed = preprocess_image_for_ocr(img)
            for config in ocr_configs:
                text = pytesseract.image_to_string(preprocessed, config=config)
                if text.strip():
                    results.append(("preprocessed+" + config.split()[1], text.strip()))
        except Exception:
            pass

        # Pass 2: original image (as fallback / comparison)
        for config in ocr_configs[:2]:
            try:
                text = pytesseract.image_to_string(img, config=config)
                if text.strip():
                    results.append(("original+" + config.split()[1], text.strip()))
            except Exception:
                pass

        if not results:
            return "", "ocr_failed"

        # Pick the result with the most characters (most text extracted)
        best_method, best_text = max(results, key=lambda x: len(x[1]))
        return best_text, best_method

    except ImportError:
        return "", "tesseract_not_installed"
    except Exception as e:
        return "", "error: " + str(e)


# ═══════════════════════════════════════════════════════════════════════════════
# MEDICINE SCAN — Full analysis pipeline
# ═══════════════════════════════════════════════════════════════════════════════

# Expanded medicine database — Indian market focused
KNOWN_MEDICINES = {
    # Pain / fever
    "paracetamol":    {"manufacturer": "Sun Pharma / Cipla / GSK",  "form": "Tablet / Syrup",    "schedule": "OTC"},
    "dolo":           {"manufacturer": "Micro Labs",                  "form": "Tablet",            "schedule": "OTC"},
    "crocin":         {"manufacturer": "Haleon (GSK)",                "form": "Tablet / Syrup",    "schedule": "OTC"},
    "ibuprofen":      {"manufacturer": "Various",                     "form": "Tablet",            "schedule": "OTC"},
    "combiflam":      {"manufacturer": "Sanofi India",                "form": "Tablet",            "schedule": "OTC"},
    "aspirin":        {"manufacturer": "Bayer / Various",             "form": "Tablet",            "schedule": "OTC"},
    "diclofenac":     {"manufacturer": "Various",                     "form": "Tablet / Gel",      "schedule": "Rx"},
    # Antibiotics
    "amoxicillin":    {"manufacturer": "Various",                     "form": "Capsule / Syrup",   "schedule": "Rx"},
    "azithromycin":   {"manufacturer": "Various",                     "form": "Tablet",            "schedule": "Rx"},
    "ciprofloxacin":  {"manufacturer": "Various",                     "form": "Tablet",            "schedule": "Rx"},
    "augmentin":      {"manufacturer": "GSK",                         "form": "Tablet / Syrup",    "schedule": "Rx"},
    # Diabetes
    "metformin":      {"manufacturer": "Various",                     "form": "Tablet",            "schedule": "Rx"},
    "glucophage":     {"manufacturer": "Merck",                       "form": "Tablet",            "schedule": "Rx"},
    "glimepiride":    {"manufacturer": "Various",                     "form": "Tablet",            "schedule": "Rx"},
    # Cardiac / BP
    "atorvastatin":   {"manufacturer": "Various",                     "form": "Tablet",            "schedule": "Rx"},
    "amlodipine":     {"manufacturer": "Various",                     "form": "Tablet",            "schedule": "Rx"},
    "losartan":       {"manufacturer": "Various",                     "form": "Tablet",            "schedule": "Rx"},
    "telmisartan":    {"manufacturer": "Various",                     "form": "Tablet",            "schedule": "Rx"},
    # Stomach / Acid
    "omeprazole":     {"manufacturer": "Various",                     "form": "Capsule",           "schedule": "OTC/Rx"},
    "pantoprazole":   {"manufacturer": "Various",                     "form": "Tablet",            "schedule": "Rx"},
    "ranitidine":     {"manufacturer": "Various",                     "form": "Tablet",            "schedule": "OTC/Rx"},
    "gelusil":        {"manufacturer": "Pfizer India",                "form": "Tablet / Syrup",    "schedule": "OTC"},
    # Allergy / Cold
    "cetirizine":     {"manufacturer": "Various",                     "form": "Tablet",            "schedule": "OTC"},
    "loratadine":     {"manufacturer": "Various",                     "form": "Tablet",            "schedule": "OTC"},
    "allegra":        {"manufacturer": "Sanofi",                      "form": "Tablet",            "schedule": "OTC/Rx"},
    # Vitamins / Supplements
    "vitamin d":      {"manufacturer": "Various",                     "form": "Tablet / Softgel",  "schedule": "OTC"},
    "vitamin b12":    {"manufacturer": "Various",                     "form": "Tablet / Injection","schedule": "OTC"},
    "calcium":        {"manufacturer": "Various",                     "form": "Tablet",            "schedule": "OTC"},
    "becosules":      {"manufacturer": "Pfizer India",                "form": "Capsule",           "schedule": "OTC"},
    "revital":        {"manufacturer": "Sanofi India",                "form": "Capsule",           "schedule": "OTC"},
    # Thyroid
    "thyroxine":      {"manufacturer": "Various",                     "form": "Tablet",            "schedule": "Rx"},
    "eltroxin":       {"manufacturer": "GSK",                         "form": "Tablet",            "schedule": "Rx"},
    # Mental health
    "alprazolam":     {"manufacturer": "Various",                     "form": "Tablet",            "schedule": "Rx (Controlled)"},
    "sertraline":     {"manufacturer": "Various",                     "form": "Tablet",            "schedule": "Rx"},
}

# Fields that MUST appear on legitimate Indian medicine packaging (CDSCO rules)
REQUIRED_FIELDS = [
    # (search_keywords,      label,                         weight)
    (["batch", "b.no", "b no", "lot no", "lot:"],
     "Batch / Lot number",   3),
    (["mfg", "manufactured", "mfd", "manuf"],
     "Manufacturing date",   3),
    (["exp", "expiry", "expiration", "use before", "use by"],
     "Expiry date",          3),
    (["mrp", "m.r.p", "maximum retail price"],
     "MRP printed",          2),
    (["rx", "schedule h", "schedule h1", "schedule x", "prescription"],
     "Prescription schedule",1),
    (["lic", "licence", "license", "mfg. lic", "drug licence"],
     "Drug licence number",  2),
    (["net content", "each tablet", "each capsule", "contains", "composition"],
     "Drug composition",     2),
    (["store", "storage", "keep", "protect from"],
     "Storage instructions", 1),
    (["warning", "caution", "not for children", "keep out of reach"],
     "Safety warnings",      1),
]

# Signals that suggest a counterfeit
COUNTERFEIT_SIGNALS = [
    (["blurr", "blur", "smudg", "smear", "faded"],                "Blurry or faded print",    -3),
    (["speling", "medicin", "paracetmol", "ibuprof en"],          "Spelling errors detected", -4),
    (["torn", "damaged", "peeling", "tamper"],                    "Damaged packaging",        -2),
    (["no batch", "no expiry", "no mfg"],                         "Missing regulatory info",  -5),
]


def score_authenticity(text_lower, found_fields, missing_fields, medicine_found):
    """
    Calculate an authenticity score 0-100 based on:
    - Required regulatory fields present
    - Medicine identified in known database
    - No counterfeit signals
    - Text quality
    """
    score = 30  # base score — image uploaded and OCR ran

    # Each required field found adds weight
    for field_label, weight in found_fields:
        score += weight * 4

    # Missing critical fields (batch, expiry, mfg) reduce score heavily
    critical = {"Batch / Lot number", "Manufacturing date", "Expiry date"}
    for field_label, weight in missing_fields:
        if field_label in critical:
            score -= weight * 6
        else:
            score -= weight * 2

    # Known medicine in database is a positive signal
    if medicine_found:
        score += 12

    # More text extracted = more readable = more likely authentic packaging
    text_len = len(text_lower)
    if text_len > 500:   score += 10
    elif text_len > 200: score += 6
    elif text_len > 80:  score += 3

    return max(5, min(98, score))


def extract_regulatory_info(text):
    """
    Extract key regulatory fields from OCR text using regex.
    Returns dict of found values.
    """
    info = {}

    # Batch number — formats: B.No: ABC123, Lot: XY2024, Batch: 12345A
    batch = re.search(
        r'(?:batch|b\.?\s*no\.?|lot\s*no\.?|lot)[:\s#\-]*([A-Z0-9][A-Z0-9\-\/]{2,14})',
        text, re.I
    )
    if batch: info["batch_no"] = batch.group(1).upper().strip()

    # Expiry — formats: Exp: 06/2026, Exp Date: Jun 2026, Use before: 2026-06
    expiry = re.search(
        r'(?:exp(?:iry|iration)?(?:\s+date)?|use\s+(?:before|by))[:\s\-]*'
        r'([A-Za-z]{0,4}\s*\d{2,4}[\s\/\-]\d{2,4})',
        text, re.I
    )
    if expiry: info["expiry"] = expiry.group(1).strip()

    # Mfg date
    mfg = re.search(
        r'(?:mfg\.?|mfd\.?|manufactured)[:\s\-]*'
        r'([A-Za-z]{0,4}\s*\d{2,4}[\s\/\-]\d{2,4})',
        text, re.I
    )
    if mfg: info["mfg_date"] = mfg.group(1).strip()

    # MRP
    mrp = re.search(
        r'(?:mrp|m\.r\.p\.?|max\.?\s*retail\s*price)[:\s\-]*(?:rs\.?|inr)?\s*(\d+\.?\d*)',
        text, re.I
    )
    if mrp: info["mrp"] = "Rs. " + mrp.group(1)

    # Drug licence
    lic = re.search(
        r'(?:lic(?:ence|ense)?(?:\s+no\.?)?|mfg\.?\s+lic)[:\s#\-]*([A-Z0-9\/\-]{5,20})',
        text, re.I
    )
    if lic: info["licence_no"] = lic.group(1).upper()

    # Net content / pack size
    content = re.search(
        r'(\d+\s*(?:tablets?|capsules?|ml|mg|gm?|strips?))',
        text, re.I
    )
    if content: info["pack_size"] = content.group(1)

    # Dosage / strength
    strength = re.search(
        r'(\d+\s*(?:mg|mcg|ml|iu|%)\b)',
        text, re.I
    )
    if strength: info["strength"] = strength.group(1)

    return info


def analyze_scan(data):
    """
    Full medicine scan pipeline:
    1. Load and preprocess image
    2. OCR with multiple passes
    3. Extract regulatory fields with regex
    4. Score authenticity
    5. Return rich structured result
    """
    filepath = data.get("filepath", "")
    filename = data.get("filename", "image.jpg")
    ext      = os.path.splitext(filename)[1].lower()

    # ── Step 1: OCR ────────────────────────────────────────────────────────────
    raw_text    = ""
    ocr_method  = "none"
    ocr_available = False

    if ext in ('.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff') and os.path.exists(filepath):
        raw_text, ocr_method = extract_text_from_image(filepath)
        ocr_available = bool(raw_text.strip()) and "failed" not in ocr_method and "not_installed" not in ocr_method

    text_lower = raw_text.lower()

    # ── Step 2: Identify medicine ──────────────────────────────────────────────
    medicine_name = None
    medicine_info = {}
    for med_key, info in KNOWN_MEDICINES.items():
        if med_key in text_lower:
            medicine_name = med_key.title()
            medicine_info = info
            break

    # ── Step 3: Check required regulatory fields ───────────────────────────────
    found_fields   = []  # [(label, weight)]
    missing_fields = []  # [(label, weight)]
    indicators     = []

    for keywords, label, weight in REQUIRED_FIELDS:
        present = any(kw in text_lower for kw in keywords)
        if present:
            found_fields.append((label, weight))
            indicators.append({"label": label + " — found", "pass": True})
        else:
            missing_fields.append((label, weight))
            # Only show missing for critical fields in indicators list
            if weight >= 2:
                indicators.append({"label": label + " — not found", "pass": False})

    # ── Step 4: Check counterfeit signals ─────────────────────────────────────
    counterfeit_found = []
    for keywords, label, penalty in COUNTERFEIT_SIGNALS:
        if any(kw in text_lower for kw in keywords):
            counterfeit_found.append(label)
            indicators.append({"label": label, "pass": False})

    # ── Step 5: Extract specific values ───────────────────────────────────────
    reg_info = extract_regulatory_info(raw_text) if raw_text else {}

    # ── Step 6: Calculate authenticity score ──────────────────────────────────
    if ocr_available:
        score = score_authenticity(text_lower, found_fields, missing_fields, medicine_name is not None)
    else:
        # No OCR — cannot make a reliable determination
        score = 0
        indicators = [
            {"label": "OCR not available — install Tesseract", "pass": False},
            {"label": "Cannot read packaging text without OCR", "pass": False},
            {"label": "Manual verification required", "pass": False},
        ]

    authentic = score >= 60

    # ── Step 7: Build warning message ─────────────────────────────────────────
    warning = None
    if not ocr_available:
        warning = "Tesseract OCR is not installed. Cannot analyse image text. Install Tesseract for full scan functionality."
    elif score < 40:
        warning = "HIGH RISK: Multiple required fields missing or counterfeit signals detected. DO NOT consume this medicine. Verify with a licensed pharmacist immediately."
    elif score < 60:
        warning = "CAUTION: Some regulatory fields could not be verified. Please verify this medicine with a pharmacist before consuming."
    elif counterfeit_found:
        warning = "Some suspicious indicators were found. Recommend verifying with a pharmacist."

    # ── Step 8: Summary ────────────────────────────────────────────────────────
    if not ocr_available:
        summary = "OCR is not available on this server. Tesseract must be installed to read medicine packaging text. Please install Tesseract and retry, or verify the medicine manually with a pharmacist."
    elif not raw_text.strip():
        summary = "No readable text could be extracted from the image. Ensure the photo is clear, well-lit, and shows the full label."
    elif authentic:
        fields_found_count = len(found_fields)
        summary = (
            f"Medicine packaging appears authentic. "
            f"{fields_found_count} of {len(REQUIRED_FIELDS)} required regulatory fields detected."
        )
        if medicine_name:
            summary += f" Medicine identified as {medicine_name}."
    else:
        missing_critical = [f for f, w in missing_fields if w >= 3]
        summary = (
            f"Packaging could not be fully verified. "
            f"Missing critical fields: {', '.join(missing_critical) if missing_critical else 'multiple fields'}. "
            f"Verify with a pharmacist before consuming."
        )

    return {
        "authentic":          authentic,
        "confidence":         score,
        "medicine_name":      medicine_name or ("Text found but medicine not in database" if raw_text else "Could not identify — ensure clear image"),
        "manufacturer":       medicine_info.get("manufacturer", reg_info.get("manufacturer", "Not identified")),
        "form":               medicine_info.get("form", "Not identified"),
        "schedule":           medicine_info.get("schedule", "Unknown"),
        "batch_no":           reg_info.get("batch_no",   "Not found"),
        "expiry":             reg_info.get("expiry",     "Not found"),
        "mfg_date":           reg_info.get("mfg_date",   "Not found"),
        "mrp":                reg_info.get("mrp",        "Not found"),
        "licence_no":         reg_info.get("licence_no", "Not found"),
        "pack_size":          reg_info.get("pack_size",  "Not identified"),
        "strength":           reg_info.get("strength",   "Not identified"),
        "summary":            summary,
        "fields_found":       len(found_fields),
        "fields_total":       len(REQUIRED_FIELDS),
        "found_fields":       [f for f, w in found_fields],
        "missing_fields":     [f for f, w in missing_fields if w >= 2],
        "counterfeit_signals":counterfeit_found,
        "ocr_used":           ocr_available,
        "ocr_method":         ocr_method,
        "ocr_text":           raw_text if ocr_available else "",
        "text_length":        len(raw_text),
        "indicators":         indicators[:10],
        "warning":            warning,
        "ai_powered":         True,
        "disclaimer":         "AI scan only. Always verify medicines with a licensed pharmacist.",
    }


# ═══════════════════════════════════════════════════════════════════════════════
# REPORT ANALYSIS — Lab report extraction
# ═══════════════════════════════════════════════════════════════════════════════

def extract_numbers_from_text(text):
    found = []
    lines = text.split('\n')
    for line in lines:
        line_lower = line.lower().strip()
        for param, (low, high, unit) in NORMAL_RANGES.items():
            if param in line_lower:
                nums = re.findall(r'\d+\.?\d*', line)
                if nums:
                    val = float(nums[0])
                    if 1900 < val < 2100:
                        continue
                    status = 'low' if val < low else ('high' if val > high else 'normal')
                    found.append({
                        "name":    param.title(),
                        "value":   str(val),
                        "unit":    unit,
                        "normal":  f"{low}-{high}",
                        "status":  status,
                        "insight": (
                            "Within normal range." if status == 'normal' else
                            f"{'Below' if status == 'low' else 'Above'} normal range ({low}-{high} {unit})."
                        )
                    })
                    break
    seen = set()
    unique = []
    for item in found:
        if item["name"] not in seen:
            seen.add(item["name"])
            unique.append(item)
    return unique


def parse_csv_report(filepath):
    import csv
    values = []
    with open(filepath, encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            param   = (row.get('parameter') or row.get('Parameter') or '').lower().strip().replace(' ','_')
            val_str = row.get('value') or row.get('Value') or ''
            try:
                val = float(val_str)
            except:
                continue
            key = param.replace('_', ' ')
            if key in NORMAL_RANGES:
                low, high, unit = NORMAL_RANGES[key]
                status = 'low' if val < low else ('high' if val > high else 'normal')
                values.append({
                    "name":    param.replace('_',' ').title(),
                    "value":   str(val),
                    "unit":    unit,
                    "normal":  f"{low}-{high}",
                    "status":  status,
                    "insight": (
                        "Within normal range." if status == 'normal' else
                        f"{'Below' if status == 'low' else 'Above'} normal range ({low}-{high} {unit})."
                    )
                })
    return values


def read_file_text(filepath, filename):
    ext  = os.path.splitext(filename)[1].lower()
    text = ""
    if ext == '.csv':
        try:
            with open(filepath, encoding='utf-8-sig') as f:
                text = f.read()
        except:
            pass
    elif ext == '.pdf':
        try:
            import pdfplumber
            with pdfplumber.open(filepath) as pdf:
                text = "\n".join(p.extract_text() or "" for p in pdf.pages)
        except:
            try:
                from pdfminer.high_level import extract_text as pdfminer_extract
                text = pdfminer_extract(filepath)
            except:
                text = ""
    elif ext in ('.jpg', '.jpeg', '.png', '.webp'):
        raw, _ = extract_text_from_image(filepath)
        text   = raw
    return text.strip()


def build_report_analysis(values, filename):
    abnormal   = [v for v in values if v['status'] != 'normal']
    abn_lower  = {v['name'].lower() for v in abnormal}
    val_names  = {v['name'].lower() for v in values}

    if not abnormal:
        severity = "normal"
        summary  = "All tested parameters are within normal range. Maintain a healthy lifestyle."
    elif len(abnormal) <= 2:
        severity = "mild"
        summary  = f"Mild abnormalities in: {', '.join(v['name'] for v in abnormal)}. Follow-up recommended."
    else:
        severity = "moderate"
        summary  = f"{len(abnormal)} parameters out of range: {', '.join(v['name'] for v in abnormal)}. Consult a physician."

    risk_flags  = [f"{'Low' if v['status']=='low' else 'High'} {v['name']} - {v['insight']}" for v in abnormal]
    conditions  = []

    if any(n in abn_lower for n in ('hemoglobin','haemoglobin','hb')):
        h = next((v for v in values if v['name'].lower() in ('hemoglobin','haemoglobin','hb')), None)
        if h and h['status'] == 'low':
            conditions.append({"condition": "Iron Deficiency Anaemia", "likelihood": "High", "note": "Low haemoglobin is the primary marker."})
    if any('glucose' in n for n in abn_lower):
        conditions.append({"condition": "Pre-Diabetes / Diabetes Risk", "likelihood": "Moderate-High", "note": "Elevated glucose warrants HbA1c testing."})
    if 'hba1c' in abn_lower:
        conditions.append({"condition": "Diabetes Monitoring Required", "likelihood": "Confirmed", "note": "HbA1c reflects 3-month average glucose."})
    if any(n in abn_lower for n in ('cholesterol','ldl')):
        conditions.append({"condition": "Dyslipidaemia / Cardiovascular Risk", "likelihood": "Moderate", "note": "Elevated cholesterol increases heart disease risk."})
    if any(n in abn_lower for n in ('creatinine','urea','bun')):
        conditions.append({"condition": "Renal Function Concern", "likelihood": "Moderate", "note": "Elevated creatinine may indicate kidney stress."})
    if 'tsh' in abn_lower:
        conditions.append({"condition": "Thyroid Dysfunction", "likelihood": "Moderate", "note": "Abnormal TSH requires further thyroid panel."})
    if any(n in abn_lower for n in ('ast','alt')):
        conditions.append({"condition": "Liver Function Concern", "likelihood": "Moderate", "note": "Elevated liver enzymes may indicate hepatic stress."})

    recs = ["Consult a physician with this report for clinical interpretation."]
    if abnormal: recs.append("Do not self-medicate based on these results alone.")
    if not abnormal: recs.append("Annual preventive health check recommended.")

    diet = []
    for v in abnormal:
        for dk, dv in DIET_ADVICE.items():
            if dk in v['name'].lower():
                diet.extend(dv)
                break
    diet = list(dict.fromkeys(diet))[:6]

    report_type = "General Blood Test"
    if any(n in val_names for n in ('hemoglobin','wbc','platelets')): report_type = "Complete Blood Count (CBC)"
    if any(n in val_names for n in ('cholesterol','ldl')): report_type = "Lipid Profile"
    if 'creatinine' in val_names: report_type = "Renal Function Test"
    if any(n in val_names for n in ('ast','alt')): report_type = "Liver Function Test"
    if 'tsh' in val_names: report_type = "Thyroid Function Test"
    if 'hba1c' in val_names or 'glucose' in val_names: report_type = "Diabetes / Glucose Panel"

    return {
        "reportType":          report_type,
        "values":              values,
        "summary":             summary,
        "severity":            severity,
        "abnormal_count":      len(abnormal),
        "parameters_analyzed": len(values),
        "risk_flags":          risk_flags,
        "possible_conditions": conditions,
        "recommendations":     recs,
        "diet":                diet if diet else ["Balanced diet with fruits, vegetables, and whole grains"],
        "ai_powered":          True,
        "disclaimer":          "AI analysis only. Always verify with a licensed physician.",
    }


def analyze_report(data):
    filepath = data.get("filepath", "")
    filename = data.get("filename", "report")
    ext      = os.path.splitext(filename)[1].lower()
    values   = []

    if ext == '.csv' and os.path.exists(filepath):
        values = parse_csv_report(filepath)

    if not values and os.path.exists(filepath):
        text = read_file_text(filepath, filename)
        if text:
            values = extract_numbers_from_text(text)

    if not values:
        return {
            "reportType": "Uploaded Report", "values": [], "summary":
            "Could not extract lab values. Upload a CSV with 'parameter' and 'value' columns, a clear PDF, or a readable image.",
            "severity": "unknown", "abnormal_count": 0, "parameters_analyzed": 0,
            "risk_flags": [], "possible_conditions": [],
            "recommendations": ["Re-upload as a CSV for best results."],
            "diet": [], "ai_powered": True, "extraction_failed": True,
            "disclaimer": "AI analysis only. Always verify with a licensed physician.",
        }

    return build_report_analysis(values, filename)


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

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

    task    = req.get("task", "")
    payload = req.get("data", {})

    try:
        if task == "report":
            result = analyze_report(payload)
        elif task == "scan":
            result = analyze_scan(payload)
        else:
            result = {"error": f"Unknown task '{task}'. Use: report, scan"}
        print(json.dumps({"ok": True, "result": result}))
    except Exception as e:
        tb = traceback.format_exc()
        print(json.dumps({"ok": False, "error": str(e), "traceback": tb}))
        sys.exit(1)

if __name__ == "__main__":
    main()