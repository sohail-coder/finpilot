#!/bin/bash
# ═══════════════════════════════════════════════════════════
# FinPilot — AWS One-Click Deploy
#
# Architecture:
#   Frontend → S3 + CloudFront (global CDN)
#   Backend  → App Runner (auto-scaling containers)
#   Database → Keep existing Supabase (or migrate later)
#   Secrets  → AWS Secrets Manager
#
# Prerequisites:
#   - AWS CLI configured (aws configure)
#   - Docker installed and running
#   - Node.js 20+ and npm
#
# Usage:
#   ./deploy-aws.sh              # Full deploy
#   ./deploy-aws.sh backend      # Backend only
#   ./deploy-aws.sh frontend     # Frontend only
#   ./deploy-aws.sh destroy      # Tear down everything
# ═══════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ─────────────────────────────────────────
APP_NAME="finpilot"
AWS_REGION="${AWS_REGION:-us-east-1}"
COMPONENT="${1:-all}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

ECR_REPO_NAME="${APP_NAME}-backend"
S3_BUCKET_NAME="${APP_NAME}-frontend-$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo 'unknown')"
APPRUNNER_SERVICE_NAME="${APP_NAME}-api"
SECRET_NAME="${APP_NAME}/prod/secrets"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
step() { echo -e "\n${BLUE}═══ $1 ═══${NC}"; }

# ── Preflight Checks ─────────────────────────────────────
preflight() {
  step "Preflight Checks"

  command -v aws >/dev/null 2>&1 || err "AWS CLI not found. Install: brew install awscli"
  command -v docker >/dev/null 2>&1 || err "Docker not found. Install Docker Desktop."
  command -v node >/dev/null 2>&1 || err "Node.js not found. Install: brew install node"

  # Verify AWS credentials
  AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null) || err "AWS credentials not configured. Run: aws configure"
  AWS_IDENTITY=$(aws sts get-caller-identity --query Arn --output text)
  log "AWS Account: $AWS_ACCOUNT"
  log "Identity: $AWS_IDENTITY"
  log "Region: $AWS_REGION"

  # Check Docker is running
  docker info >/dev/null 2>&1 || err "Docker is not running. Start Docker Desktop."
  log "Docker is running"
}

# ── Create ECR Repository ────────────────────────────────
setup_ecr() {
  step "Setting up ECR Repository"

  if aws ecr describe-repositories --repository-names "$ECR_REPO_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
    log "ECR repository already exists: $ECR_REPO_NAME"
  else
    aws ecr create-repository \
      --repository-name "$ECR_REPO_NAME" \
      --image-scanning-configuration scanOnPush=true \
      --region "$AWS_REGION" >/dev/null
    log "Created ECR repository: $ECR_REPO_NAME"
  fi

  ECR_URI=$(aws ecr describe-repositories \
    --repository-names "$ECR_REPO_NAME" \
    --region "$AWS_REGION" \
    --query 'repositories[0].repositoryUri' \
    --output text)
  log "ECR URI: $ECR_URI"
}

# ── Build & Push Docker Image ────────────────────────────
build_and_push() {
  step "Building & Pushing Backend Docker Image"

  # Login to ECR
  aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin "$AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com"
  log "Logged in to ECR"

  # Build
  cd "$BACKEND_DIR"
  IMAGE_TAG="$(date +%Y%m%d%H%M%S)"

  log "Building Docker image..."
  docker build --platform linux/amd64 -t "$ECR_URI:$IMAGE_TAG" -t "$ECR_URI:latest" .

  log "Pushing to ECR..."
  docker push "$ECR_URI:$IMAGE_TAG"
  docker push "$ECR_URI:latest"
  log "Image pushed: $ECR_URI:$IMAGE_TAG"
}

