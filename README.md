# YouTube Social Media Management & Scheduling Tool (Supabase Edition)

A professional **Multi-User** YouTube scheduling and automation platform built with:
- 🚀 **Node.js + Express** (Backend)
- ⚛️ **React + Vite** (Frontend)
- ☁️ **Supabase** (Database, Auth, and Storage)
- 🤖 **Gemini / OpenRouter AI** (Smart Title & Description Generation)
- 📅 **Buffer-style Auto-Scheduling** engine

---

## 🚀 Quick Start

### Step 1: Initialize Environment
1.  Navigate to `backend-node/` and create a `.env` file:
    ```bash
    PORT=8080
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    CORS_ORIGIN=http://localhost:5173
    ```
2.  Navigate to `frontend/` and ensure `.env` matches the backend URLs.

### Step 2: Configure Supabase Redirects
> [!IMPORTANT]
> To prevent login issues, you **must** add your local URL to the Supabase Allow List:
> 1. Go to **Supabase Dashboard -> Authentication -> URL Configuration**.
> 2. Add `http://localhost:5173/` to **Redirect URLs**.

### Step 3: Launch Platform
In the project root, run:
```bash
START.bat
```
The platform will automatically open at **http://localhost:5173**.

---

## 📋 Required Credentials

| Credential | Where to get it | Purpose |
|---|---|---|
| `client_secret.json` | Google Cloud Console | OAuth connection to YouTube |
| Supabase URL/Key | [supabase.com](https://supabase.com) | Database and User Auth |
| OpenRouter API Key | [openrouter.ai](https://openrouter.ai) | AI processing |

---

## ✨ Key Features
- **Multi-Tenant Isolation**: Each user manages their own channels and videos.
- **Auto-Scheduling**: Define a posting frequency (e.g., 3/week) and the tool fills the slots automatically.
- **Bulk Upload**: Drag and drop dozens of videos at once.
- **AI-Powered SEO**: Automatically rewrite titles and descriptions for maximum reach.
- **Real-time Progress**: Live upload tracking and error reporting.

---

## 🏗 Architecture
- **Backend**: Node.js v20+, TypeScript, Express.
- **Database**: Supabase (PostgreSQL with RLS).
- **Authentication**: Supabase Auth (Google OAuth).
- **Frontend**: React, Lucide Icons, Glassmorphism UI.
