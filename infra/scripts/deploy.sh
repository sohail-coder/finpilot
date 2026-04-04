#!/bin/bash
# ──────────────────────────────────────────────────────
# Quick deploy script for manual deployments
# Usage: ./deploy.sh [backend|frontend|all]
# ──────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
AWS_REGION="${AWS_REGION:-us-east-1}"
COMPONENT="${1:-all}"

# Load Terraform outputs
cd "$ROOT_DIR/infra/terraform"
ECR_REPO=$(terraform output -raw ecr_repository_url 2>/dev/null || echo "")
S3_BUCKET=$(terraform output -raw s3_bucket_name 2>/dev/null || echo "")
CF_DIST_ID=$(terraform output -raw cloudfront_distribution_id 2>/dev/null || echo "")
ECS_CLUSTER=$(terraform output -raw ecs_cluster_name 2>/dev/null || echo "")
ECS_SERVICE=$(terraform output -raw ecs_service_name 2>/dev/null || echo "")

if [ -z "$ECR_REPO" ]; then
  echo "ERROR: Could not read Terraform outputs. Run 'terraform apply' first."
  exit 1
fi

deploy_backend() {
  echo "═══ Deploying Backend ═══"
  cd "$ROOT_DIR/backend"

  # Login to ECR
  aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REPO"

  # Build & push
  IMAGE_TAG="$(git rev-parse --short HEAD 2>/dev/null || echo 'latest')"
  docker build -t "$ECR_REPO:$IMAGE_TAG" -t "$ECR_REPO:latest" .
  docker push "$ECR_REPO:$IMAGE_TAG"
  docker push "$ECR_REPO:latest"

  # Force new deployment
  aws ecs update-service \
    --cluster "$ECS_CLUSTER" \
    --service "$ECS_SERVICE" \
    --force-new-deployment \
    --region "$AWS_REGION" > /dev/null

  echo "Backend deployment triggered. Waiting for stability..."
  aws ecs wait services-stable --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE" --region "$AWS_REGION"
  echo "Backend deployed successfully!"
}

deploy_frontend() {
  echo "═══ Deploying Frontend ═══"
  cd "$ROOT_DIR/frontend"

  npm ci
  npm run build

  # Sync to S3
  aws s3 sync dist/ "s3://$S3_BUCKET" \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "index.html" \
    --exclude "*.json"

  aws s3 cp dist/index.html "s3://$S3_BUCKET/index.html" \
    --cache-control "no-cache, no-store, must-revalidate"

  # Invalidate CloudFront
  aws cloudfront create-invalidation \
    --distribution-id "$CF_DIST_ID" \
    --paths "/*" > /dev/null

  echo "Frontend deployed successfully!"
}

case "$COMPONENT" in
  backend)  deploy_backend ;;
  frontend) deploy_frontend ;;
  all)      deploy_backend && deploy_frontend ;;
  *)        echo "Usage: $0 [backend|frontend|all]"; exit 1 ;;
esac