# ── Store Secrets ────────────────────────────────────────
setup_secrets() {
  step "Setting up Secrets Manager"

  # Read from backend/.env
  ENV_FILE="$BACKEND_DIR/.env"
  if [ ! -f "$ENV_FILE" ]; then
    err "Backend .env file not found at $ENV_FILE"
  fi

  # Extract values from .env
  get_env() { grep "^$1=" "$ENV_FILE" | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" ; }

  SECRET_JSON=$(cat <<EOF
{
  "DATABASE_URL": "$(get_env DATABASE_URL)",
  "JWT_SECRET": "$(get_env JWT_SECRET)",
  "OPENAI_API_KEY": "$(get_env OPENAI_API_KEY)",
  "GOOGLE_CLIENT_ID": "$(get_env GOOGLE_CLIENT_ID)",
  "GOOGLE_CLIENT_SECRET": "$(get_env GOOGLE_CLIENT_SECRET)",
  "SMTP_HOST": "$(get_env SMTP_HOST)",
  "SMTP_PORT": "$(get_env SMTP_PORT)",
  "SMTP_USER": "$(get_env SMTP_USER)",
  "SMTP_PASS": "$(get_env SMTP_PASS)",
  "SMTP_FROM": "$(get_env SMTP_FROM)"
}
EOF
  )

  if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
    aws secretsmanager put-secret-value \
      --secret-id "$SECRET_NAME" \
      --secret-string "$SECRET_JSON" \
      --region "$AWS_REGION" >/dev/null
    log "Updated existing secret: $SECRET_NAME"
  else
    aws secretsmanager create-secret \
      --name "$SECRET_NAME" \
      --description "FinPilot production secrets" \
      --secret-string "$SECRET_JSON" \
      --region "$AWS_REGION" >/dev/null
    log "Created secret: $SECRET_NAME"
  fi
}

# ── Create App Runner IAM Role ───────────────────────────
setup_apprunner_iam() {
  step "Setting up IAM Roles for App Runner"

  ROLE_NAME="${APP_NAME}-apprunner-role"
  INSTANCE_ROLE_NAME="${APP_NAME}-apprunner-instance-role"

  # ECR Access role (for pulling images)
  if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
    aws iam create-role \
      --role-name "$ROLE_NAME" \
      --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [{
          "Effect": "Allow",
          "Principal": {"Service": "build.apprunner.amazonaws.com"},
          "Action": "sts:AssumeRole"
        }]
      }' >/dev/null
    aws iam attach-role-policy \
      --role-name "$ROLE_NAME" \
      --policy-arn "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
    log "Created ECR access role: $ROLE_NAME"
    sleep 10  # Wait for IAM propagation
  else
    log "ECR access role exists: $ROLE_NAME"
  fi

  # Instance role (for Secrets Manager access)
  if ! aws iam get-role --role-name "$INSTANCE_ROLE_NAME" >/dev/null 2>&1; then
    aws iam create-role \
      --role-name "$INSTANCE_ROLE_NAME" \
      --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [{
          "Effect": "Allow",
          "Principal": {"Service": "tasks.apprunner.amazonaws.com"},
          "Action": "sts:AssumeRole"
        }]
      }' >/dev/null

    SECRET_ARN=$(aws secretsmanager describe-secret \
      --secret-id "$SECRET_NAME" \
      --region "$AWS_REGION" \
      --query 'ARN' --output text)

    aws iam put-role-policy \
      --role-name "$INSTANCE_ROLE_NAME" \
      --policy-name "${APP_NAME}-secrets-access" \
      --policy-document "{
        \"Version\": \"2012-10-17\",
        \"Statement\": [{
          \"Effect\": \"Allow\",
          \"Action\": [\"secretsmanager:GetSecretValue\"],
          \"Resource\": [\"$SECRET_ARN\"]
        }]
      }"
    log "Created instance role: $INSTANCE_ROLE_NAME"
    sleep 10
  else
    log "Instance role exists: $INSTANCE_ROLE_NAME"
  fi

  ACCESS_ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)
  INSTANCE_ROLE_ARN=$(aws iam get-role --role-name "$INSTANCE_ROLE_NAME" --query 'Role.Arn' --output text)
}

