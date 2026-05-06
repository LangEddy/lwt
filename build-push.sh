#!/usr/bin/env bash
# build-push.sh — Build production images locally and push to ghcr.io
# Run this on your local machine before deploying to the VPS.
#
# Prerequisites:
#   echo $CR_PAT | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
#   (CR_PAT = GitHub personal access token with write:packages scope)
#
# Usage:
#   bash build-push.sh              # builds and pushes with tag "latest"
#   bash build-push.sh v1.2.3       # builds and pushes with a version tag too
set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────────
REGISTRY="ghcr.io/YOUR_GITHUB_USER"
TAG="${1:-latest}"

# Load prod env vars (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)
if [ ! -f .env.prod ]; then
  echo "ERROR: .env.prod not found. Copy .env.prod.example → .env.prod and fill it in."
  exit 1
fi
set -a; source .env.prod; set +a

# ─── Backend ─────────────────────────────────────────────────────────────────
echo "→ Building backend..."
docker build \
  --platform linux/amd64 \
  -t "$REGISTRY/lwt-backend:$TAG" \
  -f backend/Dockerfile \
  ./backend

# ─── Frontend (Supabase vars baked in at build time) ─────────────────────────
echo "→ Building frontend..."
docker build \
  --platform linux/amd64 \
  -t "$REGISTRY/lwt-frontend:$TAG" \
  --build-arg "VITE_SUPABASE_URL=$VITE_SUPABASE_URL" \
  --build-arg "VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY" \
  --build-arg "VITE_API_URL=" \
  -f frontend/Dockerfile \
  .

# ─── Push ────────────────────────────────────────────────────────────────────
echo "→ Pushing images..."
docker push "$REGISTRY/lwt-backend:$TAG"
docker push "$REGISTRY/lwt-frontend:$TAG"

echo ""
echo "✓ Images pushed:"
echo "  $REGISTRY/lwt-backend:$TAG"
echo "  $REGISTRY/lwt-frontend:$TAG"
echo ""
echo "Deploy on VPS:  bash deploy.sh"
