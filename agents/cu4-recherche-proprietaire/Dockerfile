# CU4 — Recherche Proprietaire (standalone FastAPI + Playwright Firefox)
# Build from repo root: docker compose build cu4-agent
FROM --platform=linux/amd64 python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget curl \
    libgtk-3-0 libdbus-glib-1-2 libxt6 libx11-xcb1 \
    libasound2 libgbm1 libnspr4 libnss3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY libs/python/ /tmp/newmark-common/
RUN pip install --no-cache-dir /tmp/newmark-common/ && rm -rf /tmp/newmark-common/

COPY agents/cu4-recherche-proprietaire/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN python -m playwright install firefox && python -m playwright install-deps firefox

COPY agents/cu4-recherche-proprietaire/ .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
