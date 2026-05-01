"""
llm_service.py — Email generation + Customer summary/strategy.

Key behaviours:
  - Works with customer data provided by API layer (MCP-first fetch in main flow)
  - In-memory cache keyed by (customer_id, email_type, tone)
  - DEMO_MODE=true  → pure rule-based, zero LLM calls
  - LLM failure     → rule-based fallback, app never crashes
  - Default model   → gemini-2.5-flash-lite
"""

import logging
import os
from datetime import date, datetime
from typing import Any, Dict, Optional, Tuple

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
logger = logging.getLogger(__name__)

# ── In-memory cache ──────────────────────────────────────────────────────────
_email_cache: Dict[Tuple, str] = {}
_summary_cache: Dict[str, dict] = {}


# ── LLM client ───────────────────────────────────────────────────────────────

def _get_client_and_model() -> Tuple[OpenAI, str]:
    load_dotenv(override=True)
    provider       = os.getenv("LLM_PROVIDER", "auto").strip().lower()
    google_api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()

    if provider in ("openai", "auto") and openai_api_key and openai_api_key not in ("your_openai_api_key_here",):
        model = os.getenv("OPENAI_MODEL", "gpt-4.1")
        return OpenAI(api_key=openai_api_key), model

    if provider in ("google", "auto") and google_api_key and google_api_key not in ("your_google_api_key_here",):
        model = os.getenv("GOOGLE_MODEL", "gemini-2.5-flash-lite")
        return OpenAI(
            api_key=google_api_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        ), model

    raise ValueError("No valid API key. Set GOOGLE_API_KEY or OPENAI_API_KEY in .env")


def _is_demo_mode() -> bool:
    return os.getenv("DEMO_MODE", "false").strip().lower() == "true"


# ── Minimal customer payload (only what LLM needs) ───────────────────────────

def _slim(customer: dict) -> dict:
    """Return only the fields sent to the LLM — never the full row."""
    return {
        "name":             customer.get("name", "Customer"),
        "category":         customer.get("category", "General"),
        "amount":           customer.get("amount", 0),
        "last_purchase":    customer.get("last_purchase", "N/A"),
        "last_interaction": customer.get("last_interaction", "N/A"),
        "total_orders":     customer.get("total_orders", 1),
        "avg_order_value":  customer.get("avg_order_value", 0),
        "gender":           customer.get("gender", ""),
        "age":              customer.get("age", ""),
    }


# ── Rule-based helpers ────────────────────────────────────────────────────────

def _days_since(date_str: Optional[str]) -> int:
    if not date_str:
        return 999
    try:
        return (date.today() - datetime.strptime(str(date_str), "%Y-%m-%d").date()).days
    except Exception:
        return 999


def _rule_email_type(customer: dict) -> str:
    days  = _days_since(customer.get("last_interaction"))
    amt   = float(customer.get("amount", 0))
    orders = int(customer.get("total_orders", 1))
    if days > 180:
        return "re-engagement"
    if amt > 10000 or orders > 3:
        return "upsell"
    if days < 30:
        return "thank-you"
    return "follow-up"


def _rule_tone(customer: dict) -> str:
    amt = float(customer.get("amount", 0))
    if amt > 15000:
        return "professional"
    if float(customer.get("age", 30)) < 30:
        return "friendly"
    return "persuasive"


