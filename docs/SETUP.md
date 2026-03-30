# Jaydai Platform — Setup Guide

This guide walks through setting up the Jaydai platform on a single Azure VM with Docker Compose.

## Prerequisites

Before starting, you need:
- An Azure subscription with Owner or Contributor access
- Azure CLI (`az`) installed on your machine
- A domain name (e.g., `nmrk-jayd.ai`) with DNS management access

---

## Step 1: Provision Azure Resources

### 1.1 Create the Resource Group

```bash
az group create \
  --name rg-nmrk-jaydai-prod \
  --location northeurope
```

> **Note:** `northeurope` is the tested working region. Many EU regions have capacity
> restrictions on common VM SKUs for new subscriptions.

### 1.2 Create the VM

```bash
# Create the VM (Ubuntu 22.04, D2s_v3: 2 vCPU, 8 GB RAM, 128 GB SSD)
az vm create \
  --resource-group rg-nmrk-jaydai-prod \
  --name vm-jaydai \
  --image Ubuntu2204 \
  --size Standard_D2s_v3 \
  --os-disk-size-gb 128 \
  --admin-username jaydai \
  --generate-ssh-keys \
  --public-ip-sku Standard

# Note the public IP from the output — you'll need it for DNS
```

> **If you get SkuNotAvailable:** Your subscription may have capacity restrictions.
> Check available sizes: `az vm list-skus --location northeurope --resource-type virtualMachines --query "[?contains(name,'Standard_D') && length(restrictions)==\`0\`]" -o table`
> Or request a quota increase in the Azure Portal → Quotas.

### 1.3 Open ports (HTTPS + HTTP for Let's Encrypt)

```bash
az vm open-port --resource-group rg-nmrk-jaydai-prod --name vm-jaydai --port 80 --priority 1001
az vm open-port --resource-group rg-nmrk-jaydai-prod --name vm-jaydai --port 443 --priority 999
```

> **Note:** Priority 1000 is taken by the auto-created SSH rule. Use 999 for HTTPS.

### 1.4 Create Azure AI Services

```bash
# Create the AI resource
az cognitiveservices account create \
  --name jaydai-ai-resource \
  --resource-group rg-nmrk-jaydai-prod \
  --kind AIServices \
  --sku S0 \
  --location northeurope \
  --custom-domain jaydai-ai-resource

# Deploy gpt-4o-mini model
az cognitiveservices account deployment create \
  --name jaydai-ai-resource \
  --resource-group rg-nmrk-jaydai-prod \
  --deployment-name gpt-4o-mini \
  --model-name gpt-4o-mini \
  --model-version "2024-07-18" \
  --model-format OpenAI \
  --sku-capacity 10 \
  --sku-name "GlobalStandard"

# Get the endpoint and key (save these for .env)
az cognitiveservices account show \
  --name jaydai-ai-resource \
  --resource-group rg-nmrk-jaydai-prod \
  --query "properties.endpoint" -o tsv

az cognitiveservices account keys list \
  --name jaydai-ai-resource \
  --resource-group rg-nmrk-jaydai-prod \
  --query "key1" -o tsv
```

### 1.5 Create Entra ID App Registration

Since all apps are served on one domain (`nmrk-jayd.ai`), you only need **one** App Registration.

```bash
# Create the app registration
az ad app create \
  --display-name "Jaydai Platform" \
  --sign-in-audience AzureADMyOrg \
  --web-redirect-uris "https://nmrk-jayd.ai" "http://localhost:3000"

# Note the appId from the output — this is your AZURE_CLIENT_ID

# Create a service principal
az ad sp create --id <appId>

# Grant admin consent for User.Read
az ad app permission add --id <appId> \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope

az ad app permission admin-consent --id <appId>
```

---

## Step 2: Configure DNS

Point your domain to the VM's public IP:

| Type | Name | Value |
|------|------|-------|
| A    | @    | `<VM_PUBLIC_IP>` |
| A    | www  | `<VM_PUBLIC_IP>` |

Wait for DNS propagation (usually 5-15 minutes):
```bash
dig nmrk-jayd.ai +short
```

---

## Step 3: Set Up the VM

### 3.1 SSH into the VM

```bash
ssh jaydai@<VM_PUBLIC_IP>
```

### 3.2 Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt-get install -y docker-compose-plugin

# Log out and back in for group change to take effect
exit
ssh jaydai@<VM_PUBLIC_IP>

# Verify
docker --version
docker compose version
```

### 3.3 Install Tailscale (for remote admin access)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh
```