# ── Deploy App Runner ────────────────────────────────────
deploy_apprunner() {
  step "Deploying Backend to App Runner"

  # Read secrets for environment variables
  ENV_FILE="$BACKEND_DIR/.env"
  get_env() { grep "^$1=" "$ENV_FILE" | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" ; }

  # Check if service exists
  EXISTING_SERVICE=$(aws apprunner list-services \
    --region "$AWS_REGION" \
    --query "ServiceSummaryList[?ServiceName=='$APPRUNNER_SERVICE_NAME'].ServiceArn" \
    --output text 2>/dev/null)

  if [ -n "$EXISTING_SERVICE" ] && [ "$EXISTING_SERVICE" != "None" ]; then
    log "Updating existing App Runner service..."
    aws apprunner update-service \
      --service-arn "$EXISTING_SERVICE" \
      --source-configuration "{
        \"ImageRepository\": {
          \"ImageIdentifier\": \"$ECR_URI:latest\",
          \"ImageRepositoryType\": \"ECR\",
          \"ImageConfiguration\": {
            \"Port\": \"3000\",
            \"RuntimeEnvironmentVariables\": {
              \"NODE_ENV\": \"production\",
              \"PORT\": \"3000\",
              \"DATABASE_URL\": \"$(get_env DATABASE_URL)\",
              \"JWT_SECRET\": \"$(get_env JWT_SECRET)\",
              \"JWT_EXPIRES_IN\": \"15m\",
              \"JWT_REFRESH_EXPIRES_IN\": \"7d\",
              \"CORS_ORIGIN\": \"*\",
              \"LOG_LEVEL\": \"info\",
              \"OPENAI_API_KEY\": \"$(get_env OPENAI_API_KEY)\",
              \"GOOGLE_CLIENT_ID\": \"$(get_env GOOGLE_CLIENT_ID)\",
              \"SMTP_HOST\": \"$(get_env SMTP_HOST)\",
              \"SMTP_PORT\": \"$(get_env SMTP_PORT)\",
              \"SMTP_USER\": \"$(get_env SMTP_USER)\",
              \"SMTP_PASS\": \"$(get_env SMTP_PASS)\",
              \"SMTP_FROM\": \"$(get_env SMTP_FROM)\"
            }
          }
        },
        \"AuthenticationConfiguration\": {
          \"AccessRoleArn\": \"$ACCESS_ROLE_ARN\"
        }
      }" \
      --region "$AWS_REGION" >/dev/null

    APPRUNNER_ARN="$EXISTING_SERVICE"
    log "Service update triggered"
  else
    log "Creating new App Runner service..."
    APPRUNNER_ARN=$(aws apprunner create-service \
      --service-name "$APPRUNNER_SERVICE_NAME" \
      --source-configuration "{
        \"ImageRepository\": {
          \"ImageIdentifier\": \"$ECR_URI:latest\",
          \"ImageRepositoryType\": \"ECR\",
          \"ImageConfiguration\": {
            \"Port\": \"3000\",
            \"RuntimeEnvironmentVariables\": {
              \"NODE_ENV\": \"production\",
              \"PORT\": \"3000\",
              \"DATABASE_URL\": \"$(get_env DATABASE_URL)\",
              \"JWT_SECRET\": \"$(get_env JWT_SECRET)\",
              \"JWT_EXPIRES_IN\": \"15m\",
              \"JWT_REFRESH_EXPIRES_IN\": \"7d\",
              \"CORS_ORIGIN\": \"*\",
              \"LOG_LEVEL\": \"info\",
              \"OPENAI_API_KEY\": \"$(get_env OPENAI_API_KEY)\",
              \"GOOGLE_CLIENT_ID\": \"$(get_env GOOGLE_CLIENT_ID)\",
              \"SMTP_HOST\": \"$(get_env SMTP_HOST)\",
              \"SMTP_PORT\": \"$(get_env SMTP_PORT)\",
              \"SMTP_USER\": \"$(get_env SMTP_USER)\",
              \"SMTP_PASS\": \"$(get_env SMTP_PASS)\",
              \"SMTP_FROM\": \"$(get_env SMTP_FROM)\"
            }
          }
        },
        \"AuthenticationConfiguration\": {
          \"AccessRoleArn\": \"$ACCESS_ROLE_ARN\"
        }
      }" \
      --instance-configuration "{
        \"Cpu\": \"0.25 vCPU\",
        \"Memory\": \"0.5 GB\",
        \"InstanceRoleArn\": \"$INSTANCE_ROLE_ARN\"
      }" \
      --health-check-configuration "{
        \"Protocol\": \"HTTP\",
        \"Path\": \"/health\",
        \"Interval\": 10,
        \"Timeout\": 5,
        \"HealthyThreshold\": 1,
        \"UnhealthyThreshold\": 5
      }" \
      --auto-scaling-configuration-arn "$(setup_autoscaling)" \
      --region "$AWS_REGION" \
      --query 'Service.ServiceArn' \
      --output text)

    log "Service created: $APPRUNNER_ARN"
  fi

  # Wait for service to be running
  log "Waiting for App Runner service to become active (this takes 3-5 minutes)..."
  while true; do
    STATUS=$(aws apprunner describe-service \
      --service-arn "$APPRUNNER_ARN" \
      --region "$AWS_REGION" \
      --query 'Service.Status' \
      --output text 2>/dev/null)

    if [ "$STATUS" = "RUNNING" ]; then
      break
    elif [ "$STATUS" = "CREATE_FAILED" ] || [ "$STATUS" = "UPDATE_FAILED" ]; then
      err "App Runner service failed. Check AWS Console for details."
    fi
    echo -n "."
    sleep 15
  done
  echo ""

  BACKEND_URL=$(aws apprunner describe-service \
    --service-arn "$APPRUNNER_ARN" \
    --region "$AWS_REGION" \
    --query 'Service.ServiceUrl' \
    --output text)

  log "Backend is live at: https://$BACKEND_URL"

  # Update CORS to allow the CloudFront URL later
  echo "$BACKEND_URL" > "$ROOT_DIR/.backend-url"
}