def _rule_summary(customer: dict) -> dict:
    slim   = _slim(customer)
    days   = _days_since(customer.get("last_interaction"))
    amt    = float(slim["amount"])
    orders = int(slim["total_orders"])

    if days > 180:
        activity = "inactive — last seen over 6 months ago"
        opportunity = "Re-engagement campaign with an incentive could recover this customer."
    elif days < 14:
        activity = "recently active"
        opportunity = "Fresh engagement — ideal timing for an upsell or cross-sell offer."
    else:
        activity = "moderately active"
        opportunity = "Consistent buyer. Nurturing with a follow-up or promotion will strengthen loyalty."

    value = "high-value" if amt > 10000 else ("mid-value" if amt > 3000 else "entry-level")

    return {
        "summary": (
            f"{slim['name']} is a {slim.get('age','')} year-old {slim.get('gender','').lower()} customer "
            f"in the {slim['category']} category. Total spend: ${amt:,.2f} across {orders} order(s). "
            f"Currently {activity}."
        ),
        "sales_opportunity": opportunity,
        "recommended_email_type": _rule_email_type(customer),
        "suggested_tone": _rule_tone(customer),
        "value_tier": value,
        "source": "rule-based",
    }


def _rule_based_email(customer: dict, email_type: str, tone: str) -> str:
    slim  = _slim(customer)
    name  = slim["name"]
    cat   = slim["category"]
    prod  = slim["last_purchase"]
    amt   = slim["amount"]

    openers = {
        "upsell":         f"Given your investment of ${amt:,.2f} in {cat}, you're perfectly positioned for our premium tier.",
        "follow-up":      f"I hope you're enjoying your recent {prod} purchase. I wanted to check in.",
        "cold outreach":  f"We help {cat} customers like you get more value from every purchase.",
        "promotion":      f"We have an exclusive offer tailored to your history in {cat}.",
        "re-engagement":  f"We miss you! It's been a while since your last {prod} purchase.",
        "thank-you":      f"Thank you for being a loyal customer in the {cat} space.",
    }
    tone_closers = {
        "professional": "Please let me know if you'd like to schedule a brief call.",
        "friendly":     "Would love to hear from you — reply anytime!",
        "persuasive":   "Act now — this offer is available for a limited time only.",
    }

    opener = openers.get(email_type, f"We have something special for you in {cat}.")
    closer = tone_closers.get(tone, "Looking forward to connecting.")

    return (
        f"Hi {name},\n\n"
        f"{opener}\n\n"
        f"As one of our valued {cat} customers, we want to make sure you're getting the most "
        f"out of every purchase. Your loyalty means a great deal to us.\n\n"
        f"{closer}\n\n"
        f"Best regards,\nSalesMail AI Team"
    )


# ── LLM calls ────────────────────────────────────────────────────────────────

def _llm_email(customer: dict, email_type: str, tone: str) -> str:
    slim = _slim(customer)
    client, model = _get_client_and_model()

    type_hints = {
        "upsell":        "highlight a premium upgrade relevant to their category and spend",
        "follow-up":     "check in after their last purchase and offer next steps",
        "cold outreach": "introduce services relevant to their shopping category",
        "promotion":     "present a limited-time offer tied to their purchase history",
        "re-engagement": "win back an inactive customer with value + incentive",
        "thank-you":     "express genuine gratitude for their loyalty and purchases",
    }
    tone_hints = {
        "professional": "formal, concise business language",
        "friendly":     "warm, conversational, personal",
        "persuasive":   "compelling with a clear call-to-action",
    }

    prompt = (
        f"Write a {email_type} sales email. Tone: {tone_hints.get(tone, tone)}.\n"
        f"Customer: {slim['name']}, age {slim['age']}, {slim['gender']}.\n"
        f"Category: {slim['category']}. Last purchase: {slim['last_purchase']}.\n"
        f"Total spend: ${slim['amount']:,}. Orders: {slim['total_orders']}. "
        f"Last active: {slim['last_interaction']}.\n"
        f"Goal: {type_hints.get(email_type, email_type)}.\n"
        f"Output ONLY the email body (3-4 short paragraphs). No subject line."
    )

    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=350,
        temperature=0.7,
    )
    return resp.choices[0].message.content.strip()


