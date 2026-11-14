// Usage: node --env-file=../../.env scripts/test-email.mjs [to]
import nodemailer from "nodemailer";
const port = Number(process.env.SMTP_PORT || 465);
const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port,
  secure: port === 465,
  auth: { user: process.env.SMTP_USER, pass: (process.env.SMTP_PASS || "").replace(/\s+/g, "") },
});
await t.verify();
console.log("SMTP login OK");
const to = process.argv[2] || process.env.SMTP_USER;
const info = await t.sendMail({
  from: `Clubo <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
  to,
  subject: "Clubo test email",
  text: "If you can read this, Clubo email works.",
});
console.log("sent:", info.response);