# ── Auto Scaling Config ──────────────────────────────────
setup_autoscaling() {
  local CONFIG_NAME="${APP_NAME}-autoscaling"
  local EXISTING=$(aws apprunner list-auto-scaling-configurations \
    --region "$AWS_REGION" \
    --query "AutoScalingConfigurationSummaryList[?AutoScalingConfigurationName=='$CONFIG_NAME'].AutoScalingConfigurationArn | [0]" \
    --output text 2>/dev/null)

  if [ -n "$EXISTING" ] && [ "$EXISTING" != "None" ]; then
    echo "$EXISTING"
    return
  fi

  aws apprunner create-auto-scaling-configuration \
    --auto-scaling-configuration-name "$CONFIG_NAME" \
    --max-concurrency 100 \
    --min-size 1 \
    --max-size 5 \
    --region "$AWS_REGION" \
    --query 'AutoScalingConfiguration.AutoScalingConfigurationArn' \
    --output text
}

# ── Deploy Frontend to S3 + CloudFront ───────────────────
deploy_frontend() {
  step "Deploying Frontend to S3 + CloudFront"

  BACKEND_URL=""
  if [ -f "$ROOT_DIR/.backend-url" ]; then
    BACKEND_URL=$(cat "$ROOT_DIR/.backend-url")
  fi

  # Create S3 bucket
  if ! aws s3api head-bucket --bucket "$S3_BUCKET_NAME" 2>/dev/null; then
    if [ "$AWS_REGION" = "us-east-1" ]; then
      aws s3api create-bucket --bucket "$S3_BUCKET_NAME" --region "$AWS_REGION" >/dev/null
    else
      aws s3api create-bucket --bucket "$S3_BUCKET_NAME" --region "$AWS_REGION" \
        --create-bucket-configuration LocationConstraint="$AWS_REGION" >/dev/null
    fi
    log "Created S3 bucket: $S3_BUCKET_NAME"
  else
    log "S3 bucket exists: $S3_BUCKET_NAME"
  fi

  # Block all public access
  aws s3api put-public-access-block \
    --bucket "$S3_BUCKET_NAME" \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" >/dev/null
  log "S3 bucket public access blocked"

  # Build frontend
  cd "$FRONTEND_DIR"
  log "Installing dependencies..."
  npm ci --silent

  log "Building frontend..."
  VITE_API_URL="https://$BACKEND_URL" npm run build
  log "Frontend built successfully"

  # Upload to S3
  log "Uploading to S3..."
  aws s3 sync dist/ "s3://$S3_BUCKET_NAME" \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "index.html" \
    --exclude "*.json" \
    --region "$AWS_REGION" >/dev/null

  aws s3 cp dist/index.html "s3://$S3_BUCKET_NAME/index.html" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --region "$AWS_REGION" >/dev/null

  log "Files uploaded to S3"

  # Setup CloudFront
  setup_cloudfront
}