def _llm_summary(customer: dict) -> dict:
    slim = _slim(customer)
    client, model = _get_client_and_model()

    prompt = (
        f"Analyze this retail customer and return ONLY valid JSON with these exact keys:\n"
        f"summary, sales_opportunity, recommended_email_type, suggested_tone, value_tier.\n\n"
        f"Customer: {slim['name']}, age {slim['age']}, {slim['gender']}.\n"
        f"Category: {slim['category']}. Total spend: ${slim['amount']:,}.\n"
        f"Orders: {slim['total_orders']}. Avg order: ${slim['avg_order_value']:,}.\n"
        f"Last active: {slim['last_interaction']}.\n\n"
        f"Rules:\n"
        f"- summary: 1-2 sentences about the customer\n"
        f"- sales_opportunity: why this customer is valuable (1 sentence)\n"
        f"- recommended_email_type: one of upsell/follow-up/promotion/re-engagement/thank-you\n"
        f"- suggested_tone: one of professional/friendly/persuasive\n"
        f"- value_tier: one of high-value/mid-value/entry-level\n"
        f"Return ONLY the JSON object, no markdown."
    )

    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=250,
        temperature=0.3,
    )
    raw = resp.choices[0].message.content.strip()
    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    import json
    result = json.loads(raw)
    result["source"] = "llm"
    return result


# ── Public API ────────────────────────────────────────────────────────────────

def generate_email(customer_id: Any, email_type: str, tone: str, customer: Optional[dict] = None) -> str:
    """
    Generate a sales email. customer dict is passed directly — no MCP call needed.
    Cache key: (customer_id, email_type, tone).
    """
    cache_key = (str(customer_id), email_type, tone)

    # 1. Cache check
    if cache_key in _email_cache:
        logger.info(f"CACHE HIT — email for customer {customer_id} / {email_type} / {tone}")
        return _email_cache[cache_key]

    # 2. Demo mode — rule-based only
    if _is_demo_mode():
        logger.info(f"DEMO MODE — rule-based email for customer {customer_id}")
        result = _rule_based_email(customer or {}, email_type, tone)
        _email_cache[cache_key] = result
        return result

    # 3. LLM call with strong fallback
    if customer is None:
        from services.customer_service import get_customer
        customer = get_customer(int(customer_id)) or {}

    if not customer:
        raise ValueError(f"Customer {customer_id} not found")

    try:
        result = _llm_email(customer, email_type, tone)
        logger.info(f"LLM email generated for customer {customer_id}")
    except Exception as exc:
        err = str(exc).lower()
        logger.warning(f"LLM failed ({exc}) — using rule-based fallback")
        result = _rule_based_email(customer, email_type, tone)

    _email_cache[cache_key] = result
    return result


def generate_customer_summary(customer_id: Any, customer: Optional[dict] = None) -> dict:
    """
    Generate customer summary + sales strategy.
    Cache key: customer_id (summary doesn't vary by email type).
    """
    cache_key = str(customer_id)

    if cache_key in _summary_cache:
        logger.info(f"CACHE HIT — summary for customer {customer_id}")
        return _summary_cache[cache_key]

    if customer is None:
        from services.customer_service import get_customer
        customer = get_customer(int(customer_id) if str(customer_id).isdigit() else customer_id) or {}

    if not customer:
        return {"summary": "Customer not found.", "sales_opportunity": "", "recommended_email_type": "follow-up", "suggested_tone": "professional", "value_tier": "unknown", "source": "error"}

    if _is_demo_mode():
        result = _rule_summary(customer)
        _summary_cache[cache_key] = result
        return result

    try:
        result = _llm_summary(customer)
    except Exception as exc:
        logger.warning(f"LLM summary failed ({exc}) — rule-based fallback")
        result = _rule_summary(customer)

    _summary_cache[cache_key] = result
    return result


def clear_cache() -> dict:
    """Clear both caches. Called via API for testing."""
    email_count   = len(_email_cache)
    summary_count = len(_summary_cache)
    _email_cache.clear()
    _summary_cache.clear()
    return {"cleared_emails": email_count, "cleared_summaries": summary_count}
