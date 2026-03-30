#!/usr/bin/env bash
# =============================================================================
# build-apps.sh — Build all 10 Next.js apps (static export)
# =============================================================================
# Usage: ./scripts/build-apps.sh
# Prerequisites: Node.js 20+, npm
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GREEN='\033[0;32m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'

# Generate .env.local for all apps first
echo -e "${BLUE}━━━ Step 1: Generate .env.local files ━━━${NC}"
bash "$REPO_ROOT/scripts/sync-env.sh"

echo -e "\n${BLUE}━━━ Step 2: Build all apps ━━━${NC}\n"

# Static apps only (encarts + graphistes are standalone — built by Docker)
APPS=(
  D00_hub
  D08-CU6_dashboard-offres
  D09-CU5_carte-commercialisation
  D09-CU5_carte-transactions
  D05-CU1_carte-offre-retail
  D04-CU6_planning-visites
  D09-CU8_comparables
  D05-CU4_recherche-proprietaire
)

for app in "${APPS[@]}"; do
  APP_DIR="$REPO_ROOT/apps/$app"
  echo -e "${BLUE}Building $app...${NC}"

  cd "$APP_DIR"
  npm ci --silent 2>/dev/null || npm install --silent
  npm run build

  if [ -d "$APP_DIR/out" ]; then
    echo -e "  ${GREEN}✓${NC} $app → out/ ($(du -sh "$APP_DIR/out" | cut -f1))"
  else
    echo -e "  ${RED}✗${NC} $app — no out/ directory produced"
    exit 1
  fi
done

cd "$REPO_ROOT"
echo -e "\n${GREEN}All apps built successfully.${NC}"
echo "Run 'docker compose up -d' to start the services."