This gives you a stable `jaydai-vm.your-tailnet.ts.net` hostname for SSH, independent of the public IP.

### 3.4 Install Node.js 20 (for building static apps)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

## Step 4: Deploy the Application

### 4.1 Clone the repo

```bash
git clone <your-repo-url> ~/newmark
cd ~/newmark
```

### 4.2 Configure environment

```bash
cp .env.example .env
nano .env
```

Fill in all values:
- `DOMAIN=nmrk-jayd.ai`
- `AZURE_TENANT_ID=<from az account show>`
- `AZURE_CLIENT_ID=<from Step 1.5>`
- `AZURE_AI_ENDPOINT=<from Step 1.4>`
- `AZURE_AI_KEY=<from Step 1.4>`
- `API_KEY=<generate a random string: openssl rand -hex 32>`
- Scraper credentials (Business Immo, La Place, etc.)
- `LETSENCRYPT_EMAIL=<your email for cert expiry notifications>`

### 4.3 Set up TLS (Let's Encrypt)

Before starting the full stack, get the initial certificate:

```bash
# Create certbot directories
mkdir -p certbot/conf certbot/www

# Get initial certificate (nginx must NOT be running yet)
docker run --rm \
  -v $(pwd)/certbot/conf:/etc/letsencrypt \
  -v $(pwd)/certbot/www:/var/www/certbot \
  -p 80:80 \
  certbot/certbot certonly \
  --standalone \
  --email $(grep LETSENCRYPT_EMAIL .env | cut -d= -f2) \
  --agree-tos \
  --no-eff-email \
  -d nmrk-jayd.ai
```

### 4.4 Build the static apps

```bash
./scripts/build-apps.sh
```

This generates the `out/` directory for each of the 10 Next.js apps.

### 4.5 Build and start all services

```bash
# Build agent Docker images
docker compose build

# Start everything
docker compose up -d

# Check status
docker compose ps
docker compose logs --tail=20
```

---

## Step 5: Configure Power Automate

If Power Automate is in scope:

1. Import the Power Automate solution into the client's Power Platform environment
2. Update the environment variables in the solution:
   - `jdy_CU5_FUNCTION_URL` → `https://nmrk-jayd.ai/api/cu5`
   - `jdy_CU1_FUNCTION_URL` → `https://nmrk-jayd.ai/api/cu1`
   - `jdy_CU5_FUNCTION_KEY` → the `API_KEY` value from your `.env`
   - `jdy_CU1_FUNCTION_KEY` → same `API_KEY`
3. Test the flows by triggering them manually

---

## Maintenance

### Update the code

```bash
cd ~/newmark
git pull
./scripts/build-apps.sh        # Rebuild static apps
docker compose build            # Rebuild agent images
docker compose up -d            # Restart with new images
```

### View logs

```bash
docker compose logs -f cu5-agent   # Follow CU5 logs
docker compose logs -f nginx       # Follow nginx access logs
docker compose logs --tail=100     # Last 100 lines from all services
```

### Restart a service

```bash
docker compose restart cu5-agent
```

### Renew TLS certificate

Certbot auto-renews via the `certbot` service in docker-compose. Check:
```bash
docker compose logs certbot
```

### Disk cleanup

```bash
# Remove old Docker images
docker system prune -f

# Check disk usage
df -h /
```

---

## Architecture Summary

```
nmrk-jayd.ai (public IP)
├── nginx (:443)
│   ├── /                → Hub (static)
│   ├── /dashboard/      → KPI Dashboard (static)
│   ├── /commercialisation/ → Carte Commercialisation (static)
│   ├── /transactions/   → Carte Transactions (static)
│   ├── /offre-retail/   → Carte Offre Retail (static)
│   ├── /visites/        → Planning Visites (static)
│   ├── /comparables/    → Comparables (static)
│   ├── /proprietaire/   → Recherche Propriétaire (static)
│   ├── /encarts/        → Encarts Diffusion (static)
│   ├── /graphistes/     → Feuilles Temps (static)
│   ├── /api/cu5/        → CU5 Agent (FastAPI)
│   ├── /api/cu1/        → CU1 Agent (FastAPI)
│   └── /api/cu4/        → CU4 Agent (FastAPI)
├── cu5-agent (Playwright + Firefox)
├── cu1-agent (Playwright + Firefox)
├── cu4-agent (Playwright + Firefox)
├── ofelia (cron: 6AM Mon-Fri → CU5)
└── certbot (TLS auto-renewal)
```
