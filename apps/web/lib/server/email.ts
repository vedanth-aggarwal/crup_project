import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { render } from "@react-email/components";
import { requireEnv } from "./env";

/**
 * Plain SMTP (like Python's smtplib). Defaults to Gmail with an App Password:
 * SMTP_USER=you@gmail.com, SMTP_PASS=<16-char app password>.
 * Gmail allows roughly 500 recipients a day on a personal account.
 */
let transport: Transporter | undefined;
function smtp() {
  if (transport) return transport;
  const port = Number(process.env.SMTP_PORT || 465);
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user: requireEnv("SMTP_USER"), pass: requireEnv("SMTP_PASS").replace(/\s+/g, "") },
    pool: true,
    maxConnections: 2,
  });
  return transport;
}

export const emailConfigured = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

export async function sendEmail(opts: { to: string; subject: string; react: React.ReactElement; unsubscribeUrl: string }) {
  const [html, text] = await Promise.all([render(opts.react), render(opts.react, { plainText: true })]);
  const from = process.env.EMAIL_FROM || requireEnv("SMTP_USER");
  await smtp().sendMail({
    from: `Clubo <${from}>`,
    to: opts.to,
    subject: opts.subject,
    html,
    text,
    list: {
      // One-click unsubscribe (RFC 8058): Gmail/Apple show an "Unsubscribe" button.
      unsubscribe: { url: opts.unsubscribeUrl, comment: "Unsubscribe" },
    },
    headers: { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
}
