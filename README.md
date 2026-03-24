<div align="center">

<img src="https://img.shields.io/badge/⚕️-MediIntel-00d4ff?style=for-the-badge&labelColor=060b18&color=00d4ff" height="40"/>

# MediIntel — AI-Powered Healthcare Platform

**A full-stack MERN healthcare platform powered by Llama 3.3 70B + Llama 4 Scout Vision**

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com/atlas)
[![Python](https://img.shields.io/badge/Python-3.8+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[Features](#-features) · [Tech Stack](#-tech-stack) · [Getting Started](#-getting-started) · [Environment Variables](#-environment-variables) · [API Reference](#-api-reference) · [Project Structure](#-project-structure)

</div>

---

## 📖 Overview

MediIntel is a complete healthcare platform that connects patients and doctors through AI. Patients can analyze medical reports, check symptoms, track medicines, submit cases to doctors, and book appointments. Doctors get an AI-prioritized patient queue, prescription writer, appointment management, and clinical analytics — all stored in MongoDB and powered by Meta's Llama models via Groq.

---

## ✨ Features

### 👤 Patient Portal

| Feature | Description |
|---|---|
| 🩺 **Symptom Analyzer** | Describe symptoms → Llama 3.3 70B identifies possible conditions, urgency, and specialist needed |
| 🧬 **Report Analyzer** | Upload blood tests, X-rays, MRI, ECG, prescriptions — **Llama 4 Scout Vision** reads images automatically, report type detected without manual selection |
| 💊 **Medicine Reminders** | Add medicines with dosage, frequency, timing — mark as taken, stored in MongoDB |
| 🔍 **Medicine Scan** | Upload medicine packaging photo → Llama Vision checks if it is **authentic or counterfeit** with confidence score |
| 🧘 **Mental Health Chat** | AI wellness companion — mood logging, breathing exercises, mental health support |
| 🚨 **Emergency SOS** | One-tap emergency alert with location — logs to MongoDB |
| 🩸 **Blood Donor Search** | Find blood donors by blood group and city |
| 📅 **Appointment Booking** | Book appointments manually with doctor name, specialty, date, slot — stored in MongoDB |
| 📋 **Submit Case to Doctors** | Describe your problem → Llama AI triages with severity score (0–100), urgency, specialty routing |
| 💊 **My Prescriptions** | View prescriptions written by your doctor with medicines, dosage, tests, and follow-up |

### 👨‍⚕️ Doctor Portal

| Feature | Description |
|---|---|
| 🏥 **Overview Dashboard** | AI patient recommendations sorted by Llama severity — emergencies always first |
| 👥 **My Patients** | All patients from appointments and matched case submissions — full 4-tab profile view |
| 📅 **Appointments** | All booked appointments — confirm, complete, cancel with status saved to MongoDB |
| 📋 **Prescription Writer** | Write prescriptions with medicines, dosage, frequency, timing, tests, follow-up — patient sees it instantly |
| 📈 **Analytics** | Live MongoDB aggregations — monthly case trends, severity distribution, urgency breakdown, specialty demand |
| 🧘 **Wellness Chatbot** | Floating mental health chatbot for doctors addressing burnout and stress |
| 🤖 **AI Case Review** | Per-patient Llama triage: severity score, red flags, clinical summary, routing reasoning |

### 🔐 Authentication

| Method | Description |
|---|---|
| 📧 **Email / Password** | Standard JWT-based registration and login |
| 🔵 **Google OAuth** | One-click Google sign-in — creates or links account automatically, no extra package required |
| 👤 **Role-based Access** | Patient and Doctor portals are completely separate with different sidebars and routes |

---

## 🛠 Tech Stack

### Frontend
```
React 18 + Vite          — UI framework and dev server
React Router v6          — Client-side routing
react-hot-toast          — Toast notifications
Canvas API               — Custom animated bar charts in Analytics
Google Identity Services — Google OAuth (no npm package needed)
```

### Backend
```
Node.js + Express        — REST API server
MongoDB Atlas + Mongoose — Database and ODM
JWT + bcryptjs           — Authentication and password hashing
Multer                   — File uploads (PDF, CSV, JPG, PNG)
Helmet + CORS            — Security headers and cross-origin
express-rate-limit       — API rate limiting
Morgan                   — HTTP request logging
axios                    — Groq API calls and Google cert verification
```

### AI / ML
```
Llama 3.3 70B  (via Groq)          — Symptom analysis, report interpretation,
                                     mental health chat, patient case triage,
                                     medicine scan authentication
Llama 4 Scout Vision  (via Groq)   — Medical image reading — X-rays, lab reports,
                                     prescriptions, discharge summaries from photos
Python + scikit-learn               — Local ML models: diabetes risk, health scoring
```

### Database Collections
```
User            — Patients and doctors (role, Google OAuth fields, specialization)
Appointment     — Bookings linked to patient and doctor by _id
PatientCase     — AI-triaged submissions with full Llama analysis JSON
Prescription    — Doctor-written prescriptions visible to patients
Report          — Analyzed medical reports with extracted test values
ScanResult      — Medicine authenticity scan results
SymptomCheck    — Symptom checker session history
Medicine        — Patient medicine reminder list
MoodLog         — Mental health mood entries
EmergencyAlert  — SOS alert records with location
HealthRecord    — General health data
BloodDonor      — Blood donor registrations
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Download |
|---|---|---|
| Node.js | 18 LTS+ | [nodejs.org](https://nodejs.org) |
| Python | 3.8+ | [python.org](https://python.org) — check **Add to PATH** |
| Git | any | [git-scm.com](https://git-scm.com) |
| MongoDB Atlas account | free tier | [mongodb.com/atlas](https://mongodb.com/atlas) |
| Groq API Key | free | [console.groq.com](https://console.groq.com) |

Verify your installs:

```bash
node --version    # v18.x.x or higher
npm --version     # 9.x.x or higher
python --version  # 3.8.x or higher
git --version     # 2.x.x
```

---

### 1 · Clone the Repository

```bash
git clone https://github.com/yourusername/mediintel.git
cd mediintel
```

---

### 2 · Backend Setup

```bash
cd medicore-backend
npm install
```

Create `.env` inside `medicore-backend/`:

```env
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/mediintel
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d
GROQ_API_KEY=gsk_your_groq_api_key_here
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
UPLOAD_DIR=uploads
NODE_ENV=development
```

Start the backend:

```bash
npm run dev
# ✓ Server running on port 5000
# ✓ MongoDB connected successfully
```

---

### 3 · Python ML Setup *(optional)*

```bash
cd medicore-backend/ml
pip install -r requirements.txt
bash train_all.sh      # first time only — trains the local ML models
```

> Skip this step if you do not need the diabetes risk or health score features locally. The rest of the app works without it.

---

### 4 · Frontend Setup

Open a **second terminal**:

```bash
cd medicore-react-01
npm install
```

Create `.env` inside `medicore-react-01/`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
```

Start the frontend:

```bash
npm run dev
# ✓ Local:  http://localhost:5173
```

Open **http://localhost:5173** — both terminals must be running at the same time.

---

## 🔑 Environment Variables

### Backend — `medicore-backend/.env`

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | Server port (default `5000`) |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | Any long random string |
| `JWT_EXPIRES_IN` | Yes | Token expiry e.g. `7d` |
| `GROQ_API_KEY` | Yes | From [console.groq.com](https://console.groq.com) → API Keys |
| `GOOGLE_CLIENT_ID` | Optional | From Google Cloud Console → Credentials |
| `UPLOAD_DIR` | Yes | Folder for uploaded files, default `uploads` |

### Frontend — `medicore-react-01/.env`

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Backend URL — `http://localhost:5000/api` locally |
| `VITE_GOOGLE_CLIENT_ID` | Optional | Same Google Client ID as backend |

### Google OAuth Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create project → APIs & Services → Credentials → **Create OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Authorized JavaScript origins: `http://localhost:5173`
5. Copy the Client ID into both `.env` files above

---

## 📡 API Reference

### Auth — `/api/auth`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Register new patient or doctor |
| POST | `/login` | Email and password login |
| POST | `/google` | Google OAuth login |
| GET | `/me` | Get current authenticated user |
| POST | `/logout` | Logout |

### Patient Features

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/symptoms/analyze` | Analyze symptoms with Llama 3.3 70B |
| POST | `/api/reports/upload` | Upload and analyze report (Llama Vision for images) |
| GET | `/api/reports` | List my reports |
| CRUD | `/api/medicines` | Medicine reminders |
| POST | `/api/medicine-scan/verify` | Authenticate medicine packaging |
| POST | `/api/mental/chat` | Mental health chat |
| POST | `/api/mental/mood` | Log mood |
| POST | `/api/patient-cases` | Submit case for doctor triage |
| GET | `/api/patient-cases` | My submitted cases |
| POST | `/api/appointments` | Book appointment |
| GET | `/api/appointments` | My appointments |
| GET | `/api/prescriptions/my` | My prescriptions from doctor |
| POST | `/api/emergency/trigger` | Send SOS alert |
| GET | `/api/blood/search` | Search blood donors |

### Doctor Portal — `/api/doctor-portal`

| Method | Endpoint | Description |
|---|---|---|
| GET/PUT | `/profile` | Doctor profile and specialization |
| GET | `/recommendations` | AI-matched patient cases |
| GET | `/my-patients` | All patients |
| GET | `/patient/:id` | Full patient profile |
| GET | `/appointments` | Doctor's appointments |
| PUT | `/appointments/:id` | Update appointment status |
| POST | `/review-case` | Mark case reviewed or resolved |
| POST | `/prioritize` | Re-run Llama triage on a case |
| GET | `/analytics` | Live analytics from MongoDB |

### Prescriptions — `/api/prescriptions`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/` | Doctor creates prescription |
| GET | `/` | Doctor lists their prescriptions |
| GET | `/my` | Patient views their prescriptions |
| PUT | `/:id` | Doctor updates prescription |
| DELETE | `/:id` | Doctor deletes prescription |

---

## 📁 Project Structure

```
mediintel/
│
├── medicore-backend/
│   ├── controllers/
│   │   ├── controllers.js              # Symptoms, reports, medicines, scan, blood, emergency
│   │   ├── authController.js           # Register, login, Google OAuth
│   │   ├── doctorPortalController.js   # Doctor data — patients, appointments, analytics
│   │   ├── patientCaseController.js    # Patient case submission
│   │   └── prescriptionController.js  # Prescription CRUD
│   ├── routes/                         # 15 Express route files
│   ├── models/
│   │   ├── User.js                     # User with role + Google OAuth fields
│   │   └── index.js                    # All other Mongoose schemas
│   ├── middleware/
│   │   ├── auth.js                     # JWT protect + optionalAuth
│   │   └── upload.js                   # Multer config
│   ├── services/
│   │   ├── groqService.js              # Llama 3.3 + Llama 4 Vision API wrappers
│   │   └── googleAuthService.js        # Google token verifier using axios + jsonwebtoken
│   ├── ml/
│   │   ├── predict.py                  # Health score ML
│   │   ├── analyze.py                  # Report analysis ML
│   │   ├── mlService.js                # Python runner
│   │   └── requirements.txt
│   ├── uploads/                        # Uploaded files (gitignored)
│   ├── .env                            # Environment variables (gitignored)
│   └── server.js
│
└── medicore-react-01/
    └── src/
        ├── pages/
        │   ├── Login.jsx               # Email + Google OAuth
        │   ├── Patientdashboard.jsx    # Patient home
        │   ├── Doctordashboard.jsx     # Doctor overview + AI queue
        │   ├── DoctorPatients.jsx      # My patients
        │   ├── DoctorAppointments.jsx  # Appointment management
        │   ├── DoctorPrescriptions.jsx # Prescription writer
        │   ├── DoctorAnalytics.jsx     # Charts and analytics
        │   ├── Reports.jsx             # AI report analyzer
        │   ├── Symptoms.jsx            # Symptom checker
        │   ├── MedicineScan.jsx        # Medicine authenticity
        │   ├── MentalHealth.jsx        # Mental wellness
        │   └── ...
        ├── context/
        │   └── AuthContext.jsx         # JWT + role state
        ├── services/
        │   └── api.js                  # All API calls
        └── components/
            └── Sidebar.jsx             # Role-aware sidebar
```

---

## 🎨 Design System

```css
/* Accents */
--cyan:    #00d4ff    /* patient portal */
--purple:  #7c5cfc    /* doctor portal  */
--green:   #00e5b0    /* success / low severity */
--amber:   #ffb020    /* warning / moderate     */
--red:     #ff4757    /* error / critical        */

/* Backgrounds */
--bg-void:    #060b18
--bg-card:    #131e33
--bg-surface: #0f1a2e

/* Typography */
--font-display: 'Syne'
--font-body:    'DM Sans'
--font-mono:    'JetBrains Mono'
```

---

## 🚢 Deployment

### Frontend — Netlify / Vercel

```
Build command:     npm run build
Publish directory: medicore-react-01/dist
```

Set environment variables in your hosting dashboard:
```
VITE_API_URL=https://your-backend-url.com/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

### Backend — Render / Railway / VPS

```
Start command:  node server.js
Root directory: medicore-backend
```

Add all backend environment variables. Update Google OAuth authorized origins to your production frontend URL.

---

## ⚠️ Known Limitations

- Uploaded files stored on local filesystem — use S3 or Cloudinary for production
- Python ML runs as a blocking child process — migrate to FastAPI for production scale
- No email verification or password reset flow
- JWT refresh tokens not implemented — sessions expire after 7 days

---

## 📜 License

This project is licensed under the [MIT License](LICENSE) — free to use, modify, and distribute.

---

<div align="center">

Powered by [Groq](https://groq.com) · [Meta Llama](https://llama.meta.com) · [MongoDB Atlas](https://mongodb.com/atlas) · [Google OAuth](https://developers.google.com/identity)

<br/>

<sub>⚕️ MediIntel is for educational purposes only. Always verify medical information with a licensed physician.</sub>

</div>
