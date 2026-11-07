"""Entry point uses the managed artifact's injected PORT."""
import logging
import os
import uvicorn
logging.basicConfig(level=logging.INFO)
uvicorn.run("api.main:app", host="0.0.0.0", port=int(os.environ.get("PORT", "8080")), proxy_headers=True)
