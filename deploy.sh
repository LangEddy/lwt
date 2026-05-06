#!/usr/bin/env bash
# deploy.sh — Run on the VPS (srv159) to deploy LWT
# Images are built by GitHub Actions and pushed to ghcr.io — no building here.
# Usage: bash deploy.sh
set -euo pipefail

APP_DIR="/opt/lwt"
COMPOSE_FILE="docker-compose.prod.yml"

# ─── 1. Install Docker (skip if already installed) ───────────────────────────
if ! command -v docker &>/dev/null; then
  echo "[1/4] Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
else
  echo "[1/4] Docker already installed: $(docker --version)"
fi

# ─── 2. Log in to ghcr.io ────────────────────────────────────────────────────
# Requires GITHUB_TOKEN env var (PAT with read:packages) on first run,
# or make the packages public in GitHub settings (then no token needed).
if [ -n "${GITHUB_TOKEN:-}" ]; then
  GITHUB_USER_VAR=$(grep '^GITHUB_USER=' "$APP_DIR/.env" | cut -d= -f2)
  echo "[2/4] Logging in to ghcr.io as ${GITHUB_USER_VAR}..."
  echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_USER_VAR" --password-stdin
else
  echo "[2/4] GITHUB_TOKEN not set — assuming ghcr.io packages are public or already logged in"
fi

# ─── 3. Check required files ─────────────────────────────────────────────────
echo "[3/4] Checking files in $APP_DIR..."
mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "ERROR: $APP_DIR/$COMPOSE_FILE not found."
  echo "Copy it to the VPS first:"
  echo "  scp -P 10159 docker-compose.prod.yml root@srv159.mikr.us:/opt/lwt/"
  exit 1
fi

if [ ! -f .env ]; then
  echo "ERROR: .env not found in $APP_DIR."
  echo "Copy .env.prod.example → .env, fill in credentials, and scp it:"
  echo "  scp -P 10159 .env root@srv159.mikr.us:/opt/lwt/"
  exit 1
fi

# ─── 4. Pull latest images & restart ─────────────────────────────────────────
echo "[4/4] Pulling images and restarting..."
docker compose -f "$COMPOSE_FILE" pull
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# Clean up dangling images to save disk space
docker image prune -f

echo ""
echo "✓ Deployed!"
echo "  → https://srv159-20159.wykr.es  (auto subdomain, works immediately)"
echo "  → https://lwt.bieda.it          (custom subdomain — configure in Mikrus panel)"
echo ""
echo "Logs: docker compose -f $COMPOSE_FILE logs -f"

