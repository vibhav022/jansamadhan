import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const envFile = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8');

function parseEnvFile(text) {
  return Object.fromEntries(
    [...text.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/gm)].map(([, key, value]) => [key, value.trim()]),
  );
}

test('local dev env file contains a valid SMTP configuration shape', () => {
  const values = parseEnvFile(envFile);
  const isMock = values.EMAIL_TEST_MODE === 'mock';
  assert.ok(isMock ? values.SMTP_HOST === 'mock' : values.SMTP_HOST === 'smtp.gmail.com', 'SMTP_HOST must match the selected local mode');
  assert.ok(values.SMTP_USER !== undefined, 'SMTP_USER must be declared');
  assert.ok(values.SMTP_PASSWORD !== undefined, 'SMTP_PASSWORD must be declared');
  assert.ok(values.OTP_SECRET !== undefined, 'OTP_SECRET must be declared');
});
