# JanSamadhan - real-work setup

## Implemented
- Real server-side email OTP authentication (see `docs/EMAIL_OTP.md`).
- HttpOnly 7-day session cookie stored in D1.
- Real OpenStreetMap + Leaflet interactive map with browser geolocation.
- Village search via OpenStreetMap Nominatim.
- Village profile combines real geodata with challenges stored in the portal.
- Challenge data is persisted in D1; no hardcoded OTP remains.

## Required production configuration
Set these secrets in the deployment environment (see `.env.example`):
- `OTP_SECRET` (>= 32 random chars), `SMTP_USER`, `SMTP_PASSWORD`
- optional: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURITY`, `OTP_FROM_EMAIL`, `OTP_FROM_NAME`, OTP policy values

Apply the D1 migrations `drizzle/0004_real_work.sql`, `0005_collaboration.sql` and `0006_email_otp.sql` before using login.

## Important
Village population/facility statistics are deliberately not fabricated. To show official census or departmental statistics, connect an authoritative government dataset/API and map its fields into a village table.

## New collaboration features
- Problem Solver Hub with real challenge discovery.
- Email-OTP-authenticated one-support-per-user voting on challenges.
- University/industry solution proposal submission stored in D1.
- Proposal notifications routed to Government.
- Persistent proposal and support counts loaded from D1.

## Deployment checklist
1. Apply migrations including `drizzle/0005_collaboration.sql` and `drizzle/0006_email_otp.sql`.
2. Set the email OTP secrets listed above.
4. Deploy the Worker/site with the D1 `DB` binding.
5. Test: OTP login -> report challenge -> Map -> Solver Hub -> support/proposal -> Government workflow -> Implemented.

The portal deliberately does not fabricate village population or facility statistics. Add an authoritative government dataset before displaying those fields.
