# MediCore AI — MERN Backend (MongoDB Atlas)

Express.js + MongoDB Atlas REST API for MediCore AI Health Platform.

---

## MongoDB Atlas Setup (do this first)

### Step 1 — Create a free cluster
1. Go to [mongodb.com/atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up / Log in → **Create a Free Cluster** (M0 Sandbox, free forever)
3. Choose any cloud provider and region → click **Create Deployment**

### Step 2 — Create a database user
1. Atlas sidebar → **Database Access** → **Add New Database User**
2. Set a **Username** and **Password** (remember these)
3. Role: **Atlas admin** (or Read and write to any database)
4. Click **Add User**

### Step 3 — Whitelist your IP address
1. Atlas sidebar → **Network Access** → **Add IP Address**
2. Click **Allow Access from Anywhere** → adds `0.0.0.0/0`
3. Click **Confirm**

### Step 4 — Get your connection string
1. Go to your cluster → click **Connect**
2. Choose **Drivers** → Node.js → version **5.5 or later**
3. Copy the string — it looks like:
   ```
   mongodb+srv://john:<password>@cluster0.abc12.mongodb.net/?retryWrites=true&w=majority
   ```
4. Replace `<password>` with your real password
5. Add the database name (`medicore`) before `?`:
   ```
   mongodb+srv://john:mypassword@cluster0.abc12.mongodb.net/medicore?retryWrites=true&w=majority
   ```

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
```

Open `.env` and paste your Atlas connection string:
```env
MONGO_URI=mongodb+srv://john:mypassword@cluster0.abc12.mongodb.net/medicore?retryWrites=true&w=majority
JWT_SECRET=pick_any_long_random_string_here
```

```bash
# 3. Start server
npm run dev     # development with auto-restart (nodemon)
npm start       # production
```

Expected output:
```
✅ MongoDB Atlas connected → cluster0.abc12.mongodb.net
   Database: medicore
⚕️  MediCore API running → http://localhost:5000
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Register new user |
| POST | `/api/auth/login` | — | Login, receive JWT |
| GET  | `/api/auth/me` | ✅ | Get current user |
| POST | `/api/symptoms/analyze` | Optional | AI symptom analysis |
| GET  | `/api/symptoms/suggestions` | — | Symptom autocomplete |
| POST | `/api/reports/upload` | Optional | Upload blood test CSV/PDF |
| GET  | `/api/reports` | Optional | List reports |
| GET  | `/api/records` | ✅ | List health records |
| POST | `/api/records` | ✅ | Create health record |
| PUT  | `/api/records/:id` | ✅ | Update record |
| DELETE | `/api/records/:id` | ✅ | Delete record |
| GET  | `/api/dashboard/health-score` | — | Health score + vitals |
| GET  | `/api/dashboard/risks` | — | Disease risk scores |
| GET  | `/api/dashboard/timeline` | — | Health trends |
| GET  | `/api/medicines` | ✅ | List medicine reminders |
| POST | `/api/medicines` | ✅ | Add reminder |
| PUT  | `/api/medicines/:id` | ✅ | Update reminder |
| PUT  | `/api/medicines/:id/toggle` | ✅ | Toggle taken |
| DELETE | `/api/medicines/:id` | ✅ | Delete reminder |
| POST | `/api/emergency/trigger` | Optional | Trigger SOS alert |
| GET  | `/api/emergency/history` | Optional | Alert history |
| GET  | `/api/doctors` | — | List doctors |
| POST | `/api/appointments` | Optional | Book appointment |
| GET  | `/api/appointments` | Optional | List appointments |
| GET  | `/api/blood/search?blood_group=A+` | — | Search donors |
| POST | `/api/blood/register` | — | Register as donor |
| POST | `/api/mental/chat` | — | AI mental health chat |
| POST | `/api/mental/mood` | Optional | Log mood |
| GET  | `/api/mental/mood/history` | Optional | Mood history |
| POST | `/api/medicine-scan/verify` | — | Verify medicine |

---

## Project Structure

```
medicore-backend/
├── server.js               ← Express app entry point
├── config/
│   └── db.js               ← MongoDB Atlas connection
├── models/
│   ├── User.js             ← User schema (bcrypt + JWT)
│   └── index.js            ← All other Mongoose models
├── controllers/
│   ├── authController.js   ← Register, login, me
│   └── controllers.js      ← All feature controllers
├── routes/                 ← 12 Express route files
├── middleware/
│   ├── auth.js             ← JWT protect + optionalAuth
│   ├── errorHandler.js     ← Global error handler
│   └── upload.js           ← Multer file uploads
├── uploads/                ← Uploaded files (auto-created)
├── .env.example
└── README.md
```

---

## Collections Created Automatically

| Collection | Stores |
|---|---|
| `users` | Registered users (hashed passwords) |
| `symptomchecks` | AI symptom analysis history |
| `reports` | Uploaded medical reports |
| `healthrecords` | Patient records |
| `medicines` | Medication reminders |
| `emergencyalerts` | SOS alert logs |
| `appointments` | Doctor bookings |
| `moodlogs` | Mental health mood tracking |
| `blooddonors` | Registered blood donors |

No manual collection setup needed — Mongoose creates them on first use.

---

## View Your Data in Atlas

Atlas Dashboard → your cluster → **Browse Collections** → select **medicore** database

---

## Common Errors

| Error | Fix |
|---|---|
| `MONGO_URI is not set` | Add `MONGO_URI=mongodb+srv://...` to your `.env` |
| `Authentication failed` | Wrong password in connection string |
| `connection timed out` | IP not whitelisted → Atlas Network Access → Add `0.0.0.0/0` |
| `cluster is paused` | Resume it in Atlas dashboard |
| `ENOTFOUND cluster...` | Wrong cluster URL in connection string |

---

## Authentication

Protected routes need this header:
```
Authorization: Bearer <jwt_token>
```
Get the token from `POST /api/auth/login` → `access_token` field.

> ⚕️ MediCore is for educational purposes. Always consult a licensed physician.
