import nodemailer from 'nodemailer';

let tx = null;
// Two ways to send. MAIL_WEBHOOK_URL is an HTTPS relay (see mail-relay.gs: a Google Apps Script that sends from your Gmail);
// it works on Render's free plan, which blocks SMTP ports. Otherwise plain SMTP via SMTP_HOST.
export const mailEnabled = () => !!(process.env.MAIL_WEBHOOK_URL || process.env.SMTP_HOST);

export async function sendMail(to, subject, text) {
  if (process.env.MAIL_WEBHOOK_URL) {
    const r = await fetch(process.env.MAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret: process.env.MAIL_WEBHOOK_SECRET || '', to, subject, text }),
      signal: AbortSignal.timeout(20000),
    });
    const body = (await r.text()).trim();
    if (!r.ok || body !== 'ok') throw new Error(`mail relay answered: ${body.slice(0, 120)}`);
    return;
  }
  if (!process.env.SMTP_HOST) throw new Error('Email is not configured');
  tx ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await tx.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
}
