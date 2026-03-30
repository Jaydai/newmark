# Jaydai Platform — IT Requirements & Handover Document

## 1. What We Have Built

The Jaydai platform is a suite of **10 internal web applications** and **3 backend automation agents** for the Newmark commercial real estate team.

### Web Applications (accessed via browser)

| App | Purpose |
|-----|---------|
| **Hub** | Central navigation portal linking all other apps |
| **Dashboard Offres** | KPI dashboard for monitoring real estate offers |
| **Carte de Commercialisation** | Interactive map of commercial properties |
| **Carte des Transactions** | Interactive map of real estate transactions |
| **Carte Offre Retail** | Interactive map for retail property offers |
| **Planning de Visites** | Schedule and map property visits with itinerary |
| **Comparables** | Import and analyze comparable property data from Excel |
| **Recherche Propriétaire** | Search for property owners by address |
| **Encarts Diffusion** | Ad placement and distribution |
| **Feuilles Temps Graphistes** | Timesheet tracking for graphic designers |

All apps use **Microsoft Entra ID (Azure AD)** for authentication — only users from your organisation can log in.

### Backend Agents (automated tasks)

| Agent | What it does | Trigger |
|-------|-------------|---------|
| **Veille Presse (CU5)** | Scrapes Business Immo for press articles, uses AI to identify relevant signals for the team | Automated: 6 AM every weekday. Also callable from Power Automate. |
| **Lecture Presse → Excel (CU1)** | Scrapes press articles, classifies each as a transaction or not, extracts ~35 structured fields, generates an Excel report | On-demand via Power Automate |
| **Recherche Propriétaire (CU4)** | Looks up property owners on La Place de l'Immobilier, generates an Excel report with owner details and company directors | On-demand via the Recherche Propriétaire web app |

### Technology Stack

- **Web apps**: Next.js (static HTML/CSS/JS) — no server-side processing, just files served by nginx
- **Agents**: Python 3.12 + Playwright (automated browser for web scraping) + AI (Azure OpenAI)
- **Infrastructure**: Single Linux VM running Docker containers
- **Authentication**: Microsoft Entra ID (MSAL.js, single-page application flow)
- **AI**: Azure AI Services (gpt-4o-mini for text analysis and classification)

---

## 2. Current Deployment Architecture

Everything runs on a **single Virtual Machine** with Docker:

```
https://nmrk.jayd.ai
         │
    ┌────┴─────────────────────────────────────┐
    │         VM (Ubuntu 22.04, Docker)         │
    │                                           │
    │  nginx (reverse proxy)                    │
    │  ├── /              → Hub                 │
    │  ├── /dashboard/    → KPI Dashboard       │
    │  ├── /carte-.../    → Map apps (×4)       │
    │  ├── /visites/      → Visit Planning      │
    │  ├── /comparables/  → Comparables         │
    │  ├── /proprietaire/ → Owner Search        │
    │  ├── /encarts/      → Ad Placement        │
    │  ├── /graphistes/   → Timesheets          │
    │  ├── /api/cu5/      → Press Agent         │
    │  ├── /api/cu1/      → Excel Agent         │
    │  └── /api/cu4/      → Owner Agent         │
    │                                           │
    │  3 Python agent containers                │
    │  Cron scheduler (6 AM trigger)            │
    └───────────────────────────────────────────┘
         │
         ▼
    Azure AI Services (gpt-4o-mini)
```

---

## 3. What We Need From Your IT Team

### 3.1 Azure Resources (must be in your subscription)

| # | Resource | Spec | Why | Est. Cost |
|---|----------|------|-----|-----------|
| 1 | **Linux VM** | Ubuntu 22.04, Standard_D2s_v3 (2 vCPU, 8 GB RAM), 128 GB SSD | Hosts all apps and agents | ~€90/month |
| 2 | **Static Public IP** | Standard SKU | Users access the platform via browser; Power Automate calls the agent APIs | ~€3/month |
| 3 | **Azure AI Services** | S0 SKU, Sweden Central region | AI model inference (gpt-4o-mini) for the agents. Must be in Sweden Central — the model is not available in all regions. | ~€10-50/month (usage-based) |
| 4 | **NSG rules** | Inbound: port 80 + 443 from internet. Outbound: all HTTPS | Users access apps on 443. Agents need outbound internet to scrape external websites. | Free |

**Estimated total: ~€100-145/month**

### 3.2 Entra ID / Identity (your tenant)

| # | Requirement | Details |
|---|-------------|---------|
| 5 | **1 App Registration** (SPA type) | All 10 apps share one domain, so only 1 registration is needed. Redirect URI: `https://<your-chosen-domain>`. Type must be **Single-Page Application** (not Web). |
| 6 | **API permissions** | `User.Read` (delegated) — allows the apps to read the logged-in user's name and email. Some apps also use `Files.Read.All` and `Sites.Read.All` for SharePoint access. |
| 7 | **Admin consent** | An admin must grant consent for the above permissions so users don't get a consent prompt. |

### 3.3 DNS

| # | Requirement | Details |
|---|-------------|---------|
| 8 | **Subdomain or domain** | A DNS A record pointing to the VM's public IP. Examples: `ai.newmark.fr`, `outils.newmark.fr`, or a subdomain on any domain you control. |
| 9 | **TLS certificate** | We can use a Cloudflare Origin Certificate (if using Cloudflare) or Let's Encrypt (if DNS is direct). |

