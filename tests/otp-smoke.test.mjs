import test from 'node:test';
import assert from 'node:assert/strict';
import { clearMockMailQueue, getMockMailQueue } from '../lib/smtp.ts';

const baseEnv = {
  OTP_SECRET: '0123456789abcdef0123456789abcdef',
  SMTP_HOST: 'mock',
  SMTP_PORT: '587',
  SMTP_SECURITY: 'starttls',
  SMTP_USER: 'test@jansamadhan.local',
  SMTP_PASSWORD: 'test-app-password',
  OTP_FROM_EMAIL: 'noreply@jansamadhan.local',
  OTP_FROM_NAME: 'JanSamadhan Test',
  OTP_EXPIRY_SECONDS: '300',
  OTP_RESEND_COOLDOWN_SECONDS: '60',
  OTP_MAX_ATTEMPTS: '3',
  OTP_MAX_RESENDS: '2',
  OTP_MAX_SENDS_PER_HOUR: '25',
  OTP_MAX_SENDS_PER_IP_PER_HOUR: '50',
  EMAIL_TEST_MODE: 'mock',
};

for (const [key, value] of Object.entries(baseEnv)) {
  process.env[key] = value;
}

const { issueOtp, verifyOtp, resendOtp, normalizeEmail } = await import('../lib/otp.ts');

function makeDb(records = []) {
  const rows = [...records];

  return {
    async batch(queries) {
      return queries.map((query) => ({ results: [] }));
    },
    prepare(sql) {
      const query = {
        sql,
        values: [],
        bind(...args) {
          this.values = args;
          return this;
        },
        async run() {
          const entry = { meta: { changes: 1 } };
          if (/INSERT INTO otp_challenges/.test(sql)) {
            rows.push({
              id: this.values[0],
              email: this.values[1],
              purpose: this.values[2],
              otp_hash: this.values[3],
              payload: this.values[4],
              attempts: Number(this.values[5] ?? 0),
              send_count: Number(this.values[6] ?? 1),
              last_sent_at: this.values[7],
              expires_at: this.values[8],
              consumed_at: this.values[9],
              request_ip: this.values[10],
              created_at: this.values[11],
            });
          }
          if (/UPDATE otp_challenges SET consumed_at/.test(sql)) {
            const id = this.values[1];
            const row = rows.find((item) => item.id === id);
            if (row) row.consumed_at = this.values[0];
          }
          return entry;
        },
        async first() {
          const [firstArg, secondArg] = this.values;

          if (/SELECT \* FROM otp_challenges WHERE id = \? AND email = \? LIMIT 1/.test(sql)) {
            return rows.find((row) => row.id === firstArg && row.email === secondArg) ?? null;
          }
          if (/SELECT last_sent_at FROM otp_challenges WHERE email = \? ORDER BY last_sent_at DESC LIMIT 1/.test(sql)) {
            const match = [...rows].reverse().find((row) => row.email === firstArg);
            return match ? { last_sent_at: match.last_sent_at } : null;
          }
          if (/SELECT SUM\(send_count\) AS sends/.test(sql)) {
            return { sends: rows.filter((row) => row.email === firstArg || row.request_ip === firstArg).reduce((sum, row) => sum + Number(row.send_count || 0), 0) };
          }
          if (/SELECT otp_hash, attempts FROM otp_challenges WHERE id = \?/.test(sql)) {
            const row = rows.find((item) => item.id === firstArg);
            return row ? { otp_hash: row.otp_hash, attempts: Number(row.attempts || 0) } : null;
          }
          return null;
        },
      };
      return query;
    },
  };
}

test('OTP generation, verification, resend limits, and mock email queue work', async () => {
  clearMockMailQueue();
  const db = makeDb();
  const request = new Request('https://example.com/api/portal', { headers: { 'cf-connecting-ip': '127.0.0.1' } });

  const issued = await issueOtp(db, request, 'user@example.com', 'signup', { name: 'Test User', phone: '9876543210', role: 'Citizen' });
  assert.ok(issued.challengeId);
  assert.equal(normalizeEmail(' USER@EXAMPLE.COM '), 'user@example.com');

  const inbox = getMockMailQueue();
  assert.equal(inbox.length, 1);
  assert.match(inbox[0].subject, /verification code/i);

  const code = inbox[0].text.match(/Your JanSamadhan verification code is: (\d{6})/)?.[1];
  assert.ok(code, 'OTP should be present in queued mock email');

  const verified = await verifyOtp(db, issued.challengeId, 'user@example.com', code);
  assert.equal(verified.purpose, 'signup');
  assert.equal(verified.payload.name, 'Test User');

  const reused = await verifyOtp(db, issued.challengeId, 'user@example.com', code).catch((error) => error);
  assert.ok(reused instanceof Error);
  assert.match(reused.message, /no longer valid|expired|Incorrect OTP/i);

  const second = await issueOtp(db, request, 'another@example.com', 'login', {});
  const secondCode = getMockMailQueue().at(-1).text.match(/Your JanSamadhan verification code is: (\d{6})/)?.[1];
  const wrong = await verifyOtp(db, second.challengeId, 'another@example.com', '000000').catch((error) => error);
  assert.ok(wrong instanceof Error);
  assert.match(wrong.message, /Incorrect OTP|attempt/i);

  const resent = await resendOtp(db, request, second.challengeId, 'another@example.com');
  assert.ok(resent.challengeId);
  assert.ok(resent.resendIn >= 0);
});

test('expired OTPs and brute-force attempts are rejected', async () => {
  clearMockMailQueue();
  const expiredDb = makeDb([
    {
      id: 'exp-1',
      email: 'expired@example.com',
      purpose: 'login',
      otp_hash: 'deadbeef',
      payload: '{}',
      attempts: 0,
      send_count: 1,
      last_sent_at: new Date(Date.now() - 60000).toISOString(),
      expires_at: new Date(Date.now() - 1000).toISOString(),
      consumed_at: null,
      request_ip: '127.0.0.1',
      created_at: new Date(Date.now() - 60000).toISOString(),
    },
  ]);

  const expired = await verifyOtp(expiredDb, 'exp-1', 'expired@example.com', '123456').catch((error) => error);
  assert.ok(expired instanceof Error);
  assert.match(expired.message, /expired|request a new one/i);

  const forcedDb = makeDb([
    {
      id: 'attack-1',
      email: 'attack@example.com',
      purpose: 'login',
      otp_hash: 'deadbeef',
      payload: '{}',
      attempts: 3,
      send_count: 1,
      last_sent_at: new Date(Date.now() - 1000).toISOString(),
      expires_at: new Date(Date.now() + 300000).toISOString(),
      consumed_at: null,
      request_ip: '127.0.0.1',
      created_at: new Date(Date.now() - 1000).toISOString(),
    },
  ]);

  const blocked = await verifyOtp(forcedDb, 'attack-1', 'attack@example.com', '123456').catch((error) => error);
  assert.ok(blocked instanceof Error);
  assert.match(blocked.message, /Too many incorrect attempts|request a new OTP/i);
});
