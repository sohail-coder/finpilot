# ──────────────────────────────────────────────────────
# RDS PostgreSQL (Multi-AZ ready, private subnets)
# ──────────────────────────────────────────────────────

resource "aws_db_subnet_group" "main" {
  name       = "${var.app_name}-db-subnet"
  subnet_ids = aws_subnet.private[*].id

  tags = { Name = "${var.app_name}-db-subnet-group" }
}

resource "aws_rds_cluster" "main" {
  cluster_identifier     = "${var.app_name}-${var.environment}"
  engine                 = "aurora-postgresql"
  engine_mode            = "provisioned"
  engine_version         = "16.4"
  database_name          = var.db_name
  master_username        = var.db_username
  master_password        = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  storage_encrypted       = true
  backup_retention_period = 7
  preferred_backup_window = "03:00-04:00"
  skip_final_snapshot     = var.environment != "prod"
  final_snapshot_identifier = var.environment == "prod" ? "${var.app_name}-final-snapshot" : null
  deletion_protection     = var.environment == "prod"

  serverlessv2_scaling_configuration {
    min_capacity = 0.5
    max_capacity = 4
  }

  tags = { Name = "${var.app_name}-aurora-cluster" }
}

resource "aws_rds_cluster_instance" "main" {
  count               = var.environment == "prod" ? 2 : 1
  cluster_identifier  = aws_rds_cluster.main.id
  instance_class      = "db.serverless"
  engine              = aws_rds_cluster.main.engine
  engine_version      = aws_rds_cluster.main.engine_version
  publicly_accessible = false

  tags = { Name = "${var.app_name}-aurora-instance-${count.index}" }
}
