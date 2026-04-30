import requests

MCP_BASE_URL = "http://127.0.0.1:9000"

def call_mcp_tool(tool_name, payload):
    url = f"{MCP_BASE_URL}/tools/{tool_name}"
    try:
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        return {"error": f"MCP request failed: {str(exc)}"}