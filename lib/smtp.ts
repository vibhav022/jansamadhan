// Minimal SMTP client for Cloudflare Workers.
//
// This is the Workers-compatible port of the FOC PROJECT email OTP mechanism
// (Python `smtplib` -> Gmail SMTP with STARTTLS + app password). Workers cannot
// run smtplib, so we speak SMTP directly over a TCP socket from
// `cloudflare:sockets`, supporting STARTTLS (port 587) and implicit TLS (465).
//
// Server-only module. Never import this from a Client Component.
import { connect } from "cloudflare:sockets";

export type SmtpSecurity = "starttls" | "tls" | "none";

export type SmtpConfig = {
  host: string;
  port: number;
  security: SmtpSecurity;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  timeoutMs: number;
};

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type MockMailMessage = MailMessage & {
  createdAt: string;
};

declare global {
  var __jansamadhan_mock_mail_queue: MockMailMessage[] | undefined;
}

export function getMockMailQueue() {
  globalThis.__jansamadhan_mock_mail_queue ??= [];
  return globalThis.__jansamadhan_mock_mail_queue;
}

export function clearMockMailQueue() {
  getMockMailQueue().length = 0;
}

function isMockEmailMode() {
  const env = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const mode = String(env?.EMAIL_TEST_MODE ?? env?.TEST_MODE ?? "").toLowerCase();
  return mode === "mock";
}

export class SmtpError extends Error {
  constructor(public step: string, public code?: number) {
    // Never include credentials or message content in the error text.
    super(`SMTP ${step} failed${code ? ` (server replied ${code})` : ""}`);
    this.name = "SmtpError";
  }
}

const encoder = new TextEncoder();

function base64Utf8(value: string) {
  let binary = "";
  for (const byte of encoder.encode(value)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Removes CR/LF so values can never inject extra SMTP commands or headers. */
function headerSafe(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

class SmtpConnection {
  private socket: Socket;
  private reader!: ReadableStreamDefaultReader<Uint8Array>;
  private writer!: WritableStreamDefaultWriter<Uint8Array>;
  private buffer = "";
  private decoder = new TextDecoder();

  constructor(socket: Socket) {
    this.socket = socket;
    this.attach(socket);
  }

  private attach(socket: Socket) {
    this.socket = socket;
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
    this.buffer = "";
    this.decoder = new TextDecoder();
  }

  async read(step: string): Promise<{ code: number; lines: string[] }> {
    const lines: string[] = [];
    for (;;) {
      let index = this.buffer.indexOf("\r\n");
      while (index === -1) {
        const { value, done } = await this.reader.read();
        if (done) throw new SmtpError(`${step} (connection closed)`);
        this.buffer += this.decoder.decode(value, { stream: true });
        index = this.buffer.indexOf("\r\n");
      }
      const line = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 2);
      lines.push(line);
      if (/^\d{3}(?: |$)/.test(line)) return { code: Number(line.slice(0, 3)), lines };
      if (!/^\d{3}-/.test(line)) throw new SmtpError(`${step} (malformed reply)`);
    }
  }

  async write(data: string) {
    await this.writer.write(encoder.encode(data));
  }

  async command(step: string, command: string, expected: number[]) {
    await this.write(`${command}\r\n`);
    const reply = await this.read(step);
    if (!expected.includes(reply.code)) throw new SmtpError(step, reply.code);
    return reply;
  }

  upgradeToTls() {
    this.reader.releaseLock();
    this.writer.releaseLock();
    this.attach(this.socket.startTls());
  }

  async close() {
    try { this.reader.releaseLock(); } catch { /* already released */ }
    try { this.writer.releaseLock(); } catch { /* already released */ }
    try { await this.socket.close(); } catch { /* already closed */ }
  }
}

function buildMessage(config: SmtpConfig, message: MailMessage) {
  const boundary = `js-${crypto.randomUUID()}`;
  const domain = config.fromEmail.split("@")[1] || "jansamadhan.local";
  const fromName = headerSafe(config.fromName).replace(/["\\]/g, "");
  const headers = [
    `From: "${fromName}" <${headerSafe(config.fromEmail)}>`,
    `To: <${headerSafe(message.to)}>`,
    `Subject: ${headerSafe(message.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    "Auto-Submitted: auto-generated",
  ];
  const parts = message.html
    ? [
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        "Content-Type: text/plain; charset=utf-8",
        "Content-Transfer-Encoding: base64",
        "",
        wrap(base64Utf8(message.text)),
        `--${boundary}`,
        "Content-Type: text/html; charset=utf-8",
        "Content-Transfer-Encoding: base64",
        "",
        wrap(base64Utf8(message.html)),
        `--${boundary}--`,
      ]
    : [
        "Content-Type: text/plain; charset=utf-8",
        "Content-Transfer-Encoding: base64",
        "",
        wrap(base64Utf8(message.text)),
      ];
  // Base64 bodies never start a line with ".", but dot-stuff defensively anyway.
  return [...headers, ...parts].join("\r\n").replace(/\r\n\./g, "\r\n..");
}

function wrap(value: string) {
  return value.replace(/.{1,76}/g, "$&\r\n").trimEnd();
}

async function deliver(config: SmtpConfig, message: MailMessage) {
  const socket = connect(
    { hostname: config.host, port: config.port },
    { secureTransport: config.security === "tls" ? "on" : config.security === "starttls" ? "starttls" : "off", allowHalfOpen: false },
  );
  const smtp = new SmtpConnection(socket);
  const helo = `EHLO ${config.fromEmail.split("@")[1] || "localhost"}`;
  try {
    const greeting = await smtp.read("greeting");
    if (greeting.code !== 220) throw new SmtpError("greeting", greeting.code);

    let ehlo = await smtp.command("EHLO", helo, [250]);
    if (config.security === "starttls") {
      await smtp.command("STARTTLS", "STARTTLS", [220]);
      smtp.upgradeToTls();
      ehlo = await smtp.command("EHLO (TLS)", helo, [250]);
    }

    if (config.user) {
      const authLine = ehlo.lines.find((line) => /^250[- ]AUTH[ =]/i.test(line))?.toUpperCase() || "";
      if (authLine.includes("PLAIN") || !authLine.includes("LOGIN")) {
        await smtp.command("AUTH", `AUTH PLAIN ${base64Utf8(`\u0000${config.user}\u0000${config.password}`)}`, [235]);
      } else {
        await smtp.command("AUTH", "AUTH LOGIN", [334]);
        await smtp.command("AUTH", base64Utf8(config.user), [334]);
        await smtp.command("AUTH", base64Utf8(config.password), [235]);
      }
    }

    await smtp.command("MAIL FROM", `MAIL FROM:<${headerSafe(config.fromEmail)}>`, [250]);
    await smtp.command("RCPT TO", `RCPT TO:<${headerSafe(message.to)}>`, [250, 251]);
    await smtp.command("DATA", "DATA", [354]);
    await smtp.write(`${buildMessage(config, message)}\r\n.\r\n`);
    const accepted = await smtp.read("message body");
    if (accepted.code !== 250) throw new SmtpError("message body", accepted.code);
    try { await smtp.command("QUIT", "QUIT", [221]); } catch { /* message already accepted */ }
  } finally {
    await smtp.close();
  }
}

export async function sendMail(config: SmtpConfig, message: MailMessage) {
  if (config.host === "mock" || isMockEmailMode()) {
    getMockMailQueue().push({
      ...message,
      createdAt: new Date().toISOString(),
    });
    return;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SmtpError("timeout")), config.timeoutMs);
  });
  try {
    await Promise.race([deliver(config, message), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
