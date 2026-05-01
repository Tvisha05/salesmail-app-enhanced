from fastapi import FastAPI, File, HTTPException, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, List, Literal, Optional
from services.llm_service import generate_email, generate_customer_summary, clear_cache
from services.logger import log_email
from services.customer_service import (
    get_customer, list_customers, save_uploaded_csv,
    search_customers, get_categories,
    list_segments, get_customers_by_segment,
)
from services.mcp_client import fetch_customer_via_mcp
from dotenv import load_dotenv
from pathlib import Path
import json, os

load_dotenv()

app = FastAPI(title="SalesMail AI Pro")
ENV_FILE = Path(".env")

EMAIL_TYPES = Literal["upsell", "follow-up", "cold outreach", "promotion", "re-engagement", "thank-you"]
TONES       = Literal["professional", "friendly", "persuasive"]


class EmailRequest(BaseModel):
    customer_id: Any
    email_type:  EMAIL_TYPES
    tone:        TONES


class BulkEmailRequest(BaseModel):
    customer_ids: List[Any]
    email_type:   EMAIL_TYPES
    tone:         TONES


class OpenAIKeyRequest(BaseModel):
    api_key: str


class EmailDraftItem(BaseModel):
    customer_email: str
    customer_name:  Optional[str] = ""
    email:          str


class SendEmailRequest(BaseModel):
    drafts: List[EmailDraftItem]


def _get_customer_runtime(customer_id: Any) -> Optional[dict]:
    """
    Runtime customer fetch path: MCP first, direct Pandas fallback.
    This keeps the app stable even if MCP server is temporarily unavailable.
    """
    mcp_result = fetch_customer_via_mcp(customer_id)
    if isinstance(mcp_result, dict) and not mcp_result.get("error"):
        return mcp_result
    return get_customer(customer_id)


# ── Core ──────────────────────────────────────────────────────────────────────

@app.get("/")
def home():
    demo = os.getenv("DEMO_MODE", "false").lower() == "true"
    return {"message": "SalesMail AI Pro Running ✅", "demo_mode": demo}


# ── Email generation ──────────────────────────────────────────────────────────

@app.post("/generate-email/")
def create_email(req: EmailRequest):
    customer = _get_customer_runtime(req.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail=f"Customer {req.customer_id} not found")
    try:
        email = generate_email(req.customer_id, req.email_type, req.tone, customer=customer)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    log_email(req.customer_id, req.email_type, req.tone, email)
    return {"status": "success", "email": email}


@app.post("/generate-email/bulk/")
def create_bulk_emails(req: BulkEmailRequest):
    drafts = []
    for cid in req.customer_ids:
        customer = _get_customer_runtime(cid)
        try:
            email = generate_email(cid, req.email_type, req.tone, customer=customer or {})
            drafts.append({
                "customer_id":    cid,
                "customer_name":  (customer or {}).get("name", ""),
                "customer_email": (customer or {}).get("email", ""),
                "status":         "success",
                "email":          email,
            })
            log_email(cid, req.email_type, req.tone, email)
        except Exception as e:
            drafts.append({"customer_id": cid, "status": "error", "email": str(e)})
    return {"status": "success", "drafts": drafts}


# ── Send Emails ───────────────────────────────────────────────────────────────
# Sends pre-generated email drafts. Requires SMTP configuration via environment
# variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
# If SMTP is not configured, returns a clear error — no credentials stored in frontend.

