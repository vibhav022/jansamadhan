declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    MAPPLS_ACCESS_TOKEN?: string;

    // Email OTP (server-only secrets; see .env.example)
    OTP_SECRET?: string;
    SMTP_HOST?: string;
    SMTP_PORT?: string;
    SMTP_SECURITY?: string;
    SMTP_USER?: string;
    SMTP_PASSWORD?: string;
    SMTP_TIMEOUT_MS?: string;
    EMAIL_TEST_MODE?: string;
    TEST_MODE?: string;
    SENDER_EMAIL?: string;
    SENDER_APP_PASSWORD?: string;
    OTP_FROM_EMAIL?: string;
    OTP_FROM_NAME?: string;
    OTP_EXPIRY_SECONDS?: string;
    OTP_RESEND_COOLDOWN_SECONDS?: string;
    OTP_MAX_ATTEMPTS?: string;
    OTP_MAX_RESENDS?: string;
    OTP_MAX_SENDS_PER_HOUR?: string;
    OTP_MAX_SENDS_PER_IP_PER_HOUR?: string;
  }
}