# ── CloudFront Distribution ──────────────────────────────
setup_cloudfront() {
  step "Setting up CloudFront CDN"

  CF_DIST_ID=""

  # Check for existing distribution
  EXISTING_DIST=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?Comment=='FinPilot Frontend'].Id | [0]" \
    --output text 2>/dev/null)

  if [ -n "$EXISTING_DIST" ] && [ "$EXISTING_DIST" != "None" ]; then
    CF_DIST_ID="$EXISTING_DIST"
    log "CloudFront distribution exists: $CF_DIST_ID"

    # Invalidate cache
    aws cloudfront create-invalidation \
      --distribution-id "$CF_DIST_ID" \
      --paths "/*" >/dev/null
    log "Cache invalidation triggered"
  else
    # Create or find Origin Access Control
    OAC_ID=$(aws cloudfront list-origin-access-controls \
      --query "OriginAccessControlList.Items[?Name=='${APP_NAME}-s3-oac'].Id | [0]" \
      --output text 2>/dev/null)

    if [ -z "$OAC_ID" ] || [ "$OAC_ID" = "None" ]; then
      OAC_ID=$(aws cloudfront create-origin-access-control \
        --origin-access-control-config "{
          \"Name\": \"${APP_NAME}-s3-oac\",
          \"Description\": \"OAC for FinPilot S3\",
          \"SigningProtocol\": \"sigv4\",
          \"SigningBehavior\": \"always\",
          \"OriginAccessControlOriginType\": \"s3\"
        }" \
        --query 'OriginAccessControl.Id' \
        --output text \
        --region "$AWS_REGION")
      log "Created OAC: $OAC_ID"
    else
      log "OAC already exists: $OAC_ID"
    fi

    S3_DOMAIN="${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com"

    # Create distribution
    CF_DIST_ID=$(aws cloudfront create-distribution \
      --distribution-config "{
        \"CallerReference\": \"${APP_NAME}-$(date +%s)\",
        \"Comment\": \"FinPilot Frontend\",
        \"Enabled\": true,
        \"DefaultRootObject\": \"index.html\",
        \"PriceClass\": \"PriceClass_100\",
        \"Origins\": {
          \"Quantity\": 1,
          \"Items\": [{
            \"Id\": \"s3-origin\",
            \"DomainName\": \"$S3_DOMAIN\",
            \"OriginAccessControlId\": \"$OAC_ID\",
            \"S3OriginConfig\": {\"OriginAccessIdentity\": \"\"}
          }]
        },
        \"DefaultCacheBehavior\": {
          \"TargetOriginId\": \"s3-origin\",
          \"ViewerProtocolPolicy\": \"redirect-to-https\",
          \"AllowedMethods\": {\"Quantity\": 2, \"Items\": [\"GET\", \"HEAD\"], \"CachedMethods\": {\"Quantity\": 2, \"Items\": [\"GET\", \"HEAD\"]}},
          \"ForwardedValues\": {
            \"QueryString\": false,
            \"Cookies\": {\"Forward\": \"none\"}
          },
          \"Compress\": true,
          \"MinTTL\": 0,
          \"DefaultTTL\": 86400,
          \"MaxTTL\": 31536000
        },
        \"CustomErrorResponses\": {
          \"Quantity\": 2,
          \"Items\": [
            {\"ErrorCode\": 403, \"ResponseCode\": \"200\", \"ResponsePagePath\": \"/index.html\", \"ErrorCachingMinTTL\": 0},
            {\"ErrorCode\": 404, \"ResponseCode\": \"200\", \"ResponsePagePath\": \"/index.html\", \"ErrorCachingMinTTL\": 0}
          ]
        },
        \"ViewerCertificate\": {
          \"CloudFrontDefaultCertificate\": true
        },
        \"Restrictions\": {
          \"GeoRestriction\": {\"RestrictionType\": \"none\", \"Quantity\": 0}
        }
      }" \
      --query 'Distribution.Id' \
      --output text)

    log "Created CloudFront distribution: $CF_DIST_ID"

    # Add S3 bucket policy for CloudFront OAC
    CF_DIST_ARN=$(aws cloudfront get-distribution \
      --id "$CF_DIST_ID" \
      --query 'Distribution.ARN' \
      --output text)

    aws s3api put-bucket-policy \
      --bucket "$S3_BUCKET_NAME" \
      --policy "{
        \"Version\": \"2012-10-17\",
        \"Statement\": [{
          \"Sid\": \"AllowCloudFrontOAC\",
          \"Effect\": \"Allow\",
          \"Principal\": {\"Service\": \"cloudfront.amazonaws.com\"},
          \"Action\": \"s3:GetObject\",
          \"Resource\": \"arn:aws:s3:::${S3_BUCKET_NAME}/*\",
          \"Condition\": {
            \"StringEquals\": {
              \"AWS:SourceArn\": \"$CF_DIST_ARN\"
            }
          }
        }]
      }" >/dev/null
    log "S3 bucket policy configured for CloudFront"
  fi

  CF_DOMAIN=$(aws cloudfront get-distribution \
    --id "$CF_DIST_ID" \
    --query 'Distribution.DomainName' \
    --output text)

  echo "$CF_DIST_ID" > "$ROOT_DIR/.cloudfront-id"
  echo "$CF_DOMAIN" > "$ROOT_DIR/.cloudfront-domain"
  log "CloudFront domain: https://$CF_DOMAIN"
}

