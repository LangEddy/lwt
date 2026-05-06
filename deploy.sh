#!/usr/bin/env bash
# deploy.sh — Run on the VPS (srv159) to deploy LWT
# Images are built locally and pushed to ghcr.io — no building happens here.
# Usage: bash deploy.sh
set -euo pipefail

APP_DIR="/opt/lwt"
COMPOSE_FILE="docker-compose.prod.yml"
REGISTRY="ghcr.io/YOUR_GITHUB_USER"

# ─── 1. Install Docker (skip if already installed) ───────────────────────────
if ! command -v docker &>/dev/null; then
  echo "[1/4] Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
else
  echo "[1/4] Docker already installed: $(docker --version)"
fi

# ─── 2. Log in to ghcr.io ────────────────────────────────────────────────────
# Requires GITHUB_TOKEN env var set to a PAT with read:packages scope.
# On first run: export GITHUB_TOKEN=ghp_xxx  before calling this script.
if [ -n "${GITHUB_TOKEN:-}" ]; then
  echo "[2/4] Logging in to ghcr.io..."
  echo "$GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
else
  echo "[2/4] GITHUB_TOKEN not set — assuming already logged in to ghcr.io"
fi

# ─── 3. Get compose file + .env ──────────────────────────────────────────────
echo "[3/4] Updating files..."
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# Copy docker-compose.prod.yml here if not already present
# (or clone/scp it manually the first time)
if [ ! -f "$COMPOSE_FILE" ]; then
  echo "ERROR: $APP_DIR/$COMPOSE_FILE not found."
  echo "Copy docker-compose.prod.yml and .env to $APP_DIR first, e.g.:"
  echo "  scp -P 10159 docker-compose.prod.yml .env root@srv159.mikr.us:/opt/lwt/"
  exit 1
fi

if [ ! -f .env ]; then
  echo "ERROR: .env not found in $APP_DIR."
  echo "Copy .env.prod.example → .env and fill in your Supabase credentials."
  exit 1
fi

# ─── 4. Pull latest images & restart ─────────────────────────────────────────
echo "[4/4] Pulling images and restarting..."
REGISTRY="$REGISTRY" docker compose -f "$COMPOSE_FILE" pull
REGISTRY="$REGISTRY" docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# Clean up old dangling images to save disk space
docker image prune -f

echo ""
echo "✓ Deployed!"
echo "  → https://srv159-20159.wykr.es  (auto subdomain, works immediately)"
echo "  → https://lwt.bieda.it          (custom subdomain — configure in Mikrus panel)"
echo ""
echo "Logs: docker compose -f $COMPOSE_FILE logs -f"

