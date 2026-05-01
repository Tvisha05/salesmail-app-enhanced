from fastapi import FastAPI
from fastmcp import FastMCP
from services.customer_service import get_customer

fastapi_app = FastAPI(title="SalesMail MCP Data API")

@fastapi_app.get("/tools")
def list_tools():
    return {
        "tools": [
            {
                "name": "fetch_customer_data",
                "description": "Get customer data using customer_id",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "customer_id": {"type": ["string", "integer"]}
                    },
                    "required": ["customer_id"]
                }
            }
        ]
    }

@fastapi_app.post("/tools/fetch_customer_data")
def fetch_customer_data(payload: dict):
    customer_id = payload.get("customer_id")

    if customer_id is None:
        return {"error": "customer_id is required"}

    customer = get_customer(str(customer_id))
    if not customer:
        return {"error": "Customer not found"}

    return customer


# Expose the same API as a proper FastMCP server.
mcp = FastMCP.from_fastapi(app=fastapi_app, name="SalesMail MCP Server")
mcp_app = mcp.http_app(path="/")

# Keep `app` as the uvicorn entrypoint (`uvicorn mcp_server:app --port 9000`)
app = FastAPI(title="SalesMail MCP Host", lifespan=mcp_app.lifespan)
app.mount("/mcp", mcp_app)
app.mount("/", fastapi_app)