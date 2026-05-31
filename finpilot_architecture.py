from diagrams import Diagram, Cluster, Edge
from diagrams.aws.compute import ECS
from diagrams.aws.database import RDS
from diagrams.aws.network import ALB, CloudFront
from diagrams.aws.storage import S3
from diagrams.aws.security import SecretsManager
from diagrams.aws.management import Cloudwatch
from diagrams.aws.devtools import ECR
from diagrams.onprem.ci import GithubActions
from diagrams.onprem.vcs import Github
from diagrams.onprem.monitoring import Sonarqube
from diagrams.generic.blank import Blank

with Diagram("FinPilot Architecture", show=False, filename="finpilot_architecture", direction="LR"):
    user_web = Blank("Web Browser")
    user_mobile = Blank("Mobile (future)")
    cf = CloudFront("CloudFront CDN")

    with Cluster("AWS VPC"):
        alb = ALB("ALB")
        ecs = ECS("ECS Fargate\n(Node.js + Express + TypeScript)")
        rds = RDS("Aurora PostgreSQL\n(Encrypted, Serverless)")
        s3 = S3("S3 Bucket")
        cw = Cloudwatch("CloudWatch")
        sm = SecretsManager("Secrets Manager")
        cp = Blank("Credit Card AI Service")

    with Cluster("CI/CD Pipeline"):
        git = Github("GitHub")
        gha = GithubActions("GitHub Actions")
        sq = Sonarqube("SonarQube")
        ecr = ECR("ECR (Docker Registry)")
        build_be = Blank("Build Backend")
        build_fe = Blank("Build Frontend")
        deploy_be = Blank("Deploy to ECS Fargate")
        deploy_fe = Blank("Deploy to S3/CloudFront")

    # User traffic
    user_web >> Edge(label="HTTPS") >> cf
    user_mobile >> Edge(label="HTTPS") >> cf
    cf >> Edge(label="/api/*") >> alb
    cf >> Edge(label="static assets") >> s3
    alb >> Edge(label="HTTP") >> ecs
    ecs >> Edge(label="Prisma ORM") >> rds
    ecs >> Edge(label="SMTP") >> Blank("Email (Nodemailer)")
    ecs >> Edge(label="HTTPS") >> [Blank("OpenAI API (GPT-4o-mini)"), Blank("Exchange Rate API"), Blank("Bank Provider API")]
    ecs >> Edge(label="CloudWatch Logs") >> cw
    ecs >> Edge(label="Secrets") >> sm
    ecs >> Edge(label="Credit Planning Service") >> cp
    cp >> Edge(label="HTTPS") >> [Blank("OpenAI API (GPT-4o-mini)"), Blank("Credit Score API")]
    cp >> Edge(label="Prisma ORM") >> rds
    rds >> Edge(label="Backups") >> s3
    s3 >> Edge(label="Static assets") >> cf

    # CI/CD pipeline
    git >> Edge(label="Push") >> gha
    gha >> Edge(label="Build & Test Backend") >> sq
    gha >> Edge(label="Build & Test Frontend") >> sq
    sq >> Edge(label="Quality Gate") >> build_be
    sq >> Edge(label="Quality Gate") >> build_fe
    build_be >> Edge(label="Build & Push") >> ecr
    build_fe >> Edge(label="Build & Upload") >> s3
    build_be >> Edge(label="Deploy") >> deploy_be
    build_fe >> Edge(label="Deploy") >> deploy_fe
    deploy_be >> Edge(label="ECS Service Update") >> ecs
    deploy_fe >> Edge(label="Invalidate Cache") >> cf
