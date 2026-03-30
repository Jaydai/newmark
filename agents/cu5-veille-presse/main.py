"""CU5 — Veille Presse (Business Immo scraper)

Standalone FastAPI version (replaces Azure Functions wrapper).
All business logic is unchanged — only the HTTP framework changed.

Endpoints:
  POST /start-scrape  → 202 + job_id
  GET  /scrape-results → poll with ?job_id=xxx
  GET  /version        → health check
"""

import json
import logging
import os
import time
import threading
from datetime import datetime

from fastapi import FastAPI, Query, Request
from fastapi.responses import JSONResponse
from playwright.sync_api import sync_playwright

from newmark_common.browser import launch_firefox
from newmark_common.scrapers import businessimmo
from newmark_common.openai_analysis import analyze_article
from newmark_common.async_jobs import start_job, get_job_status, pop_job_result

app = FastAPI(title="CU5 — Veille Presse")

# ============================================================
# CONFIG
# ============================================================
BUSINESSIMMO_EMAIL = os.getenv("BUSINESS_IMO_EMAIL")
BUSINESSIMMO_PASSWORD = os.getenv("BUSINESS_IMO_PASSWORD")
API_KEY = os.getenv("API_KEY", "")

SECTIONS = [
    ("thematiques/1/actualite", "Actualité"),
    ("thematiques/7/bureau", "Bureau"),
    ("thematiques/216/commerce", "Commerce"),
    ("thematiques/494/logistique", "Logistique"),
    ("thematiques/487/transactions", "Transactions"),
]

SCRAPER_TIMEOUT_SECONDS = int(os.getenv("SCRAPER_TIMEOUT", "1500"))
_scraper_lock = threading.Lock()


# ============================================================
# API KEY MIDDLEWARE
# ============================================================
@app.middleware("http")
async def check_api_key(request: Request, call_next):
    if request.url.path == "/version":
        return await call_next(request)
    if API_KEY and request.headers.get("x-api-key") != API_KEY:
        return JSONResponse({"error": "Invalid or missing API key"}, status_code=401)
    return await call_next(request)


# ============================================================
# SCRAPER ORCHESTRATION (unchanged business logic)
# ============================================================
def run_scraper():
    """Run the full scrape pipeline. Returns (signals, nb_articles)."""
    if not _scraper_lock.acquire(blocking=False):
        raise RuntimeError("Another scraper is already running.")

    deadline = time.monotonic() + SCRAPER_TIMEOUT_SECONDS

    def _check_timeout(stage=""):
        if time.monotonic() > deadline:
            raise TimeoutError(f"Scraper timed out after {SCRAPER_TIMEOUT_SECONDS}s (stage: {stage})")

    def log(msg, *args):
        text = msg % args if args else msg
        print(f"[SCRAPER] {text}", flush=True)

    try:
        signals = []
        all_articles = []

        log("Starting scrape pipeline...")
        log("Login email: %s", BUSINESSIMMO_EMAIL or "(NOT SET!)")

        with sync_playwright() as pw:
            browser, _ctx, page = launch_firefox(pw)
            log("Firefox launched, logging in...")
            businessimmo.login(page, BUSINESSIMMO_EMAIL, BUSINESSIMMO_PASSWORD)
            log("Login done — current URL: %s", page.url)

            try:
                for section_path, section_label in SECTIONS:
                    _check_timeout(f"section {section_label}")
                    articles = businessimmo.get_recent_articles(
                        page, section_path, section_label
                    )
                    for a in articles:
                        a["source"] = f"Business Immo - {section_label}"
                    all_articles.extend(articles)
                    log("Section %s: %d articles", section_label, len(articles))
                    time.sleep(1)

                seen = set()
                all_articles = [
                    a for a in all_articles
                    if a["url"] not in seen and not seen.add(a["url"])
                ]

                log("%d unique articles to analyze", len(all_articles))

                for i, article in enumerate(all_articles):
                    _check_timeout(f"article {i+1}/{len(all_articles)}")
                    content = businessimmo.get_article_content(page, article["url"])
                    if not content:
                        log("Article %d/%d: NO CONTENT, skipping — %s", i+1, len(all_articles), article["url"])
                        continue

                    log("Article %d/%d: got %d chars, analyzing...", i+1, len(all_articles), len(content))
                    analysis = analyze_article(
                        article["title"], content, article["source"]
                    )
                    if analysis is None:
                        log("Article %d/%d: AI returned None", i+1, len(all_articles))
                    elif analysis.get("pertinent"):
                        signals.append({
                            **analysis,
                            "titre_article": article["title"],
                            "url": article["url"],
                            "source": article["source"],
                        })
                        log("Article %d/%d: SIGNAL — %s", i+1, len(all_articles), article["title"][:50])
                    else:
                        log("Article %d/%d: not pertinent", i+1, len(all_articles))
                    time.sleep(0.5)
            finally:
                browser.close()

        log("Done: %d signals from %d articles", len(signals), len(all_articles))

        return {
            "date": datetime.now().strftime("%d/%m/%Y %H:%M"),
            "nb_articles": len(all_articles),
            "nb_signals": len(signals),
            "signals": signals,
        }
    finally:
        _scraper_lock.release()


# ============================================================
# HTTP ENDPOINTS
# ============================================================
@app.api_route("/start-scrape", methods=["POST", "GET"])
async def start_scrape():
    if _scraper_lock.locked():
        return JSONResponse(
            {"status": "error", "error": "A scraper is already running."},
            status_code=409,
        )
    job_id = start_job(run_scraper)
    logging.warning("Scrape Business Immo started — job %s", job_id)
    return JSONResponse({"status": "started", "job_id": job_id}, status_code=202)


@app.get("/scrape-results")
async def scrape_results(job_id: str = Query(...)):
    job = get_job_status(job_id)
    if not job:
        return JSONResponse({"error": "job not found"}, status_code=404)
    if job["status"] == "running":
        return JSONResponse({"status": "running", "job_id": job_id}, status_code=202)
    if job["status"] == "error":
        return JSONResponse({"status": "error", "error": job["error"]}, status_code=500)
    result = pop_job_result(job_id)
    return JSONResponse(result, status_code=200)


@app.get("/version")
async def version():
    return {"agent": "cu5-veille-presse", "status": "ok"}
