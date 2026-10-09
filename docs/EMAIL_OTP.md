# Email OTP authentication

JanSamadhan uses server-side email OTP. This replaces the earlier demo, where the browser generated the code and showed it in an `alert()`. The SMTP transport is implemented for Gmail (STARTTLS on port 587 or TLS on port 465) using `cloudflare:sockets`. Real email delivery is not verified until an operator completes the test below with a valid rotated App Password.

## Flow
Everything goes through the existing `POST /api/portal` endpoint and the existing `users` / `sessions` tables and `js_session` cookie.

| action | body | result |
|---|---|---|
| `requestOtp` | `{mode:"signup", email, name, phone, role}` or `{mode:"login", email, role?}` | Emails a 6-digit code. Returns `{challengeId, maskedEmail, expiresIn, resendIn, resendsLeft}` and **never the code** |
| `resendOtp` | `{challengeId, email}` | Sends a new code (the old one stops working). Subject to cooldown and a resend limit |
| `verifyOtp` | `{challengeId, email, otp}` | Uses up the code, creates the user (signup) or updates the role (login), and sets the `js_session` cookie (HttpOnly, 7 days) |
| `logout` | `{}` | Deletes the session |

`GET /api/portal?action=session` returns the signed-in user (it is now joined with `users`).

The roles Citizen, University, Industry and Government are checked against an allow-list on the server.

## Security
- The code is generated with `crypto.getRandomValues` and rejection sampling, so every 6-digit value is equally likely.
- Only `HMAC-SHA256(OTP_SECRET, challengeId:email:otp)` is stored, in `otp_challenges`. The plain code is never stored, logged or returned by the API.
- Codes expire after 5 minutes (`OTP_EXPIRY_SECONDS`).
- Each code works once: it is consumed by an atomic conditional `UPDATE`. Requesting a new code invalidates earlier ones.
- After 5 wrong attempts (`OTP_MAX_ATTEMPTS`) the code is locked. The attempt is counted atomically before the comparison, and the comparison is constant-time.
- Resending has a 60 s cooldown (`OTP_RESEND_COOLDOWN_SECONDS`) and a limit of 3 (`OTP_MAX_RESENDS`). There are also hourly caps per email and per IP.
- All credentials come from environment variables or Worker secrets only. If they are missing, the endpoint returns HTTP 503.

## Setup
1. `openssl rand -hex 32` → `OTP_SECRET`
2. Gmail: turn on 2-Step Verification, then create an App Password → `SMTP_USER` / `SMTP_PASSWORD`
   (the FOC names `SENDER_EMAIL` / `SENDER_APP_PASSWORD` also work)
3. Local: configure the ignored root `.dev.vars`; `pnpm start` reads this file through `wrangler.local.jsonc`. `.env.local` is not the source for `pnpm start`. Production: set credentials as Worker secrets, not config vars.
4. Run `pnpm smtp:preflight` to validate required settings without network access or printing values.
5. Apply `drizzle/0006_email_otp.sql`

Port 25 is blocked for outbound Worker sockets. Use 587 (starttls) or 465 (tls).

## Safe Gmail delivery test
1. Rotate any App Password that was exposed. Do not paste it into chat, commands, logs, or reports.
2. In the ignored root `.dev.vars`, set `EMAIL_TEST_MODE=real`, `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_SECURITY=starttls`, `SMTP_USER` to the Gmail account, `SMTP_PASSWORD` to the replacement App Password, `OTP_FROM_EMAIL` to that account, and `OTP_SECRET` to a random value of at least 32 characters. Keep the App Password local; Gmail's displayed spaces are accepted.
3. Run `pnpm smtp:preflight`. Continue only when it reports `READY`.
4. Run `pnpm build`, then `pnpm start`. Open the printed local URL, create an account with an email address you control, and submit the OTP request.
5. Confirm the email arrives, enter the code, and confirm the portal signs in. Stop the local Worker when finished.

The preflight checks configuration only. The successful arrival and verification of an actual message is the evidence of real delivery; a passing mock smoke test is not.
