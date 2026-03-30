# CU5 — Veille Presse (standalone FastAPI + Playwright Firefox)
# Build from repo root: docker compose build cu5-agent
FROM --platform=linux/amd64 python:3.12-slim

# System deps for Firefox
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget curl \
    libgtk-3-0 libdbus-glib-1-2 libxt6 libx11-xcb1 \
    libasound2 libgbm1 libnspr4 libnss3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install shared library
COPY libs/python/ /tmp/newmark-common/
RUN pip install --no-cache-dir /tmp/newmark-common/ && rm -rf /tmp/newmark-common/

# Install agent deps
COPY agents/cu5-veille-presse/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Install Playwright Firefox
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN python -m playwright install firefox && python -m playwright install-deps firefox

# Copy agent code
COPY agents/cu5-veille-presse/main.py .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
