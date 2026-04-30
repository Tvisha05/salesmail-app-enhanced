import json
from datetime import datetime

LOG_FILE = "email_logs.json"

def log_email(customer_id, email_type, tone, output):
    entry = {
        "timestamp": str(datetime.now()),
        "customer_id": customer_id,
        "email_type": email_type,
        "tone": tone,
        "output": output
    }

    try:
        with open(LOG_FILE, "r") as f:
            data = json.load(f)
    except:
        data = []

    data.append(entry)

    with open(LOG_FILE, "w") as f:
        json.dump(data, f, indent=2)