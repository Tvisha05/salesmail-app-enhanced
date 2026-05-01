# SalesMail AI

A beginner-friendly, full-stack AI application that helps sales teams generate personalized emails for customers at scale.

If you are opening this project for the first time, this README explains:

- what the app does
- why each technology is used
- how data moves through the system
- how to run everything locally
- how to troubleshoot common issues

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Who This Project Is For](#who-this-project-is-for)
3. [How the App Works (Simple Flow)](#how-the-app-works-simple-flow)
4. [Detailed Tech Stack (Beginner-Friendly)](#detailed-tech-stack-beginner-friendly)
5. [Architecture and Data Flow](#architecture-and-data-flow)
6. [Folder and File Guide](#folder-and-file-guide)
7. [Setup Requirements](#setup-requirements)
8. [Step-by-Step Local Setup](#step-by-step-local-setup)
9. [Environment Variables Explained](#environment-variables-explained)
10. [Run the App](#run-the-app)
11. [Frontend Features Explained](#frontend-features-explained)
12. [Backend Features Explained](#backend-features-explained)
13. [AI Generation Logic](#ai-generation-logic)
14. [Caching, Fallback, and Demo Mode](#caching-fallback-and-demo-mode)
15. [Customer Segmentation Rules](#customer-segmentation-rules)
16. [CSV Upload and Data Expectations](#csv-upload-and-data-expectations)
17. [SMTP Email Sending](#smtp-email-sending)
18. [API Endpoints](#api-endpoints)
19. [Testing the App Quickly](#testing-the-app-quickly)
20. [Troubleshooting](#troubleshooting)
21. [FAQ](#faq)

---

## Project Overview

SalesMail AI is a web app where you can:

1. load and browse a customer dataset
2. search/filter customers
3. select one customer (or many)
4. generate AI sales emails with chosen type + tone
5. optionally send emails through SMTP
6. keep working even when AI APIs fail (fallback system)

The app is designed for reliability:

- it caches repeated requests
- it supports offline demo mode
- it has rule-based fallback when LLM calls fail

---

## Who This Project Is For

This project is useful for:

- students building a GenAI full-stack project
- developers learning FastAPI + React integration
- teams prototyping personalized outreach workflows
- anyone wanting to understand practical LLM integration patterns

---

## How the App Works (Simple Flow)

1. Frontend (React) calls backend API (FastAPI).
2. Backend reads customer data from CSV via Pandas.
3. Backend sends a minimal customer payload to LLM service.
4. LLM service generates:
   - email body, or
   - customer intelligence summary.
5. Backend returns result to frontend.
6. Frontend renders output in list/card/composer UI.
7. Optional: generated drafts are sent via SMTP.

---

## Detailed Tech Stack (Beginner-Friendly)

### 1) Frontend: React 19 + Vite + Tailwind CSS v4

- **React** builds interactive UI components (`CustomerList`, `EmailComposer`, etc.).
- **Vite** is the development/build tool. It gives fast startup and hot reload.
- **Tailwind CSS** handles styling through utility classes (no heavy custom CSS files needed).

Why this combination:

- fast local development
- clean component-based architecture
- modern styling workflow

### 2) Backend API: FastAPI (Python)

- FastAPI exposes REST endpoints like:
  - `/customers/`
  - `/generate-email/`
  - `/customers/{id}/summary`
- It validates request/response data using Pydantic models.
- It provides automatic API docs at `/docs`.

Why FastAPI:

- easy to write APIs
- strong typing and validation
- excellent for Python + AI services

### 3) Data Layer: Pandas + CSV

- Customer records are loaded from CSV files in `data/`.
- Filtering/searching/segmentation are done in Pandas.
- Uploading a new CSV switches the active dataset without replacing the default file.

Why Pandas:

- efficient tabular operations
- simple implementation for prototype and academic projects

### 4) LLM Layer: Google Gemini and OpenAI (dual support)

- LLM client is implemented in `services/llm_service.py`.
- Provider can be:
  - `google`
  - `openai`
  - `auto`
- Current setup can run with only `GOOGLE_API_KEY`.

Important:

- Keys are read from `.env`, never hardcoded in source code.
- Only selected customer fields are sent to the LLM (not full CSV row).

### 5) Caching: Python In-Memory Dictionaries

- `_email_cache`: keyed by `(customer_id, email_type, tone)`
- `_summary_cache`: keyed by `customer_id`

Why:

- repeated prompts return instantly
- lower API cost and latency

### 6) Email Delivery: SMTP (`smtplib`)

- Backend endpoint accepts generated drafts and sends via SMTP with TLS.
- Works with Gmail/Outlook/any SMTP-compatible provider.

### 7) MCP Layer (FastMCP + FastAPI)

- `mcp_server.py` runs a proper FastMCP server and mounts MCP HTTP transport at `/mcp`.
- Main API routes use MCP-first customer fetch for generation and summary flows.
- If MCP server is unavailable, backend falls back to direct Pandas fetch for reliability.

---

## Architecture and Data Flow

```text
[React Frontend]
      |
      v
[FastAPI Backend]
   |           \
   |            \--> [LLM Service]
   |                  (Gemini/OpenAI)
   v
[Customer Service]
(Pandas + CSV)
   |
   v
[Customers Data]

Generated output -> Frontend
Optional send -> SMTP -> Real inbox
```

Key design decisions:

- frontend never calls LLM directly
- backend centralizes validation, logic, and secrets
- LLM receives only the minimum fields needed

---

## Folder and File Guide

```text
salesmail-app-enhanced/
├── main.py                     # FastAPI app and endpoints
├── requirements.txt            # Python dependencies
├── .env.example                # Environment template
├── .env                        # Local secrets/config (not committed)
├── email_logs.json             # Email generation logs
│
├── services/
│   ├── customer_service.py     # Read/search/filter/segment customers
│   ├── llm_service.py          # LLM calls, prompting, caching, fallback
│   ├── logger.py               # Logging generated emails
│   └── mcp_client.py           # MCP client used by main API
│
├── data/
│   ├── customers.csv           # Default dataset
│   └── customers_uploaded.csv  # Active override when CSV upload is used
│
├── scripts/
│   └── merge_data.py           # Utility to rebuild merged CSV
│
└── web/
    ├── package.json
    ├── src/
    │   ├── App.jsx
    │   ├── api/client.js
    │   └── components/
    │       ├── CustomerList.jsx
    │       ├── CustomerSummary.jsx
    │       ├── EmailComposer.jsx
    │       └── OpenAIKeySetup.jsx
    └── dist/
```

--- erf

## Setup Requirements

Install these first:

- Python 3.11+
- Node.js 18+ (or 20+ recommended)
- npm

Optional but useful:

- a virtual environment tool (`venv`)
- Postman or curl for API testing

---

## Step-by-Step Local Setup

### 1) Clone and enter project

```bash
git clone <your-repo-url>
cd salesmail-app-enhanced
```

### 2) Create Python virtual environment (recommended)

```bash
python -m venv .venv
source .venv/bin/activate
```

### 3) Install backend dependencies

```bash
pip install -r requirements.txt
```

If `requirements.txt` is missing packages in your copy, install manually:

```bash
pip install fastapi uvicorn pandas openai python-dotenv requests python-multipart
```

### 4) Install frontend dependencies

```bash
cd web
npm install
cd ..
```

### 5) Create environment file

```bash
cp .env.example .env
```

Then edit `.env` and add at least one key (Google or OpenAI).

---

## Environment Variables Explained

| Variable | Example | Required | What it does |
|---|---|---|---|
| `LLM_PROVIDER` | `google` / `openai` / `auto` | No | Chooses which provider to use |
| `GOOGLE_API_KEY` | `AIza...` | If using Google | Auth key for Gemini |
| `GOOGLE_MODEL` | `gemini-2.5-flash-lite` | No | Google model name |
| `OPENAI_API_KEY` | `sk-...` | If using OpenAI | Auth key for OpenAI |
| `OPENAI_MODEL` | `gpt-4.1` | No | OpenAI model name |
| `DEMO_MODE` | `true` / `false` | No | If true, no LLM calls are made |
| `SMTP_HOST` | `smtp.gmail.com` | For sending emails | SMTP server host |
| `SMTP_PORT` | `587` | For sending emails | SMTP port |
| `SMTP_USER` | `you@example.com` | For sending emails | SMTP username |
| `SMTP_PASS` | `app-password` | For sending emails | SMTP password/app password |
| `SMTP_FROM` | `you@example.com` | No | From address (defaults to SMTP_USER) |
| `MCP_BASE_URL` | `http://127.0.0.1:9000` | No | Base URL for MCP server |

Notes:

- `.env` is read at runtime.
- You should never commit real keys to git.
- It is fine to configure only `GOOGLE_API_KEY` if you are using Gemini only.

---

## Run the App

Use three terminals.

### Terminal A: Start MCP server (FastMCP host)

```bash
cd salesmail-app-enhanced
uvicorn mcp_server:app --reload --port 9000
```

### Terminal B: Start backend

```bash
cd salesmail-app-enhanced
uvicorn main:app --reload --port 8000
```

Check health:

- [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### Terminal C: Start frontend

```bash
cd salesmail-app-enhanced/web
npm run dev
```

Open:

- [http://localhost:5173](http://localhost:5173)

---

## Frontend Features Explained

### Customer List

- Paginated table (50 per page)
- Search by ID, name, email
- Filters for category, segment, min/max amount
- Segment badges use distinct colors

### Customer Intelligence Card

- Appears when a customer is selected
- Displays:
  - value tier
  - customer summary
  - sales opportunity
  - recommended email type
  - suggested tone
- Includes "Apply AI Suggestions" button

### Email Composer

- 6 email types: upsell, follow-up, cold outreach, promotion, re-engagement, thank-you
- 3 tones: professional, friendly, persuasive
- Single mode for one customer
- Bulk mode for multi-selected customers
- Bulk draft export as JSON
- Optional live send via backend SMTP endpoint

---

## Backend Features Explained

### Customer endpoints

- list all customers
- search/filter customers
- fetch one customer
- fetch categories
- segment counts and segment-specific lists

### LLM endpoints

- generate single email
- generate bulk emails
- generate customer summary/strategy

### MCP integration in runtime

For `/generate-email/`, `/generate-email/bulk/`, and `/customers/{id}/summary`:

1. backend requests customer data through MCP tool `fetch_customer_data`
2. MCP response is used for generation/summary
3. if MCP fails, backend falls back to direct Pandas `get_customer(...)`

### Utility endpoints

- clear in-memory cache
- save API key to `.env`
- analytics endpoint for generated email logs

---

## AI Generation Logic

AI behavior is handled in `services/llm_service.py`.

### What is sent to LLM

Only these fields are included:

- name
- category
- amount
- last_purchase
- last_interaction
- total_orders
- avg_order_value
- gender
- age

### Why this matters

- keeps prompt focused
- avoids sending unnecessary fields
- improves consistency and cost control

### Provider selection

The service checks `LLM_PROVIDER` and available keys:

1. if OpenAI is allowed and key exists -> use OpenAI
2. else if Google is allowed and key exists -> use Google
3. else -> error, then fallback path may apply depending on flow

---

## Caching, Fallback, and Demo Mode

### Caching

Email cache key:

```text
(customer_id, email_type, tone)
```

Summary cache key:

```text
customer_id
```

Effect:

- repeated request returns instantly
- no repeated LLM call for same key

### Fallback

If LLM call fails (quota, network, key issue, parse issue):

- service logs warning
- rule-based template/summary is generated
- app still returns usable output

### Demo mode

Set:

```env
DEMO_MODE=true
```

Result:

- all LLM calls are bypassed
- app runs fully offline with rule-based logic

---

## Customer Segmentation Rules

Configured in `services/customer_service.py`.

Threshold constants:

```python
HIGH_VALUE_THRESHOLD = 10000
RECENT_BUYER_DAYS_THRESHOLD = 14
ACTIVE_DAYS_THRESHOLD = 30
INACTIVE_DAYS_THRESHOLD = 60
```

Classification order:

1. `high-value` if amount >= 10000
2. `recent-buyer` if days since interaction <= 14
3. `active` if days <= 30
4. `inactive` if days >= 60

---

## CSV Upload and Data Expectations

Required CSV columns:

- `customer_id`
- `name`
- `email`
- `last_purchase`
- `amount`
- `category`
- `last_interaction`

Behavior:

- default file: `data/customers.csv`
- uploaded file: `data/customers_uploaded.csv`
- uploaded file becomes active dataset
- default file is not overwritten

---

## SMTP Email Sending

SMTP is optional and only used when you click send in UI.

Required `.env` fields:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@example.com
SMTP_PASS=your-app-password
SMTP_FROM=you@example.com
```

Backend flow:

1. establish SMTP connection
2. start TLS (`starttls()`)
3. login
4. send each draft
5. return sent/failed counts + per-address errors

---

## API Endpoints

### Health

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Health check |

### Customers

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/customers/` | List all customers |
| GET | `/customers/search/` | Search and filter |
| GET | `/customers/categories/` | List categories |
| GET | `/customers/{id}` | Fetch one customer |
| POST | `/customers/upload-csv/` | Upload custom CSV |

### Intelligence and Email

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/customers/{id}/summary` | Customer intelligence card |
| POST | `/generate-email/` | Generate one email |
| POST | `/generate-email/bulk/` | Generate bulk drafts |

### Segments

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/segments/` | Segment counts |
| GET | `/segments/{segment}/customers/` | Customers in a segment |

### Admin/Utility

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/settings/openai-key/` | Save provider key to `.env` |
| POST | `/cache/clear/` | Clear in-memory caches |
| GET | `/analytics/` | Basic generation analytics |

### Send Email aliases

All these are supported:

- `/send-email/`
- `/send-email`
- `/send-emails/`
- `/send-emails`

---

## Testing the App Quickly

Quick manual test checklist:

1. start backend and frontend
2. open app and select a customer
3. generate single email
4. select 2-3 customers and generate bulk drafts
5. open customer summary card
6. click apply AI suggestions
7. clear cache via endpoint and retry
8. set `DEMO_MODE=true`, restart backend, verify offline behavior

---

## Troubleshooting

### Backend fails to start

- ensure virtual environment is active
- ensure dependencies are installed
- run: `python --version` and check 3.11+

### Frontend fails with package errors

Run inside `web/`:

```bash
npm install
npm run dev
```

### "No valid API key" error

- check `.env` exists in project root
- verify key has no quotes/spaces
- ensure at least one of `GOOGLE_API_KEY` or `OPENAI_API_KEY` is valid

### LLM works once then fails

- possible rate limit/quota issue
- app should fallback to rule-based output
- for stable demo, set `DEMO_MODE=true`

### CSV upload fails

- confirm `.csv` extension
- confirm required columns exist

### Send email fails

- verify SMTP config
- verify credentials (for Gmail use App Password)
- verify network allows SMTP provider access

---

## FAQ

### Is OpenAI required?

No. If you provide only `GOOGLE_API_KEY`, the project still works.

### Is Google required?

No. You can also run with OpenAI only (if configured).

### Why are keys not in source code?

For security. Secrets should always come from environment variables.

### Does this app work without internet?

Yes, in `DEMO_MODE=true` for generation/summary logic.

### Are we using MCP in actual runtime?

Yes. Core AI routes use MCP-first customer fetch, with direct Pandas fallback for resilience.

---

## License / Usage

This repository is intended for learning, demos, and project work.  
Before production use, add proper authentication, database storage, monitoring, and security hardening.
