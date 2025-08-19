# LinkedIn Auto Apply Bot

An intelligent automation tool that automatically searches and applies to **LinkedIn Easy Apply jobs** based on your filters and preferences.  
Built with **Flask + SQLite (backend)** and **React + Vite (frontend)**, powered by **Playwright** for browser automation.

---

## 🚀 Features

- **LinkedIn Automation**
  - Logs into your LinkedIn using your existing Chrome profile
  - Navigates to Jobs tab with your filters applied (keywords, location, experience, etc.)
  - Detects jobs with **Easy Apply** button
  - Fills in the application form with:
    - Uploaded resume
    - Auto-answer to screening questions (eligibility, experience, skills, etc.)
    - Safe defaults (Yes/No, 1–3 years, etc.)
  - Skips jobs if:
    - Cover letter is required
    - Resume re-upload is required
    - Redirects to external ATS
    - Application has too many custom questions
    - Job is older than 10–14 days
    - Title contains "Senior", "Lead", "Principal", etc.

- **Application Tracking**
  - Records each application in `app.db` SQLite database
  - Tracks **success**, **failures**, **skipped reasons**
  - Export all applications to CSV

- **UI Dashboard**
  - Start/Stop automation
  - View real-time stats (applications/hour, runtime, success rate)
  - Browse recent applications
  - Manage settings (keywords, location, job type, etc.)

---

## 🛠 Tech Stack

- **Backend:** Python 3, Flask, Flask-CORS, SQLite, Playwright  
- **Frontend:** React, Vite, TailwindCSS  
- **Automation:** Playwright (Chrome with persistent profile)  

---

## 📂 Project Structure

```plaintext
linkedin-auto-apply-playwright/
│
├── linkedin-auto-apply-backend/       # Flask backend
│   ├── src/
│   │   ├── main.py                    # Flask entrypoint
│   │   └── routes/
│   │       └── automation.py          # Core automation logic
│   └── database/                      # SQLite DB files
│
├── linkedin-auto-apply/               # React frontend
│   ├── src/                           # Frontend source
│   └── package.json
│
└── README.md
```

---

## ⚙️ Installation

### 1. Clone repo

```bash
git clone https://github.com/your-username/linkedin-auto-apply.git
cd linkedin-auto-apply-playwright
```

### 2. Backend Setup (Python + Flask)

```bash
cd linkedin-auto-apply-backend
python3 -m venv .venv
source .venv/bin/activate   # (Linux/Mac)
# .venv\Scripts\activate    # (Windows)

pip install -r requirements.txt
python -m playwright install chromium
```

### 3. Frontend Setup (React + Vite)

```bash
cd ../linkedin-auto-apply
npm install
```

---

## ▶️ Usage

### Start Backend

```bash
cd linkedin-auto-apply-backend
source .venv/bin/activate
python src/main.py
```

Backend runs at: http://localhost:5000

### Start Frontend

```bash
cd linkedin-auto-apply
VITE_API_BASE=http://localhost:5000/api/automation npm run dev
```

Frontend opens at: http://localhost:5173

---

## 🔧 Configuration

All settings are configurable from the UI → Settings Tab, stored in SQLite (automation_settings table).

**Default Filters:**
- Keywords: Software Engineer, Developer, QA, Full Stack
- Location: United States
- Experience level: Entry, Associate
- Job type: Full-time, Contract

**Skip Rules:**
- Skip cover letter required
- Skip resume re-upload
- Skip external redirects
- Skip job titles with Senior/Lead/Principal
- Skip jobs older than 14 days

---

## 🔑 Authentication

The bot uses your existing Chrome profile to stay logged into LinkedIn:

- **macOS:** `~/Library/Application Support/Google/Chrome/Default`
- **Windows:** `%LOCALAPPDATA%\Google\Chrome\User Data\Default`

⚠️ On first run, macOS may ask for Keychain access to unlock saved LinkedIn cookies. Allow it.

---

## 📊 Database

SQLite database (`app.db`) stores:

- `job_applications` → each applied job
- `automation_settings` → user preferences

**Export applications:**

```bash
GET http://localhost:5000/api/automation/export
```

---

## 🖼 Screenshots

- Job dashboard with stats
- Real-time automation progress
- Recent applications list

*(Insert screenshots here)*

---

## ⚠️ Disclaimer

- This project is for **educational and personal use only**.
- Automating job applications may violate LinkedIn's Terms of Service.
- Use responsibly, at your own risk.

---

## 📌 Roadmap

- [ ] Improve question auto-answering with ML/NLP
- [ ] Dockerized deployment
- [ ] Multi-profile support
- [ ] Retry failed applications

---

## 👨‍💻 Author

Developed by Your Name