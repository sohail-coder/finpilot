import nodemailer from "nodemailer";
import { env } from "../config/env";
import { logger } from "./logger";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
      throw new Error("SMTP environment variables are not configured");
    }
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: (env.SMTP_PORT ?? 587) === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}) {
  const from = env.SMTP_FROM ?? env.SMTP_USER;
  if (!from) throw new Error("No SMTP_FROM or SMTP_USER configured");

  const mail = getTransporter();
  const info = await mail.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    attachments: options.attachments,
  });
  logger.info(`Email sent to ${options.to}: ${info.messageId}`);
  return info;
}
