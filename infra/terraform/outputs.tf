# ──────────────────────────────────────────────────────
# Outputs
# ──────────────────────────────────────────────────────

output "cloudfront_url" {
  description = "CloudFront distribution URL (frontend)"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "alb_url" {
  description = "ALB DNS name (backend API)"
  value       = "http://${aws_lb.main.dns_name}"
}

output "ecr_repository_url" {
  description = "ECR repository URL for backend Docker images"
  value       = aws_ecr_repository.backend.repository_url
}

output "s3_bucket_name" {
  description = "S3 bucket name for frontend assets"
  value       = aws_s3_bucket.frontend.id
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (for cache invalidation)"
  value       = aws_cloudfront_distribution.frontend.id
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.backend.name
}

output "rds_endpoint" {
  description = "RDS Aurora cluster endpoint"
  value       = aws_rds_cluster.main.endpoint
  sensitive   = true
}

output "cloudwatch_dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${var.app_name}-${var.environment}"
}

output "sns_alerts_topic_arn" {
  description = "SNS topic ARN for alerts (subscribe your email)"
  value       = aws_sns_topic.alerts.arn
}
