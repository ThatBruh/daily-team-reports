# Daily Team Tracker / Standup App — Current State & Feature Audit

## 1. Overview
The application is an internal **Daily Standup & Team Activity Tracker** designed to streamline daily progress updates, blocker tracking, report imports/exports, and team visibility. It is built with a **React + Vite** frontend and leverages **Supabase** (Postgres database and Deno Edge Functions) integrated with **Google Gemini AI** for natural language understanding and document parsing.

---

## 2. Directory Structure & Organization

```
daily-team-reports/
├── Frontend_Code/                # Frontend application code
│   ├── src/
│   │   ├── assets/               # Static assets & icons
│   │   ├── App.css / index.css   # Main stylesheet & theme rules
│   │   ├── App.jsx               # Navigation shell & layout
│   │   ├── Dashboard.jsx         # Summary cards, submission status, open blockers
│   │   ├── Insights.jsx          # Analytics & distribution charts (Recharts)
│   │   ├── EntryForm.jsx         # Manual standup entry with AI note assistant
│   │   ├── Import.jsx            # Multi-format report parser & batch importer
│   │   ├── History.jsx           # Chronological review and multi-format exports
│   │   ├── Team.jsx              # Team roster management (add/deactivate)
│   │   ├── parseNotes.js         # Supabase client wrapper for AI note parsing
│   │   ├── readReport.js         # File reader (PDF, DOCX, XLSX, TXT, CSV, MD)
│   │   ├── exportReport.js       # Word (.docx) report generator
│   │   ├── exportFiles.js        # PDF & Excel (.xlsx) export generators
│   │   └── supabaseClient.js     # Supabase SDK initialization
│   ├── public/                   # Public static assets
│   ├── index.html                # Vite entry HTML
│   ├── vite.config.js            # Vite configuration
│   └── eslint.config.js          # ESLint rules
├── Backend_Code/                 # Backend & Database layer
│   └── supabase/
│       ├── config.toml           # Supabase local/project configuration
│       └── functions/            # Supabase Edge Functions (Deno + Gemini AI)
│           ├── parse-notes/      # Converts free-form messy notes to structured fields
│           └── parse-report/     # Parses whole files (PDF/Text/Excel) into standup entries
└── Project_Planning/             # Project documentation, feature specs & roadmaps
    └── CURRENT_FEATURES.md       # Current feature inventory & system capabilities
```

---

## 3. Current Feature Inventory

### 🟢 1. Dashboard (`Dashboard.jsx`)
- **Submission Tracking**: Shows which active team members have submitted daily updates for today and who is still pending.
- **Time Range Filtering**: Filter views by `Today`, `7 days`, `30 days`, or `All`.
- **Blocker & Issue Tracker**:
  - Automatically aggregates issues/blockers across entries.
  - Computes recurrence/duration (`firstSeen`, `lastSeen`, days active).
  - Allows marking blockers as resolved directly from the UI.
- **Recent Activity Feed**: Displays daily activity streams grouped by date and member.

### 🟢 2. Insights & Analytics (`Insights.jsx`)
- **Interactive Visualizations**: Powered by **Recharts**.
- **Distribution Breakdowns**:
  - Team member contribution share.
  - Blocker frequency by team member.
  - Activity vs. completion breakdowns over selectable timeframes (`Today`, `7 days`, `30 days`, `All`).

### 🟢 3. Daily Entry Form with AI Assistant (`EntryForm.jsx` + `parseNotes.js`)
- **Dual Section Structure**:
  - **Completed Section**: Yesterday/past tasks (Activity, Progress, Issue/Blocker, Collaboration).
  - **Today Section**: Current focus/plan (Activity, Progress, Issue/Blocker, Collaboration).
- **AI Raw Notes Parser**:
  - Users can paste rough/messy thoughts or bullet points into a text area.
  - Calls Gemini AI via Edge Function to automatically sort and normalize text into structured fields.
- **Input Fallback**: Automatically fills empty fields with `'N/A'` to keep database consistency.

### 🟢 4. Batch Import (`Import.jsx` + `readReport.js`)
- **Multi-Format Support**: Reads `.docx`, `.pdf`, `.xlsx`, `.txt`, `.csv`, and `.md` files in-browser.
- **AI-Powered Extraction**: Sends extracted text or base64 PDF payloads to the `parse-report` Supabase Edge Function to extract structured standup entries per person and date.
- **Pre-import Review Table**:
  - Interactive table allowing review and manual edits before committing to the database.
  - Automatic member name matching against active team members.
  - Duplicate/collision warning badge if an entry already exists for a given member and date.

### 🟢 5. History & Multi-Format Export (`History.jsx`, `exportReport.js`, `exportFiles.js`)
- **Date Selector**: Browse past submissions chronologically by date.
- **Grouped Presentation**: Summarizes all member updates for the chosen date.
- **Document Exporters**:
  - **Word Export (`.docx`)**: Formatted document using the `docx` package.
  - **PDF Export (`.pdf`)**: Styled tables using `jspdf` & `jspdf-autotable`.
  - **Excel Export (`.xlsx`)**: Formatted multi-column spreadsheets using `exceljs`.

### 🟢 6. Team Management (`Team.jsx`)
- **Roster Management**: Add new team members with duplicate-name prevention.
- **Soft Deactivation**: Remove/deactivate members while preserving their past standup history.

---

## 4. Backend & Database Architecture

### Data Models (Supabase Postgres)
1. **`team_members`**:
   - `id` (UUID / PK)
   - `name` (Text)
   - `active` (Boolean)
   - `created_at` (Timestamp)
2. **`daily_entries`**:
   - `id` (UUID / PK)
   - `member_id` (FK -> `team_members.id`)
   - `entry_date` (Date)
   - `section` ('completed' | 'today')
   - `activity` (Text)
   - `progress` (Text)
   - `issue_blocker` (Text)
   - `blocker_resolved` (Boolean)
   - `collaboration` (Text)
   - `created_at` (Timestamp)

### Edge Functions (Gemini 3.1 Flash Lite)
1. **`parse-notes`**: Deno edge function with fallback retries that takes messy unformatted user notes and returns a JSON schema with `completed` and `today` sections.
2. **`parse-report`**: Deno edge function supporting PDF and raw text to extract multi-member standup logs across dates.
