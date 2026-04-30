"""
Dataset merge script — run once to rebuild data/customers.csv.
Usage: python scripts/merge_data.py --customer customer_data.csv --sales sales_data.csv
"""
import argparse
import pandas as pd
from pathlib import Path

OUTPUT = Path("data/customers.csv")

def merge(customer_path: str, sales_path: str) -> pd.DataFrame:
    cust  = pd.read_csv(customer_path, encoding="utf-8-sig")
    sales = pd.read_csv(sales_path)
    sales["invoice_date"] = pd.to_datetime(sales["invoice_date"], dayfirst=True, errors="coerce")
    sales["line_total"] = sales["quantity"] * sales["price"]
    agg = sales.groupby("customer_id").agg(
        total_spent         = ("line_total",    "sum"),
        total_orders        = ("invoice_no",    "nunique"),
        last_purchase_date  = ("invoice_date",  "max"),
        first_purchase_date = ("invoice_date",  "min"),
        avg_order_value     = ("line_total",    "mean"),
        favorite_category   = ("category",      lambda x: x.value_counts().index[0]),
        favorite_mall       = ("shopping_mall", lambda x: x.value_counts().index[0]),
        categories_bought   = ("category",      lambda x: ", ".join(sorted(x.unique()))),
    ).reset_index()
    agg["total_spent"] = agg["total_spent"].round(2)
    agg["avg_order_value"] = agg["avg_order_value"].round(2)
    agg["last_purchase_date"]  = agg["last_purchase_date"].dt.strftime("%Y-%m-%d")
    agg["first_purchase_date"] = agg["first_purchase_date"].dt.strftime("%Y-%m-%d")
    df = cust.merge(agg, on="customer_id", how="left")
    df["age"] = df["age"].fillna(df["age"].median()).astype(int)
    df = df.rename(columns={"favorite_category": "category", "total_spent": "amount", "last_purchase_date": "last_interaction"})
    df["name"]          = df["customer_id"].apply(lambda x: f"Customer {x}")
    df["email"]         = df["customer_id"].str.lower() + "@example.com"
    df["last_purchase"] = df["category"]
    return df

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--customer", default="customer_data.csv")
    parser.add_argument("--sales",    default="sales_data.csv")
    args = parser.parse_args()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    df = merge(args.customer, args.sales)
    df.to_csv(OUTPUT, index=False)
    print(f"Saved {len(df):,} rows -> {OUTPUT}")
