"""CU4 — Recherche Propriétaire (Property Owner Lookup)

Standalone FastAPI version (replaces Azure Functions wrapper).
All business logic is unchanged — only the HTTP framework changed.

Endpoints:
  POST /start-lookup    → 202 + job_id  (body: {"addresses": [...]})
  GET  /lookup-results   → poll with ?job_id=xxx
  GET  /version          → health check
"""

import json
import logging
import os
import time
import threading

from fastapi import FastAPI, Query, Request
from fastapi.responses import JSONResponse
from playwright.sync_api import sync_playwright

from newmark_common.async_jobs import get_job_status, pop_job_result, start_job
from newmark_common.browser import launch_firefox

import laplace_scraper
import excel_builder

app = FastAPI(title="CU4 — Recherche Propriétaire")

BUILD_VERSION = os.environ.get("BUILD_VERSION", "dev")
API_KEY = os.getenv("API_KEY", "")

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
# PIPELINE (unchanged business logic)
# ============================================================
def run_pipeline(addresses: list[str]) -> dict:
    """Search La Place for each address → build Excel."""
    if not _scraper_lock.acquire(blocking=False):
        raise RuntimeError("Another lookup is already running.")

    deadline = time.monotonic() + SCRAPER_TIMEOUT_SECONDS

    def _check_timeout(stage=""):
        if time.monotonic() > deadline:
            raise TimeoutError(f"Lookup timed out after {SCRAPER_TIMEOUT_SECONDS}s (stage: {stage})")

    def log(msg, *args):
        text = msg % args if args else msg
        print(f"[CU4] {text}", flush=True)

    try:
        log("Starting property owner lookup for %d addresses", len(addresses))

        laplace_results = {}

        with sync_playwright() as pw:
            browser, context, page = launch_firefox(pw)
            log("Firefox launched, logging in to La Place...")

            try:
                laplace_logged_in = laplace_scraper.login(page)
                log("Login result: %s", "OK" if laplace_logged_in else "FAILED")

                if laplace_logged_in:
                    for i, addr in enumerate(addresses):
                        _check_timeout(f"address {i+1}/{len(addresses)}")
                        log("Address %d/%d: %s", i+1, len(addresses), addr)
                        laplace_results[addr] = laplace_scraper.search_address(page, addr)
                        log("Address %d/%d: found=%s", i+1, len(addresses), laplace_results[addr].get("found", False))
                        time.sleep(1)
                else:
                    for addr in addresses:
                        laplace_results[addr] = {
                            "address_query": addr, "found": False,
                            "owners": [], "dirigeants": [],
                            "property_info": {},
                            "error": "Login failed",
                        }
            finally:
                browser.close()

        combined_results = []
        all_dirigeants = {}

        for addr in addresses:
            laplace = laplace_results.get(addr, {})
            owners = laplace.get("owners", [])
            dirigeants = laplace.get("dirigeants", [])

            first_owner = owners[0] if owners else {}

            combined_results.append({
                "address": addr,
                "owner_name": first_owner.get("name", ""),
                "owner_type": first_owner.get("type", ""),
                "siren": first_owner.get("siren", ""),
                "forme_juridique": first_owner.get("forme_juridique", ""),
                "maison_mere": first_owner.get("maison_mere", ""),
                "nbre_actifs": first_owner.get("nbre_actifs", ""),
                "surface": first_owner.get("surface", ""),
                "all_owners": owners,
                "error": laplace.get("error"),
            })

            all_dirigeants[addr] = dirigeants

        log("Building Excel report")
        xlsx_b64 = excel_builder.build_report(combined_results, all_dirigeants)

        summary = []
        for r in combined_results:
            summary.append({
                "address": r["address"],
                "owner": r["owner_name"],
                "owner_type": r["owner_type"],
                "siren": r["siren"],
                "dirigeants_count": len(all_dirigeants.get(r["address"], [])),
            })

        log("Done: %d addresses processed", len(addresses))

        return {
            "status": "done",
            "addresses_count": len(addresses),
            "xlsx_base64": xlsx_b64,
            "summary": summary,
        }
    finally:
        _scraper_lock.release()


# ============================================================
# HTTP ENDPOINTS
# ============================================================
@app.post("/start-lookup")
async def start_lookup(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body"}, status_code=400)

    addresses = body.get("addresses", [])
    if not addresses or not isinstance(addresses, list):
        return JSONResponse({"error": "Missing or invalid 'addresses' array"}, status_code=400)

    if len(addresses) > 20:
        return JSONResponse({"error": "Maximum 20 addresses per batch"}, status_code=400)

    if _scraper_lock.locked():
        return JSONResponse(
            {"status": "error", "error": "A lookup is already running."},
            status_code=409,
        )

    job_id = start_job(run_pipeline, addresses)
    return JSONResponse(
        {"status": "started", "job_id": job_id, "addresses_count": len(addresses)},
        status_code=202,
    )


@app.get("/lookup-results")
async def lookup_results(job_id: str = Query(...)):
    job = get_job_status(job_id)
    if job is None:
        return JSONResponse({"error": "Unknown job_id"}, status_code=404)
    if job["status"] == "running":
        return JSONResponse({"status": "running", "job_id": job_id}, status_code=202)
    if job["status"] == "error":
        return JSONResponse({"status": "error", "error": job.get("error", "Unknown error")}, status_code=500)
    result = pop_job_result(job_id)
    return JSONResponse(result, status_code=200)


@app.get("/version")
async def version():
    return {"agent": "cu4-recherche-proprietaire", "version": BUILD_VERSION}