# ── Update Backend CORS ──────────────────────────────────
update_cors() {
  step "Updating Backend CORS"

  if [ ! -f "$ROOT_DIR/.cloudfront-domain" ] || [ ! -f "$ROOT_DIR/.backend-url" ]; then
    warn "Skipping CORS update — deploy both backend and frontend first"
    return
  fi

  CF_DOMAIN=$(cat "$ROOT_DIR/.cloudfront-domain")
  BACKEND_URL=$(cat "$ROOT_DIR/.backend-url")

  APPRUNNER_ARN=$(aws apprunner list-services \
    --region "$AWS_REGION" \
    --query "ServiceSummaryList[?ServiceName=='$APPRUNNER_SERVICE_NAME'].ServiceArn | [0]" \
    --output text)

  ENV_FILE="$BACKEND_DIR/.env"
  get_env() { grep "^$1=" "$ENV_FILE" | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" ; }

  log "Setting CORS_ORIGIN to https://$CF_DOMAIN"
  aws apprunner update-service \
    --service-arn "$APPRUNNER_ARN" \
    --source-configuration "{
      \"ImageRepository\": {
        \"ImageIdentifier\": \"$ECR_URI:latest\",
        \"ImageRepositoryType\": \"ECR\",
        \"ImageConfiguration\": {
          \"Port\": \"3000\",
          \"RuntimeEnvironmentVariables\": {
            \"NODE_ENV\": \"production\",
            \"PORT\": \"3000\",
            \"DATABASE_URL\": \"$(get_env DATABASE_URL)\",
            \"JWT_SECRET\": \"$(get_env JWT_SECRET)\",
            \"JWT_EXPIRES_IN\": \"15m\",
            \"JWT_REFRESH_EXPIRES_IN\": \"7d\",
            \"CORS_ORIGIN\": \"https://$CF_DOMAIN\",
            \"APP_URL\": \"https://$CF_DOMAIN\",
            \"LOG_LEVEL\": \"info\",
            \"OPENAI_API_KEY\": \"$(get_env OPENAI_API_KEY)\",
            \"GOOGLE_CLIENT_ID\": \"$(get_env GOOGLE_CLIENT_ID)\",
            \"SMTP_HOST\": \"$(get_env SMTP_HOST)\",
            \"SMTP_PORT\": \"$(get_env SMTP_PORT)\",
            \"SMTP_USER\": \"$(get_env SMTP_USER)\",
            \"SMTP_PASS\": \"$(get_env SMTP_PASS)\",
            \"SMTP_FROM\": \"$(get_env SMTP_FROM)\"
          }
        }
      },
      \"AuthenticationConfiguration\": {
        \"AccessRoleArn\": \"$ACCESS_ROLE_ARN\"
      }
    }" \
    --region "$AWS_REGION" >/dev/null
  log "CORS updated to https://$CF_DOMAIN"
}

