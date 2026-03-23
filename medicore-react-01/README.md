# MediCore AI — React + Vite Frontend

Converted from vanilla HTML/CSS/JS to a full React 18 + Vite + React Router v6 SPA.

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:5173
```

## Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── App.jsx                    ← Root component with all routes
├── main.jsx                   ← ReactDOM entry point
├── index.css                  ← Design tokens (CSS variables) + global styles
│
├── context/
│   ├── AuthContext.jsx        ← Authentication state (localStorage)
│   └── ToastContext.jsx       ← Toast notification system
│
├── services/
│   └── api.js                 ← All API calls (mirrors original api.js)
│
├── components/
│   ├── AppLayout.jsx          ← Auth guard + sidebar wrapper (Outlet)
│   ├── Sidebar.jsx            ← Collapsible sidebar with NavLink active states
│   ├── UI.jsx                 ← Card, Button, Badge, Input, Alert, etc.
│   ├── LineChart.jsx          ← Canvas-based line chart
│   └── ProgressRing.jsx       ← SVG circular progress ring
│
└── pages/
    ├── Home.jsx               ← Landing page (redirects to /dashboard if logged in)
    ├── Login.jsx              ← Login / Register with demo mode fallback
    ├── Dashboard.jsx          ← Health score, vitals, risk bars, trend chart
    ├── Symptoms.jsx           ← AI symptom checker with condition results
    ├── Reports.jsx            ← Medical report upload & analysis
    ├── Medicines.jsx          ← Medication tracker with adherence tracking
    ├── MentalHealth.jsx       ← Chat bot, mood logger, breathing exercise
    ├── Emergency.jsx          ← SOS button with countdown + contacts
    ├── BloodDonor.jsx         ← Donor search + donor registration
    └── MedicineScan.jsx       ← Medicine authenticity scanner
```

## Connecting to Backend

The frontend calls `http://localhost:5000/api` by default.

To change the API URL, create a `.env` file:

```env
VITE_API_URL=https://your-backend.com/api
```

## Demo Mode

If the backend is offline (network error or 5xx response), the app automatically
enters demo mode — login works with any credentials, and all pages show realistic
mock data so the UI can be fully explored without a backend.

## Design System

| Token | Value | Usage |
|---|---|---|
| `--cyan`   | `#00d4ff` | Primary accent |
| `--green`  | `#00e5b0` | Success / positive |
| `--red`    | `#ff4757` | Errors / emergency |
| `--amber`  | `#ffb020` | Warnings |
| `--purple` | `#7c5cfc` | Mental health |

Fonts: **Syne** (display) · **DM Sans** (body) · **JetBrains Mono** (mono)

> ⚕️ For educational purposes only. Always consult a licensed physician.
