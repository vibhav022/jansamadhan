import { test, expect } from '@playwright/test';

async function readMockInbox(request: import('@playwright/test').APIRequestContext) {
  const response = await request.get('/api/portal?action=mockInbox');
  if (!response.ok) {
    throw new Error(`Mock inbox unavailable: ${response.status}`);
  }
  return response.json();
}

async function latestOtp(request: import('@playwright/test').APIRequestContext, messageIndex = -1) {
  await expect.poll(async () => (await readMockInbox(request)).messages.length).toBeGreaterThan(messageIndex);
  const { messages } = await readMockInbox(request);
  const message = messages.at(messageIndex);
  const match = message?.text.match(/verification code is: (\d{6})/i);
  expect(match, 'latest mock email should contain a six-digit OTP').not.toBeNull();
  return match![1];
}

test.describe('JanSamadhan OTP flow', () => {
  test.beforeEach(async ({ request }) => {
    const response = await request.get('/api/portal?action=clearMockInbox');
    expect(response.ok(), 'mock email mode must be enabled for this test server').toBeTruthy();
  });

  test('sign-up and login create and revoke an authenticated session', async ({ page, request }) => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const email = `playwright-${suffix}@example.com`;
    const phone = `9${suffix.slice(-9)}`;

    await page.goto('http://127.0.0.1:5173');
    await page.getByRole('button', { name: /login/i }).click();
    await page.getByRole('button', { name: /create account/i }).click();
    await page.getByLabel('Name').fill('Playwright Tester');
    await page.getByLabel('Mobile number').fill(phone);
    await page.getByLabel('Email address').fill(email);
    await page.getByRole('button', { name: /send otp/i }).click();

    await expect(page.getByText('Check your inbox')).toBeVisible();
    await page.getByLabel('Enter 6-digit OTP').fill(await latestOtp(request));
    await page.getByRole('button', { name: /verify & login/i }).click();

    const loginButton = page.getByRole('button', { name: /playwright tester/i });
    await expect(loginButton).toBeVisible();
    await expect.poll(async () => (await page.evaluate(async () => (await fetch('/api/portal?action=session')).json())).authenticated).toBe(true);

    await loginButton.click();
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect.poll(async () => (await page.evaluate(async () => (await fetch('/api/portal?action=session')).json())).authenticated).toBe(false);
    const anonymousVote = await page.evaluate(async () => {
      const response = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'challengeVote', challengeId: 'JH-24018' }),
      });
      return { status: response.status, body: await response.json() };
    });
    expect(anonymousVote.status).toBe(401);

    await page.getByRole('button', { name: /^login$/i }).click();
    await page.getByLabel('Email address').fill(email);
    await page.waitForTimeout(16000);
    await page.getByRole('button', { name: /^send otp$/i }).click();
    await expect(page.getByText('Check your inbox')).toBeVisible();
    await page.getByLabel('Enter 6-digit OTP').fill(await latestOtp(request));
    await page.getByRole('button', { name: /verify & login/i }).click();
    await expect(page.getByRole('button', { name: /playwright tester/i })).toBeVisible();
    await expect.poll(async () => (await page.evaluate(async () => (await fetch('/api/portal?action=session')).json())).authenticated).toBe(true);
    const authenticatedVote = await page.evaluate(async () => {
      const response = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'challengeVote', challengeId: 'JH-24018' }),
      });
      return { status: response.status, body: await response.json() };
    });
    expect(authenticatedVote.status).toBe(201);
  });

  test('rejects a wrong OTP and accepts the resent code after the cooldown', async ({ page, request }) => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const email = `resend-${suffix}@example.com`;
    const phone = `8${suffix.slice(-9)}`;

    await page.goto('http://127.0.0.1:5173');
    await page.getByRole('button', { name: /login/i }).click();
    await page.getByRole('button', { name: /create account/i }).click();
    await page.getByLabel('Name').fill('Resend Tester');
    await page.getByLabel('Mobile number').fill(phone);
    await page.getByLabel('Email address').fill(email);
    await page.getByRole('button', { name: /send otp/i }).click();
    await expect(page.getByText('Check your inbox')).toBeVisible();

    const originalCode = await latestOtp(request);
    await page.getByLabel('Enter 6-digit OTP').fill(originalCode === '000000' ? '000001' : '000000');
    await page.getByRole('button', { name: /verify & login/i }).click();
    await expect(page.getByRole('alert')).toBeVisible();

    const resendButton = page.getByRole('button', { name: /resend otp/i });
    await expect(resendButton).toBeEnabled({ timeout: 25000 });
    await resendButton.click();
    await expect(page.getByText('Check your inbox')).toBeVisible();
    const resentCode = await latestOtp(request, 1);
    expect(resentCode).not.toBe(originalCode);
    await page.getByLabel('Enter 6-digit OTP').fill(resentCode);
    await page.getByRole('button', { name: /verify & login/i }).click();
    await expect(page.getByRole('button', { name: /resend tester/i })).toBeVisible();
  });

  test('rejects an OTP after its expiry time', async ({ page, request }) => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const email = `expired-${suffix}@example.com`;
    const phone = `7${suffix.slice(-9)}`;

    await page.goto('http://127.0.0.1:5173');
    await page.getByRole('button', { name: /login/i }).click();
    await page.getByRole('button', { name: /create account/i }).click();
    await page.getByLabel('Name').fill('Expired OTP Tester');
    await page.getByLabel('Mobile number').fill(phone);
    await page.getByLabel('Email address').fill(email);

    const otpResponsePromise = page.waitForResponse((response) => {
      if (!response.url().includes('/api/portal') || response.request().method() !== 'POST') return false;
      try {
        return response.request().postDataJSON().action === 'requestOtp';
      } catch {
        return false;
      }
    });
    await page.getByRole('button', { name: /send otp/i }).click();
    const otpResponse = await otpResponsePromise;
    expect(otpResponse.ok()).toBeTruthy();
    const issued = await otpResponse.json();
    const otp = await latestOtp(request);

    await expect(page.getByText(/code has expired/i)).toBeVisible({ timeout: 70000 });
    const verification = await page.evaluate(async ({ challengeId, emailAddress, code }) => {
      const response = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verifyOtp', challengeId, email: emailAddress, otp: code }),
      });
      return { status: response.status, body: await response.json() };
    }, { challengeId: issued.challengeId, emailAddress: email, code: otp });
    expect(verification.status).toBe(400);
    expect(verification.body.error).toMatch(/expired/i);
  });
});