# ── Setup Budget Alert ───────────────────────────────────
setup_budget() {
  step "Setting up AWS Budget Alert"

  BUDGET_EXISTS=$(aws budgets describe-budgets \
    --account-id "$AWS_ACCOUNT" \
    --query "Budgets[?BudgetName=='${APP_NAME}-monthly'].BudgetName | [0]" \
    --output text 2>/dev/null || echo "None")

  if [ "$BUDGET_EXISTS" = "None" ] || [ -z "$BUDGET_EXISTS" ]; then
    aws budgets create-budget \
      --account-id "$AWS_ACCOUNT" \
      --budget "{
        \"BudgetName\": \"${APP_NAME}-monthly\",
        \"BudgetType\": \"COST\",
        \"TimeUnit\": \"MONTHLY\",
        \"BudgetLimit\": {
          \"Amount\": \"50\",
          \"Unit\": \"USD\"
        }
      }" \
      --notifications-with-subscribers "[
        {
          \"Notification\": {
            \"NotificationType\": \"ACTUAL\",
            \"ComparisonOperator\": \"GREATER_THAN\",
            \"Threshold\": 80,
            \"ThresholdType\": \"PERCENTAGE\"
          },
          \"Subscribers\": [{
            \"SubscriptionType\": \"EMAIL\",
            \"Address\": \"$(grep '^SMTP_USER=' "$BACKEND_DIR/.env" | head -1 | cut -d'=' -f2- | tr -d '"')\"
          }]
        },
        {
          \"Notification\": {
            \"NotificationType\": \"FORECASTED\",
            \"ComparisonOperator\": \"GREATER_THAN\",
            \"Threshold\": 100,
            \"ThresholdType\": \"PERCENTAGE\"
          },
          \"Subscribers\": [{
            \"SubscriptionType\": \"EMAIL\",
            \"Address\": \"$(grep '^SMTP_USER=' "$BACKEND_DIR/.env" | head -1 | cut -d'=' -f2- | tr -d '"')\"
          }]
        }
      ]" 2>/dev/null && log "Budget alert created: \$50/month limit" || warn "Budget alert may already exist"
  else
    log "Budget alert already exists"
  fi
}

