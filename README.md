# 🧠 Resume Builder — AI-Powered ATS Resume Optimizer

Transform your resume to match any job description using Claude, GPT-4o, or a local Ollama model.  
One click generates a tailored resume, gap analysis, and cover letter — all downloadable as `.docx`.

---

## ✨ Features

- **ATS-Optimized Resume** — Rewritten to match the JD's keywords and requirements
- **Match Score** — 0–100% match with color-coded indicator
- **Gap Analysis** — Strong matches, skill gaps, dealbreakers, and recommendations
- **Cover Letter** — 3–4 paragraph letter from a hiring manager's perspective
- **`.docx` Download** — ATS-clean Word files for resume and cover letter
- **Multi-Provider LLM** — Claude (primary) → GPT-4o → Ollama with auto-fallback
- **Your key, your data** — API keys stored in `sessionStorage` only, never logged

---

## 🚀 Quick Start

```bash
# 1. Clone
git clone <your-repo-url>
cd resume-builder

# 2. Install
npm install

# 3. Configure
cp .env.example .env.local
# No API keys needed in .env.local — users paste their own key in the UI

# 4. Run locally
npm run dev
# → Open http://localhost:3000
```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env.local`. All values have sensible defaults:

| Variable | Default | Description |
|---|---|---|
| `DEFAULT_LLM_PROVIDER` | `anthropic` | Which provider to try first |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | Claude model ID |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model ID |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3` | Ollama model name |

> **API keys are NOT in `.env`** — users paste their own key in the UI. Keys are held in `sessionStorage` and sent per-request over HTTPS. They are never logged, stored, or returned.

---

## 🔀 LLM Fallback Chain

```
User selects provider (e.g. Claude)
  ↓ fails (timeout / auth error / rate limit)
GPT-4o
  ↓ fails
Ollama (local)
  ↓ fails
Error shown to user with details
```

A banner appears in the UI whenever a fallback provider was used.

---

## 🚢 Deploy to Vercel

```bash
npx vercel
```

In Vercel Dashboard → Project → Settings → Environment Variables, add:

```
DEFAULT_LLM_PROVIDER=anthropic
ANTHROPIC_MODEL=claude-sonnet-4-20250514
OPENAI_MODEL=gpt-4o
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
NEXT_PUBLIC_APP_NAME=Resume Builder
NEXT_PUBLIC_APP_VERSION=1.0.0
```

No API keys go into Vercel — users bring their own.

---

## 📁 Project Structure

```
app/
  layout.tsx              # Root layout + SEO metadata
  page.tsx                # Main single-page UI
  globals.css             # Premium dark theme (pure CSS, no Tailwind)
  api/
    generate/route.ts     # LLM router API
    download/route.ts     # DOCX generation + file download
components/
  ProviderSelector.tsx    # LLM provider + API key input
  ResumeForm.tsx          # Resume + JD inputs + generate button
  OutputPanel.tsx         # Gap analysis + resume/cover letter preview
  DownloadButton.tsx      # Triggers .docx download
lib/
  llm/
    index.ts              # Fallback chain router
    anthropic.ts          # Claude handler
    openai.ts             # GPT-4o handler
    ollama.ts             # Ollama handler
  prompt.ts               # Master hiring manager prompt builder
  docxGenerator.ts        # ATS-clean resume .docx generator
  coverLetterGenerator.ts # Cover letter .docx generator
types/index.ts            # Shared TypeScript types
```

---

## 🔒 Security Model

```
User pastes API key in UI
  → sessionStorage (cleared on tab close)
  → Sent in HTTPS request body to /api/generate
  → Used to call LLM provider
  → Key is NEVER logged, stored, or returned
```

---

## 📦 Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| LLM Primary | Anthropic Claude |
| LLM Fallback 1 | OpenAI GPT-4o |
| LLM Fallback 2 | Ollama (local) |
| DOCX | `docx` npm package |
| Icons | Lucide React |
| Hosting | Vercel |
