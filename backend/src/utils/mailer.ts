import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
}

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<{ ok: boolean }> {
  const t = getTransporter();
  if (!t) {
    console.log(`[mailer] SMTP not configured - logging email instead of sending.
  To: ${opts.to}
  Subject: ${opts.subject}`);
    return { ok: true };
  }
  await t.sendMail({
    from: process.env.SMTP_FROM || "MR GRAIN <no-reply@mrgrain.com.au>",
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
  return { ok: true };
}
