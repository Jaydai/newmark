"""Persistent async job store for Azure Functions.

Pattern: POST → start_job() returns job_id (202), GET → get_job_status() polls,
pop_job_result() returns final result and cleans up.

Uses Azure Table Storage for persistence so that jobs survive container restarts.
Falls back to in-memory storage if no storage connection string is available.

Reads the connection string from AzureWebJobsStorage (already set on every
Azure Function App) or AZURE_STORAGE_CONNECTION_STRING as a fallback.

The background worker thread updates a heartbeat timestamp every 30s.
The polling endpoint detects stale jobs (heartbeat > 3 min old) and reports them
as errors instead of hanging indefinitely.
"""

import json
import logging
import os
import threading
import time
import uuid
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
# AzureWebJobsStorage is set automatically on every Azure Function App —
# no extra configuration needed.
_STORAGE_CONN_STR = os.getenv("AzureWebJobsStorage", "") or os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
_TABLE_NAME = "asyncjobs"
_HEARTBEAT_INTERVAL = 30      # seconds between heartbeat updates
_HEARTBEAT_STALE_AFTER = 180  # seconds — if no heartbeat for 3 min, job is stale

# ---------------------------------------------------------------------------
# Table Storage backend (preferred)
# ---------------------------------------------------------------------------
_table_client = None

if _STORAGE_CONN_STR:
    try:
        from azure.data.tables import TableServiceClient
        _service = TableServiceClient.from_connection_string(_STORAGE_CONN_STR)
        _service.create_table_if_not_exists(_TABLE_NAME)
        _table_client = _service.get_table_client(_TABLE_NAME)
        logging.info("async_jobs: using Azure Table Storage (%s)", _TABLE_NAME)
    except Exception as e:
        logging.warning("async_jobs: Table Storage init failed, falling back to in-memory: %s", e)
        _table_client = None

if not _table_client:
    logging.info("async_jobs: using in-memory store (set AZURE_STORAGE_CONNECTION_STRING for persistence)")

# ---------------------------------------------------------------------------
# In-memory fallback
# ---------------------------------------------------------------------------
_jobs: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Internal helpers — Table Storage
# ---------------------------------------------------------------------------
def _ts_now() -> str:
    """ISO timestamp in UTC."""
    return datetime.now(timezone.utc).isoformat()


def _table_upsert(job_id: str, data: dict):
    """Write job state to Table Storage."""
    if not _table_client:
        return
    entity = {
        "PartitionKey": "jobs",
        "RowKey": job_id,
        "status": data.get("status", "unknown"),
        "heartbeat": data.get("heartbeat", _ts_now()),
        "created": data.get("created", _ts_now()),
    }
    # Store result/error as JSON string (Table Storage doesn't support nested objects)
    if "result" in data:
        entity["result_json"] = json.dumps(data["result"], ensure_ascii=False)
    if "error" in data:
        entity["error"] = data["error"]
    try:
        _table_client.upsert_entity(entity)
    except Exception as e:
        logging.error("async_jobs: table upsert failed for %s: %s", job_id, e)


def _table_get(job_id: str) -> dict | None:
    """Read job state from Table Storage."""
    if not _table_client:
        return None
    try:
        entity = _table_client.get_entity("jobs", job_id)
        data = {"status": entity["status"], "heartbeat": entity.get("heartbeat", "")}
        if "result_json" in entity and entity["result_json"]:
            data["result"] = json.loads(entity["result_json"])
        if "error" in entity and entity["error"]:
            data["error"] = entity["error"]
        return data
    except Exception:
        return None


def _table_delete(job_id: str):
    """Remove job from Table Storage."""
    if not _table_client:
        return
    try:
        _table_client.delete_entity("jobs", job_id)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Heartbeat — keeps the job's timestamp fresh while the worker runs
# ---------------------------------------------------------------------------
def _heartbeat_loop(job_id: str, stop_event: threading.Event):
    """Periodically update the heartbeat timestamp for a running job."""
    while not stop_event.wait(_HEARTBEAT_INTERVAL):
        now = _ts_now()
        # Update in-memory
        if job_id in _jobs:
            _jobs[job_id]["heartbeat"] = now
        # Update Table Storage
        if _table_client:
            try:
                _table_client.upsert_entity({
                    "PartitionKey": "jobs",
                    "RowKey": job_id,
                    "status": "running",
                    "heartbeat": now,
                })
            except Exception:
                pass


def _is_heartbeat_stale(job: dict) -> bool:
    """Check if a running job's heartbeat is too old (worker likely dead)."""
    hb = job.get("heartbeat", "")
    if not hb:
        return False
    try:
        hb_time = datetime.fromisoformat(hb)
        age = (datetime.now(timezone.utc) - hb_time).total_seconds()
        return age > _HEARTBEAT_STALE_AFTER
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def start_job(worker_fn, *args):
    """Start a background job. Returns the job_id immediately."""
    job_id = str(uuid.uuid4())
    now = _ts_now()
    job_data = {"status": "running", "heartbeat": now, "created": now}

    _jobs[job_id] = job_data
    _table_upsert(job_id, job_data)

    logging.info("Job %s started", job_id)

    stop_heartbeat = threading.Event()

    def _run():
        try:
            result = worker_fn(*args)
            done_data = {"status": "done", "result": result, "heartbeat": _ts_now()}
            _jobs[job_id] = done_data
            _table_upsert(job_id, done_data)
        except Exception as e:
            logging.error("Job %s failed: %s", job_id, e)
            err_data = {"status": "error", "error": str(e), "heartbeat": _ts_now()}
            _jobs[job_id] = err_data
            _table_upsert(job_id, err_data)
        finally:
            stop_heartbeat.set()

    # Start heartbeat thread
    hb_thread = threading.Thread(target=_heartbeat_loop, args=(job_id, stop_heartbeat), daemon=True)
    hb_thread.start()

    # Start worker thread
    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return job_id


def get_job_status(job_id):
    """Return the current status dict for a job, or None if not found.

    Checks in-memory first, then Table Storage.
    Detects stale jobs (dead worker) and marks them as errors.
    """
    # Try in-memory first (fastest path, works when container hasn't restarted)
    job = _jobs.get(job_id)

    # Fall back to Table Storage (works after container restart)
    if not job:
        job = _table_get(job_id)
        if job:
            _jobs[job_id] = job  # cache locally

    if not job:
        return None

    # Detect stale running jobs (worker thread died due to container restart)
    if job["status"] == "running" and _is_heartbeat_stale(job):
        logging.warning("Job %s heartbeat stale — marking as error", job_id)
        err_data = {
            "status": "error",
            "error": "Job timed out — worker process was interrupted (container restart). Please retry.",
            "heartbeat": job.get("heartbeat", ""),
        }
        _jobs[job_id] = err_data
        _table_upsert(job_id, err_data)
        return err_data

    return job


def pop_job_result(job_id):
    """Return the job's result dict and delete it from the store."""
    job = _jobs.pop(job_id, None)

    # Try Table Storage if not in memory
    if not job:
        job = _table_get(job_id)

    # Clean up Table Storage
    _table_delete(job_id)

    if job and job["status"] == "done":
        return job["result"]
    return job
