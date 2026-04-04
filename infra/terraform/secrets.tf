# ──────────────────────────────────────────────────────
# AWS Secrets Manager — Application secrets
# ──────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "${var.app_name}/${var.environment}/app-secrets"
  description             = "FinPilot application secrets"
  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = { Name = "${var.app_name}-secrets" }
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    DATABASE_URL     = "postgresql://${var.db_username}:${var.db_password}@${aws_rds_cluster.main.endpoint}:5432/${var.db_name}?schema=public"
    JWT_SECRET       = var.jwt_secret
    OPENAI_API_KEY   = var.openai_api_key
    GOOGLE_CLIENT_ID = var.google_client_id
    SMTP_HOST        = var.smtp_host
    SMTP_PORT        = tostring(var.smtp_port)
    SMTP_USER        = var.smtp_user
    SMTP_PASS        = var.smtp_pass
    SMTP_FROM        = var.smtp_from
  })
}