### 3.4 Network / Security

| # | Requirement | Details |
|---|-------------|---------|
| 10 | **Outbound internet from the VM** | The agents scrape external websites (businessimmo.com, lemonde.fr, laplaceimmo.com) and call Azure AI endpoints. If you have a corporate proxy or firewall, these domains must be whitelisted. |
| 11 | **SSH access for us (Jaydai/Sopatech)** | We need SSH access to manage and update the platform. Options: (a) direct SSH via public IP, (b) Tailscale (lightweight VPN agent on the VM — we connect from our machines, no VPN infrastructure needed), or (c) your existing VPN/Bastion. |

### 3.5 Power Automate (if applicable)

| # | Requirement | Details |
|---|-------------|---------|
| 12 | **Power Automate Premium licenses** | The flows use the HTTP connector to call the agent APIs. This requires Premium licensing. |
| 13 | **Import our solution** | We provide a Power Automate solution (.zip) to import into your Power Platform environment. The flows orchestrate the agents (trigger scraping, route results to email/SharePoint). |

---

## 4. What We Handle (no action needed from IT)

- Installing and configuring Docker on the VM
- Building and deploying all applications and agents
- Configuring nginx (reverse proxy, TLS)
- Setting up the cron scheduler for automated tasks
- All code updates and maintenance (via SSH/Tailscale)
- Monitoring and troubleshooting

---

## 5. User Experience

- Users access `https://<your-domain>/` in their **normal browser** (Chrome, Edge, etc.)
- They sign in with their **existing Microsoft / Entra ID credentials**
- **No software to install** on user machines
- The platform works on desktop and tablet

---

## 6. Security Summary

| Aspect | How it's handled |
|--------|-----------------|
| **Authentication** | Entra ID single-tenant — only your organisation's users can access |
| **TLS/HTTPS** | All traffic encrypted (Cloudflare or Let's Encrypt certificate) |
| **Agent API protection** | API key required in headers — Power Automate sends the key, unauthenticated requests are rejected |
| **VM access** | SSH key-based authentication only (no passwords). Optionally restricted to Tailscale. |
| **Secrets** | Stored in `.env` file on the VM with restricted permissions. Can be migrated to Azure Key Vault if required. |
| **Data at rest** | No database. Apps are stateless. Agents process data in-memory and return results directly. No persistent user data stored on the VM. |

---

## 7. Questions for the IT Team

### Infrastructure
1. **Which Azure subscription** should we deploy the VM into?
2. **Which region** do you prefer? (We've tested `northeurope` — it has good availability. AI Services will be in `swedencentral` regardless.)
3. **Do you already have an Azure AI Services / Azure OpenAI resource** we can share, or should we create a dedicated one?
4. **Are there restrictions on creating VMs** in your subscription? (Some subscriptions require quota requests for certain VM sizes.)

### Identity & Access
5. **Can we create an App Registration** in your Entra ID tenant? (Requires Application Administrator role, or someone from your team does it for us.)
6. **Who can grant admin consent** for the API permissions (`User.Read`, optionally `Files.Read.All`)?
7. **Should we restrict access to specific user groups**, or is it open to all users in the tenant?

### Network
8. **Is outbound internet allowed from VMs**, or do you require a corporate proxy? If proxy, what is the proxy address?
9. **Are there any firewall rules** that block outbound HTTPS to arbitrary domains? The agents need to reach: `businessimmo.com`, `lemonde.fr`, `laplaceimmo.com`, `cognitiveservices.azure.com`.
10. **What domain/subdomain can we use?** Do you have a preferred domain (e.g., `ai.newmark.fr`)? Who manages DNS?

### Remote Access
11. **How should we access the VM for management?** Options:
    - (a) SSH via public IP (simplest — port 22 is open)
    - (b) Tailscale (we install a lightweight agent on the VM — no infrastructure changes needed)
    - (c) Your existing VPN or Azure Bastion
12. **Is installing Tailscale on the VM acceptable**, or does your security policy prohibit third-party VPN agents?

### Power Automate
13. **Do you use Power Automate?** If yes, do you have Premium licenses?
14. **Can we import a Power Automate solution** into your environment?
15. **Who manages Power Platform** in your organisation? (We need their help for the import.)

### Operations
16. **Who is responsible for VM OS updates?** We can handle it via SSH, or your team can include it in your patching cycle.
17. **Do you have monitoring/alerting requirements?** (Azure Monitor, Datadog, etc.)
18. **Backup requirements?** Should we enable Azure VM Backup for disaster recovery?

### Compliance
19. **Are there data residency requirements?** (All processing happens on the VM in the Azure region you choose. AI calls go to Sweden Central.)
20. **Do you require secrets to be stored in Azure Key Vault** instead of on-disk `.env` files?

---

## 8. Next Steps

1. **IT team answers the questions above** (Section 7)
2. **We schedule a 1-hour setup session** where we provision resources together
3. **We deploy the platform** (takes ~2 hours)
4. **We do a walkthrough** with the Newmark team (30 min)
5. **Go live**

---
*Document prepared by Jaydai team — March 2026*
