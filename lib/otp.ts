// Server-side email OTP service for JanSamadhan.
//
// - 6-digit OTP from a CSPRNG (crypto.getRandomValues + rejection sampling)
// - Only an HMAC-SHA256 hash (keyed with OTP_SECRET) is stored in D1
// - Expires after OTP_EXPIRY_SECONDS (default 300 s = 5 minutes)
// - Single use: consumption is an atomic conditional UPDATE
// - Verification attempt limit, resend cooldown, resend limit and
//   per-email / per-IP hourly send limits
//
// The plaintext OTP only ever exists in memory long enough to be emailed.
// It is never logged, returned in an API response or sent to the browser.
//
// Server-only module. Never import this from a Client Component.
import { env } from "cloudflare:workers";
import { sendMail, type SmtpConfig, type SmtpSecurity } from "./smtp";

export type OtpPurpose = "login" | "signup";

export type OtpPayload = {
  name?: string;
  phone?: string;
  role?: string;
};

type OtpRow = {
  id: string;
  email: string;
  purpose: OtpPurpose;
  otp_hash: string;
  payload: string | null;
  attempts: number;
  send_count: number;
  last_sent_at: string;
  expires_at: string;
  consumed_at: string | null;
};

export class OtpError extends Error {
  constructor(message: string, public status = 400, public retryAfter?: number) {
    super(message);
    this.name = "OtpError";
  }
}

function readEnv(): Record<string, string | undefined> {
  return env as unknown as Record<string, string | undefined>;
}

function intSetting(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function otpSettings() {
  const e = readEnv();
  return {
    expirySeconds: intSetting(e.OTP_EXPIRY_SECONDS, 300, 60, 900),
    resendCooldownSeconds: intSetting(e.OTP_RESEND_COOLDOWN_SECONDS, 60, 15, 600),
    maxAttempts: intSetting(e.OTP_MAX_ATTEMPTS, 5, 1, 10),
    maxResends: intSetting(e.OTP_MAX_RESENDS, 3, 0, 10),
    maxSendsPerHour: intSetting(e.OTP_MAX_SENDS_PER_HOUR, 8, 1, 100),
    maxSendsPerIpPerHour: intSetting(e.OTP_MAX_SENDS_PER_IP_PER_HOUR, 30, 1, 1000),
  };
}

function smtpConfig(): SmtpConfig {
  const e = readEnv();
  // SENDER_EMAIL / SENDER_APP_PASSWORD are accepted for compatibility with the
  // FOC PROJECT variable names (Gmail SMTP + app password).
  const host = (e.SMTP_HOST || "smtp.gmail.com").trim();
  const user = (e.SMTP_USER || e.SENDER_EMAIL || "").trim();
  let password = e.SMTP_PASSWORD || e.SENDER_APP_PASSWORD || "";
  // Gmail app passwords are displayed as "abcd efgh ijkl mnop"; spaces are not part of them.
  if (/gmail\.com$/i.test(host)) password = password.replace(/\s+/g, "");
  const security = (e.SMTP_SECURITY || "starttls").trim().toLowerCase() as SmtpSecurity;
  const fromEmail = (e.OTP_FROM_EMAIL || user).trim();
  if (!["starttls", "tls", "none"].includes(security)) throw new OtpError("Email OTP service is misconfigured.", 503);
  if (!host || !fromEmail || (security !== "none" && (!user || !password))) {
    throw new OtpError("Email OTP service is not configured. Please contact the administrator.", 503);
  }
  return {
    host,
    port: intSetting(e.SMTP_PORT, security === "tls" ? 465 : security === "none" ? 25 : 587, 1, 65535),
    security,
    user,
    password,
    fromEmail,
    fromName: (e.OTP_FROM_NAME || "JanSamadhan").trim(),
    timeoutMs: intSetting(e.SMTP_TIMEOUT_MS, 15000, 3000, 30000),
  };
}

function otpSecret() {
  const secret = readEnv().OTP_SECRET || "";
  if (secret.length < 32) {
    throw new OtpError("Email OTP service is not configured. Please contact the administrator.", 503);
  }
  return secret;
}

export function normalizeEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i.test(email)) return "";
  return email;
}

