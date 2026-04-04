# ──────────────────────────────────────────────────────────────
# FinPilot — AWS Infrastructure (Terraform)
#
# Architecture:
#   Frontend → CloudFront → S3 (static SPA)
#   Backend  → ALB → ECS Fargate (containerized API)
#   Database → RDS PostgreSQL (private subnet)
#   Secrets  → AWS Secrets Manager
#   Logs     → CloudWatch
#   DNS      → Route 53 (optional)
# ──────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment and configure for remote state
  # backend "s3" {
  #   bucket         = "finpilot-terraform-state"
  #   key            = "prod/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "finpilot-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "finpilot"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
