import "dotenv/config";
import nodemailer from "nodemailer";

// Diagnoses email configuration. Usage:
//   npm run email:test              (sends to SMTP_USER)
//   npm run email:test you@x.com    (sends to the given address)

async function main() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const to = process.argv[2] || user;

  console.log("--- SMTP configuration as the app sees it ---");
  console.log(`SMTP_HOST: ${host ? host : "(NOT SET)"}`);
  console.log(`SMTP_PORT: ${port}`);
  console.log(`SMTP_USER: ${user ? user : "(NOT SET)"}`);
  console.log(
    `SMTP_PASS: ${pass ? `(set, ${pass.length} characters${/\s/.test(pass) ? ", CONTAINS SPACES" : ""})` : "(NOT SET)"}`
  );
  console.log(`SMTP_FROM: ${process.env.SMTP_FROM || "(not set, will use default)"}`);
  console.log("");

  if (!host || !user || !pass) {
    console.log("PROBLEM FOUND: one or more SMTP values above is NOT SET.");
    console.log("- Make sure you edited backend/.env (NOT backend/.env.example).");
    console.log("- Make sure there are no spaces around the = sign, e.g. SMTP_HOST=smtp.gmail.com");
    process.exit(1);
  }

  if (/\s/.test(pass)) {
    console.log("WARNING: your SMTP_PASS contains spaces. Gmail app passwords are shown");
    console.log("with spaces (abcd efgh ijkl mnop) but must be entered WITHOUT spaces.");
    console.log("Fix backend/.env and run this again.");
    process.exit(1);
  }

  if (host.includes("gmail") && pass.length !== 16) {
    console.log(`WARNING: Gmail app passwords are exactly 16 characters; yours is ${pass.length}.`);
    console.log("If you used your normal Gmail password, it will not work - create an app");
    console.log("password at https://myaccount.google.com/apppasswords");
    console.log("");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  console.log(`Connecting to ${host}:${port} ...`);
  try {
    await transporter.verify();
    console.log("Connection and login OK.");
  } catch (err: any) {
    console.log("");
    console.log("CONNECTION/LOGIN FAILED. Full error:");
    console.log(err?.message || err);
    if (String(err?.message || "").match(/535|invalid login|username and password/i)) {
      console.log("");
      console.log("This is an authentication error. For Gmail:");
      console.log("1. Turn on 2-Step Verification on your Google account.");
      console.log("2. Create an app password: https://myaccount.google.com/apppasswords");
      console.log("3. Paste the 16 characters into SMTP_PASS with no spaces.");
    }
    process.exit(1);
  }

  console.log(`Sending test email to ${to} ...`);
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `MR GRAIN <${user}>`,
      to,
      subject: "MR GRAIN test email",
      html: "<p>If you can read this, email sending from MR GRAIN Command Centre works.</p>",
    });
    console.log("SUCCESS - test email sent. Check the inbox (and spam folder) of " + to);
    console.log("Remember to RESTART the backend (Ctrl+C, then npm run dev) if you haven't");
    console.log("since editing .env - the app only reads .env at startup.");
  } catch (err: any) {
    console.log("SEND FAILED. Full error:");
    console.log(err?.message || err);
    process.exit(1);
  }
}

main();