/** Uniformly distributed 6-digit code from the Web Crypto CSPRNG. */
function generateOtp() {
  const buffer = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / 1_000_000) * 1_000_000; // reject biased tail
  for (;;) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < limit) return String(buffer[0] % 1_000_000).padStart(6, "0");
  }
}

async function hashOtp(challengeId: string, email: string, otp: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(otpSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${challengeId}:${email}:${otp}`));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

async function emailOtp(email: string, otp: string, purpose: OtpPurpose, name?: string) {
  const minutes = Math.round(otpSettings().expirySeconds / 60);
  const action = purpose === "signup" ? "complete your JanSamadhan registration" : "sign in to JanSamadhan";
  const greeting = name ? `Hello ${name},` : "Hello,";
  const text = `${greeting}\n\nYour JanSamadhan verification code is: ${otp}\n\nUse it to ${action}. It is valid for ${minutes} minutes and can be used only once.\n\nNever share this code with anyone. JanSamadhan staff will never ask for it.\nIf you did not request this, you can safely ignore this email.\n\n- JanSamadhan, Government of Jharkhand Innovation Mission`;
  const html = `<!doctype html><html><body style="margin:0;background:#f3f7f6;font-family:Arial,Helvetica,sans-serif;color:#17312b"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid #dbe6e3" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 28px;border-bottom:1px solid #e6eeec"><b style="font-size:18px;color:#176b5b">JanSamadhan</b><div style="font-size:12px;color:#6b7f7a">Societal Innovation Portal</div></td></tr><tr><td style="padding:24px 28px"><p style="margin:0 0 12px">${escapeHtml(greeting)}</p><p style="margin:0 0 18px">Use this code to ${action}:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;background:#f1f8f6;border-radius:12px;padding:16px;color:#123b31">${otp}</div><p style="margin:18px 0 0;font-size:13px;color:#55706a">Valid for ${minutes} minutes and usable only once. Never share this code with anyone.</p><p style="margin:12px 0 0;font-size:12px;color:#8a9a96">If you did not request this, you can safely ignore this email.</p></td></tr></table></td></tr></table></body></html>`;
  await sendMail(smtpConfig(), { to: email, subject: `${otp} is your JanSamadhan verification code`, text, html });
}

function secondsUntil(iso: string, now: number) {
  return Math.max(0, Math.ceil((Date.parse(iso) - now) / 1000));
}

function clientIp(request: Request) {
  return (request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown").trim().slice(0, 64);
}

async function enforceSendLimits(db: D1Database, email: string, ip: string, now: number) {
  const settings = otpSettings();
  const since = new Date(now - 60 * 60 * 1000).toISOString();
  const [byEmail, byIp] = await db.batch<{ sends: number | null }>([
    db.prepare("SELECT SUM(send_count) AS sends FROM otp_challenges WHERE email = ? AND created_at > ?").bind(email, since),
    db.prepare("SELECT SUM(send_count) AS sends FROM otp_challenges WHERE request_ip = ? AND created_at > ?").bind(ip, since),
  ]);
  if (Number(byEmail.results[0]?.sends || 0) >= settings.maxSendsPerHour || Number(byIp.results[0]?.sends || 0) >= settings.maxSendsPerIpPerHour) {
    throw new OtpError("Too many OTP requests. Please try again later.", 429, 15 * 60);
  }
}

export type OtpIssued = {
  challengeId: string;
  maskedEmail: string;
  expiresIn: number;
  resendIn: number;
  resendsLeft: number;
};

/** Creates a new OTP challenge for `email`, emails the code and returns public metadata only. */
export async function issueOtp(db: D1Database, request: Request, email: string, purpose: OtpPurpose, payload: OtpPayload): Promise<OtpIssued> {
  const settings = otpSettings();
  smtpConfig(); // fail fast (503) before touching the database if mail is not configured
  otpSecret();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const ip = clientIp(request);

  // Opportunistic cleanup of old challenges.
  await db.prepare("DELETE FROM otp_challenges WHERE created_at < ?").bind(new Date(now - 24 * 60 * 60 * 1000).toISOString()).run();

  // Cooldown also applies to brand-new requests for the same email.
  const recent = await db.prepare("SELECT last_sent_at FROM otp_challenges WHERE email = ? ORDER BY last_sent_at DESC LIMIT 1").bind(email).first<{ last_sent_at: string }>();
  if (recent) {
    const wait = secondsUntil(new Date(Date.parse(recent.last_sent_at) + settings.resendCooldownSeconds * 1000).toISOString(), now);
    if (wait > 0) throw new OtpError(`Please wait ${wait} seconds before requesting another OTP.`, 429, wait);
  }
  await enforceSendLimits(db, email, ip, now);

  const challengeId = crypto.randomUUID();
  const otp = generateOtp();
  const otpHash = await hashOtp(challengeId, email, otp);
  const expiresAt = new Date(now + settings.expirySeconds * 1000).toISOString();

  await db.batch([
    // Any previous unused code for this email is invalidated.
    db.prepare("UPDATE otp_challenges SET consumed_at = ? WHERE email = ? AND consumed_at IS NULL").bind(nowIso, email),
    db.prepare(`INSERT INTO otp_challenges (id,email,purpose,otp_hash,payload,attempts,send_count,last_sent_at,expires_at,consumed_at,request_ip,created_at)
      VALUES (?,?,?,?,?,0,1,?,?,NULL,?,?)`).bind(challengeId, email, purpose, otpHash, JSON.stringify(payload), nowIso, expiresAt, ip, nowIso),
  ]);

  try {
    await emailOtp(email, otp, purpose, payload.name);
  } catch {
    await db.prepare("UPDATE otp_challenges SET consumed_at = ? WHERE id = ?").bind(nowIso, challengeId).run();
    console.error("OTP email delivery failed");
    throw new OtpError("We could not send the OTP email right now. Please try again shortly.", 502);
  }

  return { challengeId, maskedEmail: maskEmail(email), expiresIn: settings.expirySeconds, resendIn: settings.resendCooldownSeconds, resendsLeft: settings.maxResends };
}

async function loadOpenChallenge(db: D1Database, challengeId: string, email: string) {
  if (!/^[0-9a-f-]{36}$/i.test(challengeId)) throw new OtpError("This OTP session is invalid. Please request a new OTP.", 400);
  const row = await db.prepare("SELECT * FROM otp_challenges WHERE id = ? AND email = ? LIMIT 1").bind(challengeId, email).first<OtpRow>();
  if (!row || row.consumed_at) throw new OtpError("This OTP is no longer valid. Please request a new OTP.", 400);
  return row;
}

/** Generates a fresh code for an existing challenge (old code becomes invalid). */
export async function resendOtp(db: D1Database, request: Request, challengeId: string, email: string): Promise<OtpIssued> {
  const settings = otpSettings();
  smtpConfig();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const row = await loadOpenChallenge(db, challengeId, email);
  if (row.attempts >= settings.maxAttempts) throw new OtpError("Too many incorrect attempts. Please start again.", 429);
  const resendsUsed = row.send_count - 1;
  if (resendsUsed >= settings.maxResends) throw new OtpError("Resend limit reached. Please start again later.", 429);
  const wait = secondsUntil(new Date(Date.parse(row.last_sent_at) + settings.resendCooldownSeconds * 1000).toISOString(), now);
  if (wait > 0) throw new OtpError(`Please wait ${wait} seconds before resending.`, 429, wait);
  await enforceSendLimits(db, email, clientIp(request), now);

  const otp = generateOtp();
  const otpHash = await hashOtp(row.id, email, otp);
  const expiresAt = new Date(now + settings.expirySeconds * 1000).toISOString();
  // Conditional on the previous send timestamp so concurrent resends cannot both succeed.
  const updated = await db.prepare(`UPDATE otp_challenges SET otp_hash = ?, send_count = send_count + 1, last_sent_at = ?, expires_at = ?
    WHERE id = ? AND consumed_at IS NULL AND last_sent_at = ?`).bind(otpHash, nowIso, expiresAt, row.id, row.last_sent_at).run();
  if (!updated.meta.changes) throw new OtpError("Please wait before resending.", 429, settings.resendCooldownSeconds);

  let payload: OtpPayload = {};
  try { payload = JSON.parse(row.payload || "{}"); } catch { /* ignore */ }
  try {
    await emailOtp(email, otp, row.purpose, payload.name);
  } catch {
    console.error("OTP email delivery failed");
    throw new OtpError("We could not resend the OTP email right now. Please try again shortly.", 502);
  }
  return { challengeId: row.id, maskedEmail: maskEmail(email), expiresIn: settings.expirySeconds, resendIn: settings.resendCooldownSeconds, resendsLeft: Math.max(0, settings.maxResends - resendsUsed - 1) };
}

/** Verifies and atomically consumes the OTP. Returns the purpose and payload bound at request time. */
export async function verifyOtp(db: D1Database, challengeId: string, email: string, otp: string) {
  const settings = otpSettings();
  if (!/^\d{6}$/.test(otp)) throw new OtpError("Enter the 6-digit OTP.", 400);
  const nowIso = new Date().toISOString();
  const row = await loadOpenChallenge(db, challengeId, email);
  if (row.expires_at <= nowIso) {
    await db.prepare("UPDATE otp_challenges SET consumed_at = ? WHERE id = ?").bind(nowIso, row.id).run();
    throw new OtpError("This OTP has expired. Please request a new one.", 400);
  }
  // Count the attempt before comparing, atomically, so parallel guesses cannot exceed the limit.
  const counted = await db.prepare("UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ? AND consumed_at IS NULL AND attempts < ?").bind(row.id, settings.maxAttempts).run();
  if (!counted.meta.changes) {
    await db.prepare("UPDATE otp_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL").bind(nowIso, row.id).run();
    throw new OtpError("Too many incorrect attempts. Please request a new OTP.", 429);
  }
  const current = await db.prepare("SELECT otp_hash, attempts FROM otp_challenges WHERE id = ?").bind(row.id).first<{ otp_hash: string; attempts: number }>();
  const expected = await hashOtp(row.id, email, otp);
  if (!current || !constantTimeEqual(expected, current.otp_hash)) {
    const left = Math.max(0, settings.maxAttempts - Number(current?.attempts || settings.maxAttempts));
    if (left === 0) {
      await db.prepare("UPDATE otp_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL").bind(nowIso, row.id).run();
      throw new OtpError("Too many incorrect attempts. Please request a new OTP.", 429);
    }
    throw new OtpError(`Incorrect OTP. ${left} attempt${left === 1 ? "" : "s"} left.`, 400);
  }
  // Single use: only one request can flip consumed_at from NULL.
  const consumed = await db.prepare("UPDATE otp_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL AND otp_hash = ? AND expires_at > ?")
    .bind(nowIso, row.id, current.otp_hash, nowIso).run();
  if (!consumed.meta.changes) throw new OtpError("This OTP is no longer valid. Please request a new OTP.", 400);

  let payload: OtpPayload = {};
  try { payload = JSON.parse(row.payload || "{}"); } catch { /* ignore */ }
  return { purpose: row.purpose, payload };
}
