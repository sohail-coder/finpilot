# FinPilot — AWS Deployment Guide

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────────┐
│   Browser   │────▶│   CloudFront     │────▶│  S3 (Frontend SPA)      │
│             │     │   Distribution   │     └─────────────────────────┘
└─────────────┘     │                  │
                    │  /api/* ─────────│────▶┌─────────────────────────┐
                    └──────────────────┘     │  Application Load       │
                                            │  Balancer (ALB)         │
                                            └──────────┬──────────────┘
                                                       │
                                            ┌──────────▼──────────────┐
                                            │  ECS Fargate            │
                                            │  (Backend API ×2)       │
                                            │  Auto-scaling 2→10      │
                                            └──────────┬──────────────┘
                                                       │
                                            ┌──────────▼──────────────┐
                                            │  Aurora PostgreSQL      │
                                            │  Serverless v2          │
                                            │  (0.5→4 ACU)            │
                                            └─────────────────────────┘
```

### AWS Services Used

| Service | Purpose |
|---------|---------|
| **CloudFront** | CDN, HTTPS termination, SPA routing, API proxy |
| **S3** | Static frontend hosting (React build) |
| **ECS Fargate** | Serverless container orchestration (backend) |
| **ECR** | Docker image registry |
| **ALB** | Load balancer with health checks |
| **Aurora PostgreSQL Serverless v2** | Auto-scaling database |
| **Secrets Manager** | Secure storage for API keys, DB credentials |
| **CloudWatch** | Logs, metrics, dashboards, alarms |
| **SNS** | Alert notifications |
| **VPC** | Network isolation (public/private subnets) |
| **NAT Gateway** | Outbound internet for private subnets |
| **Auto Scaling** | CPU, memory, and request-based scaling |

---

## Prerequisites

1. **AWS CLI** configured with admin credentials:
   ```bash
   aws configure
   ```

2. **Terraform** >= 1.5:
   ```bash
   brew install terraform
   ```

3. **Docker** installed and running

4. **Node.js** 20+ and npm

---

## Step-by-Step Deployment

### 1. Bootstrap Terraform State

```bash
cd infra/scripts
./bootstrap-state.sh us-east-1
```

Then uncomment the `backend "s3"` block in `infra/terraform/main.tf`.

### 2. Configure Variables

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your values:
- **db_password** — use a strong random password
- **jwt_secret** — min 32 char random string
- **openai_api_key** — your OpenAI key
- **google_client_id** — from Google Cloud Console
- **smtp_*** — email config (optional)

### 3. Deploy Infrastructure

```bash
cd infra/terraform

terraform init
terraform plan -out=plan.tfplan
terraform apply plan.tfplan
```

This creates: VPC, subnets, ALB, ECS cluster, Aurora DB, S3 bucket, CloudFront, monitoring.

Note the outputs — you'll need `ecr_repository_url`, `s3_bucket_name`, and `cloudfront_distribution_id`.

### 4. Push Backend Docker Image

```bash
# Login to ECR
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

# Build and push
cd backend
docker build -t finpilot-backend .
docker tag finpilot-backend:latest $AWS_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/finpilot-backend:latest
docker push $AWS_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/finpilot-backend:latest

# Force ECS to pick up the new image
aws ecs update-service --cluster finpilot-prod --service finpilot-backend --force-new-deployment
```

### 5. Deploy Frontend

```bash
cd frontend
npm ci && npm run build

# Get values from Terraform
S3_BUCKET=$(cd ../infra/terraform && terraform output -raw s3_bucket_name)
CF_DIST_ID=$(cd ../infra/terraform && terraform output -raw cloudfront_distribution_id)

# Upload to S3
aws s3 sync dist/ s3://$S3_BUCKET --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html" --exclude "*.json"

aws s3 cp dist/index.html s3://$S3_BUCKET/index.html \
  --cache-control "no-cache, no-store, must-revalidate"

# Invalidate CDN cache
aws cloudfront create-invalidation --distribution-id $CF_DIST_ID --paths "/*"
```

### 6. Subscribe to Alerts

```bash
TOPIC_ARN=$(cd infra/terraform && terraform output -raw sns_alerts_topic_arn)
aws sns subscribe --topic-arn $TOPIC_ARN --protocol email --notification-endpoint your-email@example.com
```

Check your email and confirm the subscription.

---

## CI/CD (GitHub Actions)

### Required GitHub Secrets

| Secret | Value |
|--------|-------|
| `AWS_ROLE_ARN` | IAM role ARN for OIDC (GitHub → AWS) |
| `S3_BUCKET_NAME` | Terraform output: `s3_bucket_name` |
| `CLOUDFRONT_DISTRIBUTION_ID` | Terraform output: `cloudfront_distribution_id` |

### Setting up OIDC for GitHub Actions

```bash
# Create the OIDC provider (one-time)
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

Create an IAM role with trust policy for your repo and attach permissions for ECR, ECS, S3, CloudFront.

### Workflow Triggers

- **Push to `main`** → Full deploy (backend + frontend)
- **Pull request to `main`** → Lint + test only (no deploy)

---

## Quick Deploy Script

For manual deployments after initial setup:

```bash
# Deploy everything
./infra/scripts/deploy.sh all

# Deploy only backend
./infra/scripts/deploy.sh backend

# Deploy only frontend
./infra/scripts/deploy.sh frontend
```

---

## Monitoring & Observability

### CloudWatch Dashboard

Access at: `https://us-east-1.console.aws.amazon.com/cloudwatch/home#dashboards:name=finpilot-prod`

Tracks:
- ECS CPU & memory utilization
- ALB request count & latency
- HTTP 4xx/5xx error rates
- RDS CPU & connection count
- Aurora Serverless capacity

### Alarms (auto-configured)

| Alarm | Trigger |
|-------|---------|
| ECS CPU High | > 85% for 3 min |
| ECS Memory High | > 85% for 3 min |
| ALB 5xx Errors | > 10 in 5 min |
| ALB High Latency | > 2s avg for 3 min |
| RDS CPU High | > 80% for 3 min |

### Logs

```bash
# Tail backend logs
aws logs tail /ecs/finpilot-backend --follow --region us-east-1
```

---

## Scaling

### Auto Scaling (pre-configured)

| Metric | Target | Min → Max |
|--------|--------|-----------|
| CPU | 70% | 2 → 10 tasks |
| Memory | 80% | 2 → 10 tasks |
| ALB Requests | 1000/target | 2 → 10 tasks |

### Database Scaling

Aurora Serverless v2 automatically scales between 0.5 and 4 ACUs based on load.

### Manual scaling

```bash
# Scale to 4 tasks immediately
aws ecs update-service --cluster finpilot-prod --service finpilot-backend --desired-count 4
```

---

## Cost Estimation (us-east-1)

| Resource | Monthly Cost (approx) |
|----------|----------------------|
| ECS Fargate (2 × 0.25vCPU, 512MB) | ~$15 |
| ALB | ~$20 |
| Aurora Serverless v2 (0.5 ACU min) | ~$45 |
| CloudFront (10GB transfer) | ~$1 |
| S3 (< 1GB) | ~$0.02 |
| NAT Gateway | ~$35 |
| Secrets Manager (8 secrets) | ~$3 |
| CloudWatch | ~$5 |
| **Total** | **~$125/mo** |

> **Cost optimization tip**: For dev/staging, set `backend_desired_count = 1` and use a single Aurora instance to cut costs to ~$70/mo.

---

## Security Checklist

- [x] VPC with public/private subnet isolation
- [x] RDS in private subnets only (no public access)
- [x] ECS tasks in private subnets (outbound via NAT)
- [x] Security groups with least-privilege rules
- [x] Secrets stored in AWS Secrets Manager
- [x] S3 bucket fully private (OAC only)
- [x] CloudFront HTTPS redirect
- [x] Container runs as non-root user
- [x] ECR image scanning on push
- [x] Database encryption at rest
- [x] Automated backups (7-day retention)
- [x] Deployment circuit breaker with rollback
- [x] Security headers via nginx (X-Frame-Options, CSP, etc.)

---

## Troubleshooting

### Backend not starting
```bash
# Check ECS task logs
aws logs tail /ecs/finpilot-backend --since 30m --region us-east-1

# Check task status
aws ecs describe-services --cluster finpilot-prod --services finpilot-backend --query 'services[0].events[:5]'
```

### Database connectivity
```bash
# Verify RDS is accessible from ECS security group
aws rds describe-db-clusters --db-cluster-identifier finpilot-prod --query 'DBClusters[0].Endpoint'
```

### CloudFront not updating
```bash
# Force invalidation
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

---

## Extending the Infrastructure

The Terraform codebase is modular and ready to extend:

- **Custom domain**: Set `domain_name` variable, add ACM certificate + Route 53
- **WAF**: Add AWS WAF to CloudFront for rate limiting and bot protection
- **Redis/ElastiCache**: For session caching or rate limiting
- **SQS**: For async job processing (email, PDF generation)
- **Lambda**: For scheduled tasks (replace node-cron)
- **Multi-region**: Duplicate with different `aws_region` variable