# ── Print Summary ────────────────────────────────────────
print_summary() {
  step "Deployment Complete!"

  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║           FinPilot Deployment Summary                ║${NC}"
  echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"

  if [ -f "$ROOT_DIR/.cloudfront-domain" ]; then
    CF_DOMAIN=$(cat "$ROOT_DIR/.cloudfront-domain")
    echo -e "${GREEN}║${NC}  Frontend:  ${BLUE}https://$CF_DOMAIN${NC}"
  fi

  if [ -f "$ROOT_DIR/.backend-url" ]; then
    BACKEND_URL=$(cat "$ROOT_DIR/.backend-url")
    echo -e "${GREEN}║${NC}  Backend:   ${BLUE}https://$BACKEND_URL${NC}"
    echo -e "${GREEN}║${NC}  Health:    ${BLUE}https://$BACKEND_URL/health${NC}"
  fi

  echo -e "${GREEN}║${NC}  Region:    $AWS_REGION"
  echo -e "${GREEN}║${NC}  Budget:    \$50/month alert"
  echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}║${NC}  ${YELLOW}Note: CloudFront may take 5-15 min to propagate${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
  echo ""

  if [ -f "$ROOT_DIR/.backend-url" ]; then
    warn "Update Google OAuth redirect URI to: https://$CF_DOMAIN"
    warn "Update Google OAuth JS origin to: https://$CF_DOMAIN"
  fi
}

# ── Destroy ──────────────────────────────────────────────
destroy() {
  step "Tearing Down AWS Resources"

  read -p "Are you sure you want to destroy all FinPilot AWS resources? (y/N) " confirm
  [ "$confirm" = "y" ] || [ "$confirm" = "Y" ] || { echo "Cancelled."; exit 0; }

  # Delete App Runner
  APPRUNNER_ARN=$(aws apprunner list-services \
    --region "$AWS_REGION" \
    --query "ServiceSummaryList[?ServiceName=='$APPRUNNER_SERVICE_NAME'].ServiceArn | [0]" \
    --output text 2>/dev/null)
  if [ -n "$APPRUNNER_ARN" ] && [ "$APPRUNNER_ARN" != "None" ]; then
    aws apprunner delete-service --service-arn "$APPRUNNER_ARN" --region "$AWS_REGION" >/dev/null 2>&1 || true
    log "App Runner service deletion initiated"
  fi

  # Delete CloudFront
  if [ -f "$ROOT_DIR/.cloudfront-id" ]; then
    CF_DIST_ID=$(cat "$ROOT_DIR/.cloudfront-id")
    warn "CloudFront distribution $CF_DIST_ID must be disabled before deletion."
    warn "Disable it in the AWS Console, then delete manually."
  fi

  # Empty and delete S3
  aws s3 rm "s3://$S3_BUCKET_NAME" --recursive 2>/dev/null || true
  aws s3api delete-bucket --bucket "$S3_BUCKET_NAME" --region "$AWS_REGION" 2>/dev/null || true
  log "S3 bucket deleted"

  # Delete ECR
  aws ecr delete-repository --repository-name "$ECR_REPO_NAME" --force --region "$AWS_REGION" 2>/dev/null || true
  log "ECR repository deleted"

  # Delete secrets
  aws secretsmanager delete-secret --secret-id "$SECRET_NAME" --force-delete-without-recovery --region "$AWS_REGION" 2>/dev/null || true
  log "Secrets deleted"

  # Clean temp files
  rm -f "$ROOT_DIR/.backend-url" "$ROOT_DIR/.cloudfront-id" "$ROOT_DIR/.cloudfront-domain"

  log "Teardown complete"
}

# ── Main ─────────────────────────────────────────────────
case "$COMPONENT" in
  backend)
    preflight
    setup_ecr
    build_and_push
    setup_secrets
    setup_apprunner_iam
    deploy_apprunner
    ;;
  frontend)
    preflight
    setup_ecr
    ECR_URI=$(aws ecr describe-repositories --repository-names "$ECR_REPO_NAME" --region "$AWS_REGION" --query 'repositories[0].repositoryUri' --output text)
    deploy_frontend
    ;;
  destroy)
    preflight
    destroy
    ;;
  all|*)
    preflight
    setup_ecr
    build_and_push
    setup_secrets
    setup_apprunner_iam
    deploy_apprunner
    deploy_frontend
    update_cors
    setup_budget
    print_summary
    ;;
esac
