"""
customer_service.py — Pandas-based customer data access, search, segmentation.
Reads data/customers.csv (pre-merged dataset). No runtime merging.
"""
from pathlib import Path
from typing import Any, Dict, List, Optional
import datetime

import pandas as pd

DATA_DIR        = Path(__file__).resolve().parent.parent / "data"
CUSTOMERS_FILE  = DATA_DIR / "customers.csv"      # DEFAULT — never overwritten
UPLOADED_FILE   = DATA_DIR / "customers_uploaded.csv"  # temp override, session-only

# Segmentation thresholds
HIGH_VALUE_THRESHOLD        = 10000   # updated for new dataset scale
ACTIVE_DAYS_THRESHOLD       = 30
INACTIVE_DAYS_THRESHOLD     = 60
RECENT_BUYER_DAYS_THRESHOLD = 14

# Columns the rest of the app depends on
REQUIRED_COLUMNS = ["customer_id", "name", "email", "last_purchase", "amount", "category", "last_interaction"]


# ── Internal helpers ─────────────────────────────────────────────────────────

def _ensure_data_file() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not CUSTOMERS_FILE.exists():
        pd.DataFrame(columns=REQUIRED_COLUMNS).to_csv(CUSTOMERS_FILE, index=False)


def _active_file() -> Path:
    """Return uploaded CSV if present, otherwise the immutable default."""
    return UPLOADED_FILE if UPLOADED_FILE.exists() else CUSTOMERS_FILE


def _read_dataframe() -> pd.DataFrame:
    _ensure_data_file()
    df = pd.read_csv(_active_file(), dtype={"customer_id": str})
    return df if not df.empty else pd.DataFrame(columns=REQUIRED_COLUMNS)


def _today() -> pd.Timestamp:
    return pd.Timestamp(datetime.date.today())


def _get_segments_df(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["_amount"] = pd.to_numeric(df.get("amount", 0), errors="coerce").fillna(0)

    if "last_interaction" in df.columns:
        df["_interaction_date"] = pd.to_datetime(df["last_interaction"], errors="coerce")
        df["_days_since"] = (_today() - df["_interaction_date"]).dt.days.fillna(999)
    else:
        df["_days_since"] = 999

    def classify(row) -> str:
        if row["_amount"] >= HIGH_VALUE_THRESHOLD:
            return "high-value"
        if row["_days_since"] <= RECENT_BUYER_DAYS_THRESHOLD:
            return "recent-buyer"
        if row["_days_since"] <= ACTIVE_DAYS_THRESHOLD:
            return "active"
        if row["_days_since"] >= INACTIVE_DAYS_THRESHOLD:
            return "inactive"
        return "active"

    df["segment"] = df.apply(classify, axis=1)
    return df


def _drop_internal(df: pd.DataFrame) -> pd.DataFrame:
    return df.drop(columns=[c for c in ["_amount", "_interaction_date", "_days_since"] if c in df.columns], errors="ignore")


# ── Public read API ──────────────────────────────────────────────────────────

def list_customers() -> List[Dict[str, Any]]:
    df = _get_segments_df(_read_dataframe())
    if df.empty:
        return []
    df = _drop_internal(df)
    return df.sort_values(by="customer_id").to_dict(orient="records")


def get_customer(customer_id: Any) -> Optional[Dict[str, Any]]:
    """Accept both string (C241288) and integer IDs."""
    df = _drop_internal(_get_segments_df(_read_dataframe()))
    if "customer_id" not in df.columns:
        return None
    cid = str(customer_id)
    row = df[df["customer_id"] == cid]
    if row.empty:
        return None
    return row.to_dict(orient="records")[0]


def get_categories() -> List[str]:
    df = _read_dataframe()
    return sorted(df["category"].dropna().unique().tolist()) if "category" in df.columns else []


# ── Search & Filter ──────────────────────────────────────────────────────────

def search_customers(
    query: Optional[str] = None,
    category: Optional[str] = None,
    segment: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    last_interaction_after: Optional[str] = None,
    last_interaction_before: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """All active filters applied simultaneously with AND logic."""
    df = _get_segments_df(_read_dataframe())
    if df.empty:
        return []

    if query:
        q = str(query).strip().lower()
        mask = (
            df["name"].astype(str).str.lower().str.contains(q, na=False)
            | df["email"].astype(str).str.lower().str.contains(q, na=False)
            | df["customer_id"].astype(str).str.lower().str.contains(q, na=False)
        )
        df = df[mask]

    if category and "category" in df.columns:
        df = df[df["category"].astype(str).str.lower() == category.lower()]

    if segment:
        df = df[df["segment"] == segment]

    if "amount" in df.columns:
        nums = pd.to_numeric(df["amount"], errors="coerce").fillna(0)
        if min_amount is not None:
            df = df[nums >= min_amount]
        if max_amount is not None:
            df = df[nums <= max_amount]

    if "last_interaction" in df.columns:
        dates = pd.to_datetime(df["last_interaction"], errors="coerce")
        if last_interaction_after:
            df = df[dates >= pd.to_datetime(last_interaction_after)]
        if last_interaction_before:
            df = df[dates <= pd.to_datetime(last_interaction_before)]

    df = _drop_internal(df)
    return df.sort_values(by="customer_id").to_dict(orient="records") if not df.empty else []


# ── Segmentation ─────────────────────────────────────────────────────────────

def list_segments() -> Dict[str, int]:
    df = _read_dataframe()
    if df.empty:
        return {}
    return _get_segments_df(df)["segment"].value_counts().to_dict()


def get_customers_by_segment(segment: str) -> List[Dict[str, Any]]:
    df = _read_dataframe()
    if df.empty:
        return []
    segmented = _get_segments_df(df)
    filtered  = _drop_internal(segmented[segmented["segment"] == segment])
    return filtered.sort_values(by="customer_id").to_dict(orient="records")


# ── CSV upload ────────────────────────────────────────────────────────────────
# Writes to UPLOADED_FILE only — the default customers.csv is NEVER modified.
# Delete UPLOADED_FILE (or restart) to revert to the default 90k dataset.

def save_uploaded_csv(raw_bytes: bytes) -> int:
    from io import StringIO
    content = raw_bytes.decode("utf-8")
    df = pd.read_csv(StringIO(content))
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns: {', '.join(missing)}")
    _ensure_data_file()
    df.to_csv(UPLOADED_FILE, index=False)   # ← writes to temp file only
    return len(df)
