import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { parseEnv } from "node:util";

const envPath = resolve(process.argv[2] || ".dev.vars");
let settings;

try {
  settings = parseEnv(readFileSync(envPath, "utf8"));
} catch {
  console.error(`SMTP preflight: unable to read or parse ${basename(envPath)}.`);
  process.exit(2);
}

const problems = [];
const mode = String(settings.EMAIL_TEST_MODE || settings.TEST_MODE || "").trim().toLowerCase();
const host = String(settings.SMTP_HOST || "").trim().toLowerCase();
const security = String(settings.SMTP_SECURITY || "").trim().toLowerCase();
const port = Number(settings.SMTP_PORT || (security === "tls" ? 465 : 587));
const sender = String(settings.OTP_FROM_EMAIL || settings.SMTP_USER || "").trim();

if (mode === "mock" || host === "mock") {
  console.log(`SMTP preflight: BLOCKED (${basename(envPath)}; mock email mode, no network request)`);
  console.log("- disable mock mode and provide valid real SMTP settings before testing Gmail delivery");
  process.exit(1);
}
if (!settings.OTP_SECRET || settings.OTP_SECRET.trim().length < 32) problems.push("OTP_SECRET must contain at least 32 characters");
if (!host) problems.push("SMTP_HOST is missing");
if (!settings.SMTP_USER?.trim()) problems.push("SMTP_USER is missing");
if (!settings.SMTP_PASSWORD?.trim()) problems.push("SMTP_PASSWORD is missing");
if (!sender || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender)) problems.push("OTP_FROM_EMAIL or SMTP_USER must be a valid email address");
if (!new Set(["starttls", "tls"]).has(security)) problems.push("SMTP_SECURITY must be starttls or tls for real SMTP");
if (!Number.isInteger(port) || port < 1 || port > 65535) problems.push("SMTP_PORT must be a valid TCP port");
if (host === "smtp.gmail.com" && !((security === "starttls" && port === 587) || (security === "tls" && port === 465))) {
  problems.push("Gmail SMTP requires STARTTLS on port 587 or implicit TLS on port 465");
}

console.log(`SMTP preflight: ${problems.length ? "BLOCKED" : "READY"} (${basename(envPath)}; config-only, no network request)`);
for (const problem of problems) console.log(`- ${problem}`);
if (problems.length) process.exitCode = 1;