@app.post("/send-email/")
@app.post("/send-email")
@app.post("/send-emails/")
@app.post("/send-emails")
def send_emails(req: SendEmailRequest):
    import smtplib
    from email.mime.text import MIMEText

    # Reload env values at request time so SMTP edits apply immediately.
    load_dotenv(override=True)

    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    smtp_from = os.getenv("SMTP_FROM", smtp_user)

    if not smtp_host or not smtp_user or not smtp_pass:
        raise HTTPException(
            status_code=503,
            detail="SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in your .env file.",
        )

    sent, failed = 0, 0
    errors = []
    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            for draft in req.drafts:
                try:
                    msg = MIMEText(draft.email, "plain")
                    msg["Subject"] = "A message for you"
                    msg["From"]    = smtp_from
                    msg["To"]      = draft.customer_email
                    server.sendmail(smtp_from, [draft.customer_email], msg.as_string())
                    sent += 1
                except Exception as e:
                    failed += 1
                    errors.append({"to": draft.customer_email, "error": str(e)})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SMTP connection failed: {e}")

    return {
        "status": "success",
        "sent": sent,
        "failed": failed,
        "errors": errors,
        "message": f"✓ Sent {sent} email{'s' if sent != 1 else ''}" + (f", {failed} failed" if failed else ""),
    }


# ── Customer summary + strategy (NEW) ────────────────────────────────────────

@app.get("/customers/{customer_id}/summary")
def customer_summary(customer_id: str):
    customer = _get_customer_runtime(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    summary = generate_customer_summary(customer_id, customer=customer)
    return {"status": "success", "customer_id": customer_id, **summary}


# ── Customer CRUD ─────────────────────────────────────────────────────────────

@app.get("/customers/")
def customers():
    return {"customers": list_customers()}


@app.get("/customers/search/")
def search(
    q:                  Optional[str]   = Query(None),
    category:           Optional[str]   = Query(None),
    segment:            Optional[str]   = Query(None),
    min_amount:         Optional[float] = Query(None),
    max_amount:         Optional[float] = Query(None),
    interaction_after:  Optional[str]   = Query(None),
    interaction_before: Optional[str]   = Query(None),
):
    results = search_customers(
        query=q, category=category, segment=segment,
        min_amount=min_amount, max_amount=max_amount,
        last_interaction_after=interaction_after,
        last_interaction_before=interaction_before,
    )
    return {"customers": results, "count": len(results)}


@app.get("/customers/categories/")
def categories():
    return {"categories": get_categories()}


@app.get("/customers/{customer_id}")
def customer_detail(customer_id: str):
    customer = get_customer(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@app.post("/customers/upload-csv/")
async def upload_customers_csv(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    try:
        content   = await file.read()
        row_count = save_uploaded_csv(content)
        return {"status": "success", "rows_imported": row_count}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to process CSV")


# ── Segments ──────────────────────────────────────────────────────────────────

@app.get("/segments/")
def segments():
    return {"segments": list_segments()}


@app.get("/segments/{segment}/customers/")
def segment_customers(segment: str):
    custs = get_customers_by_segment(segment)
    return {"segment": segment, "customers": custs, "count": len(custs)}


# ── Settings ──────────────────────────────────────────────────────────────────

@app.post("/settings/openai-key/")
def set_api_key(req: OpenAIKeyRequest):
    key = req.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="API key cannot be empty.")
    if key.startswith("AIza"):
        env_var = "GOOGLE_API_KEY"
    elif key.startswith("sk-"):
        env_var = "OPENAI_API_KEY"
    else:
        raise HTTPException(status_code=400, detail="Enter a Google (AIza...) or OpenAI (sk-...) key.")

    existing = ENV_FILE.read_text(encoding="utf-8") if ENV_FILE.exists() else ""
    lines    = existing.splitlines()
    updated  = False
    for i, line in enumerate(lines):
        if line.startswith(f"{env_var}="):
            lines[i] = f"{env_var}={key}"
            updated = True
            break
    if not updated:
        lines.append(f"{env_var}={key}")
    ENV_FILE.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")
    return {"status": "success", "saved_as": env_var}


@app.post("/cache/clear/")
def clear_llm_cache():
    return {"status": "success", **clear_cache()}


# ── Analytics ─────────────────────────────────────────────────────────────────

@app.get("/analytics/")
def analytics():
    try:
        with open("email_logs.json") as f:
            data = json.load(f)
        return {"total_emails": len(data), "last_email": data[-1] if data else None}
    except Exception:
        return {"message": "No data yet"}
