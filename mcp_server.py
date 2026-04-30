from fastapi import FastAPI
from services.customer_service import get_customer

app = FastAPI()

@app.get("/tools")
def list_tools():
    return {
        "tools": [
            {
                "name": "fetch_customer_data",
                "description": "Get customer data using customer_id",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "customer_id": {"type": "integer"}
                    },
                    "required": ["customer_id"]
                }
            }
        ]
    }

@app.post("/tools/fetch_customer_data")
def fetch_customer_data(payload: dict):
    customer_id = payload.get("customer_id")

    if customer_id is None:
        return {"error": "customer_id is required"}

    if not isinstance(customer_id, int):
        try:
            customer_id = int(customer_id)
        except Exception:
            return {"error": "customer_id must be an integer"}

    customer = get_customer(customer_id)
    if not customer:
        return {"error": "Customer not found"}

    return customer