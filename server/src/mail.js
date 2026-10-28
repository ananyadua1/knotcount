import nodemailer from 'nodemailer';

let tx = null;
export const mailEnabled = () => !!process.env.SMTP_HOST;

export async function sendMail(to, subject, text) {
  if (!mailEnabled()) throw new Error('SMTP is not configured');
  tx ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await tx.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
}
