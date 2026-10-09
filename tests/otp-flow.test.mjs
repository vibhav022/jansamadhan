import test from 'node:test';
import assert from 'node:assert/strict';

const env = {
  OTP_SECRET: '0123456789abcdef0123456789abcdef',
  SMTP_HOST: 'mock',
  SMTP_PORT: '587',
  SMTP_SECURITY: 'starttls',
  SMTP_USER: 'test@jansamadhan.local',
  SMTP_PASSWORD: 'test-app-password',
  OTP_FROM_EMAIL: 'test@jansamadhan.local',
  OTP_FROM_NAME: 'JanSamadhan Test',
  OTP_EXPIRY_SECONDS: '300',
  OTP_RESEND_COOLDOWN_SECONDS: '60',
  OTP_MAX_ATTEMPTS: '3',
  OTP_MAX_RESENDS: '2',
  OTP_MAX_SENDS_PER_HOUR: '25',
  OTP_MAX_SENDS_PER_IP_PER_HOUR: '50',
};

for (const [key, value] of Object.entries(env)) {
  process.env[key] = value;
}

const { issueOtp, verifyOtp, resendOtp, normalizeEmail } = await import('../lib/otp.ts');
const { getMockMailQueue, clearMockMailQueue } = await import('../lib/smtp.ts');

const fakeDb = {
  batch: async (queries) => queries.map((query) => ({ results: query?.__results ?? [] })),
  prepare: (sql) => {
    const query = {
      sql,
      values: [],
      bind: (...args) => {
        query.values = args;
        return query;
      },
      async run() {
        return { meta: { changes: 1 } };
      },
      async first() {
        const entry = Object.create(null);
        return entry;
      },
      __results: [],
    };
    return query;
  },
};

test('mocked OTP flow can issue, verify, resend, and reject invalid codes', async () => {
  clearMockMailQueue();
  const db = {
    prepare: (sql) => {
      const state = { rows: [], values: [] };
      return {
        bind: (...args) => {
          state.values = args;
          return thisQuery;
        },
        async run() {
          return { meta: { changes: 1 } };
        },
        async first() {
          return null;
        },
      };
      const thisQuery = {
        bind: (...args) => {
          state.values = args;
          return thisQuery;
        },
        async run() {
          return { meta: { changes: 1 } };
        },
        async first() {
          return null;
        },
      };
      return thisQuery;
    },
    batch: async (calls) => calls.map(() => ({ results: [] })),
  };

  const request = new Request('https://example.com/api/portal', {
    headers: { 'cf-connecting-ip': '127.0.0.1' },
  });

  const issued = await issueOtp(db, request, 'user@example.com', 'signup', { name: 'Test User', phone: '9999999999', role: 'Citizen' });
  assert.ok(issued.challengeId);
  assert.equal(normalizeEmail('  USER@EXAMPLE.COM '), 'user@example.com');

  const queue = getMockMailQueue();
  assert.equal(queue.length, 1);
  assert.match(queue[0].subject, /verification code/i);

  const codeMatch = queue[0].text.match(/Your JanSamadhan verification code is: (\d{6})/);
  assert.ok(codeMatch);
  const code = codeMatch[1];

  const verified = await verifyOtp(db, issued.challengeId, 'user@example.com', code);
  assert.equal(verified.purpose, 'signup');

  const wrong = await verifyOtp(db, issued.challengeId, 'user@example.com', '000000').catch((error) => error);
  assert.ok(wrong instanceof Error);
  assert.match(wrong.message, /Incorrect OTP|Too many incorrect/i);
});
