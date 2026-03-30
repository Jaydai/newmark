# Jaydai Platform — Testing Guide

Step-by-step guide to test the deployment end-to-end.

---

## Phase 1: Provision a Test VM (5 min)

You can test locally with Docker Compose or on a real Azure VM.

### Option A: Test locally (no Azure needed)

```bash
# 1. Copy and configure .env
cp .env.example .env
# Edit .env — set at minimum: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_AI_ENDPOINT, AZURE_AI_KEY

# 2. Generate .env.local for all apps
./scripts/sync-env.sh

# 3. Skip TLS for local testing — use the HTTP-only nginx config:
#    In nginx/nginx.conf, comment out the SSL server block and change
#    the port 80 block to serve directly instead of redirecting.

# 4. Build apps (needs Node.js 20)
./scripts/build-apps.sh

# 5. Build and start
docker compose build
docker compose up -d
```

Access at `http://localhost` (MSAL won't work without HTTPS and proper domain, but you can verify static sites load).

### Option B: Real Azure VM (recommended for full test)

Follow Steps 1-4 of [SETUP.md](./SETUP.md), then continue below.

---

## Phase 2: Verify Static Sites (5 min)

Open each URL in a browser and confirm the page loads:

| # | URL | Expected |
|---|-----|----------|
| 1 | `https://nmrk-jayd.ai/` | Hub — navigation portal with links to all apps |
| 2 | `https://nmrk-jayd.ai/dashboard/` | KPI Dashboard — charts and data tables |
| 3 | `https://nmrk-jayd.ai/commercialisation/` | Carte de Commercialisation — Leaflet map |
| 4 | `https://nmrk-jayd.ai/transactions/` | Carte des Transactions — Leaflet map |
| 5 | `https://nmrk-jayd.ai/offre-retail/` | Carte Offre Retail — Leaflet map |
| 6 | `https://nmrk-jayd.ai/visites/` | Planning de Visites — Leaflet map |
| 7 | `https://nmrk-jayd.ai/comparables/` | Comparables — Leaflet map with Excel import |
| 8 | `https://nmrk-jayd.ai/proprietaire/` | Recherche Propriétaire — search form |
| 9 | `https://nmrk-jayd.ai/encarts/` | Encarts Diffusion — ad placement |
| 10 | `https://nmrk-jayd.ai/graphistes/` | Feuilles Temps Graphistes — timesheet |

**What to check:**
- [ ] Page loads without 404 or blank screen
- [ ] CSS/JS assets load correctly (no broken styles)
- [ ] Images and fonts render properly
- [ ] Navigation links between apps work (Hub → other apps and back)

---

## Phase 3: Test MSAL Authentication (5 min)

1. Open `https://nmrk-jayd.ai/` in a browser
2. You should see a "Sign in" button or be redirected to Microsoft login
3. Sign in with a user from the configured Azure AD tenant
4. After login, you should be redirected back to the app
5. Verify that user profile information appears (name, email)

**Troubleshooting:**
- If login fails with "redirect URI mismatch": check that the App Registration's redirect URI is exactly `https://nmrk-jayd.ai`
- If "AADSTS50011": the app registration needs the redirect URI added
- Open browser DevTools → Console to see MSAL error messages

---

## Phase 4: Test Agent Health (2 min)

Check that all 3 agents are running:

```bash
# From your machine (or the VM):
curl -s https://nmrk-jayd.ai/api/cu5/version | jq
curl -s https://nmrk-jayd.ai/api/cu1/version | jq
curl -s https://nmrk-jayd.ai/api/cu4/version | jq
```

Expected response for each:
```json
{"agent": "cu5-veille-presse", "status": "ok"}
```

If you get 502 Bad Gateway: the agent container isn't running. Check:
```bash
docker compose ps
docker compose logs cu5-agent
```

---

## Phase 5: Test CU5 — Veille Presse (20 min)

CU5 scrapes Business Immo articles and analyzes them with AI.

```bash
# Start a scrape (replace YOUR_API_KEY with the API_KEY from .env)
curl -s -X POST https://nmrk-jayd.ai/api/cu5/start-scrape \
  -H "x-api-key: YOUR_API_KEY" | jq

# Response:
# {"status": "started", "job_id": "abc-123-..."}
```

```bash
# Poll for results (replace JOB_ID)
curl -s "https://nmrk-jayd.ai/api/cu5/scrape-results?job_id=JOB_ID" \
  -H "x-api-key: YOUR_API_KEY" | jq

# While running: {"status": "running", "job_id": "..."}
# When done:    {"date": "...", "nb_articles": 42, "nb_signals": 5, "signals": [...]}
```

**What to check:**
- [ ] Job starts successfully (202 response)
- [ ] Polling returns "running" status
- [ ] After ~15-20 min, results are returned
- [ ] `nb_articles` > 0 (confirms Business Immo login worked)
- [ ] `signals` array contains analyzed articles

**Monitor live:**
```bash
docker compose logs -f cu5-agent
```

---

## Phase 6: Test CU1 — Lecture Presse Excel (20 min)

CU1 scrapes articles, classifies them as transactions, and generates an XLSX.

```bash
# Start
curl -s -X POST https://nmrk-jayd.ai/api/cu1/start-scrape \
  -H "x-api-key: YOUR_API_KEY" | jq

# Poll (same pattern)
curl -s "https://nmrk-jayd.ai/api/cu1/scrape-results?job_id=JOB_ID" \
  -H "x-api-key: YOUR_API_KEY" | jq
```

**What to check:**
- [ ] `nb_transactions` > 0 (AI classification works)
- [ ] `xlsx_base64` field is present (Excel was generated)
- [ ] Decode the base64 to verify the Excel opens correctly:
  ```bash
  # Extract and save the Excel
  curl -s "https://nmrk-jayd.ai/api/cu1/scrape-results?job_id=JOB_ID" \
    -H "x-api-key: YOUR_API_KEY" \
    | jq -r '.xlsx_base64' | base64 -d > test_output.xlsx
  ```

---

## Phase 7: Test CU4 — Recherche Propriétaire (10 min)

CU4 looks up property owners on La Place de l'Immobilier.

```bash
# Start a lookup
curl -s -X POST https://nmrk-jayd.ai/api/cu4/start-lookup \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"addresses": ["12 rue de la Paix, 75002 Paris"]}' | jq

# Poll
curl -s "https://nmrk-jayd.ai/api/cu4/lookup-results?job_id=JOB_ID" \
  -H "x-api-key: YOUR_API_KEY" | jq
```

**What to check:**
- [ ] Login to La Place succeeds (check Docker logs)
- [ ] Owner information is returned
- [ ] `xlsx_base64` present (Excel report generated)

**Also test from the frontend:**
1. Go to `https://nmrk-jayd.ai/proprietaire/`
2. Sign in with MSAL
3. Enter an address and click search
4. Verify results appear and Excel download works

---

## Phase 8: Test Cron (CU5 Timer) (next 6 AM)

The ofelia cron sidecar triggers CU5 at 6:00 AM UTC, Monday-Friday.

```bash
# Check ofelia is running
docker compose ps ofelia

# View ofelia logs (should show next scheduled run)
docker compose logs ofelia

# To test immediately without waiting:
docker compose exec cu5-agent curl -s -X POST http://localhost:8000/start-scrape
```

---

## Phase 9: Test Power Automate Integration (5 min)

If Power Automate flows are configured:

1. Open the Power Automate flow for CU5 newsletter
2. Update the HTTP action URL to `https://nmrk-jayd.ai/api/cu5/start-scrape`
3. Add header: `x-api-key` = your API_KEY
4. Trigger the flow manually
5. Verify:
   - [ ] Flow calls the endpoint successfully
   - [ ] Polling loop works (flow waits for results)
   - [ ] Newsletter email is sent with the results

---

## Phase 10: Security Checks (5 min)

```bash
# Verify API key protection works
curl -s https://nmrk-jayd.ai/api/cu5/start-scrape -X POST | jq
# Should return: {"error": "Invalid or missing API key"} (401)

# Verify version endpoint is public (no key needed)
curl -s https://nmrk-jayd.ai/api/cu5/version | jq
# Should return: {"agent": "cu5-veille-presse", "status": "ok"}

# Verify HTTPS redirect
curl -s -o /dev/null -w "%{http_code}" http://nmrk-jayd.ai/
# Should return: 301

# Verify TLS certificate
curl -vI https://nmrk-jayd.ai/ 2>&1 | grep "subject:"
# Should show: subject: CN=nmrk-jayd.ai
```

---

## Troubleshooting

### App shows blank page or 404
- Check nginx logs: `docker compose logs nginx`
- Verify the `out/` directory exists: `ls apps/D00_hub/out/`
- Rebuild: `./scripts/build-apps.sh`

### Agent returns 502 Bad Gateway
- Check agent is running: `docker compose ps`
- Check agent logs: `docker compose logs cu5-agent`
- Common cause: Playwright Firefox failed to install → rebuild: `docker compose build --no-cache cu5-agent`

### MSAL login redirects to wrong URL
- Check App Registration redirect URIs in Azure Portal → App registrations → Jaydai Platform → Authentication
- Must include `https://nmrk-jayd.ai`

### Business Immo scraping returns 0 articles
- Check credentials in `.env`: `BUSINESS_IMO_EMAIL` and `BUSINESS_IMO_PASSWORD`
- Check Docker logs for login errors: `docker compose logs -f cu5-agent`
- Test with the version endpoint for scraper diagnostics

### Cron not firing
- Check ofelia container: `docker compose logs ofelia`
- Check that the Docker socket is mounted: verify `/var/run/docker.sock` exists
- Manually test: `docker compose exec cu5-agent curl -s -X POST http://localhost:8000/start-scrape`

### TLS certificate expired
- Check certbot logs: `docker compose logs certbot`
- Manual renewal: `docker compose run certbot renew`
- Restart nginx: `docker compose restart nginx`
