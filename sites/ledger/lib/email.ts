import { resendEmail, smtpEmail, unconfiguredEmail, type EmailAdapter } from "@mimnets/core/email";

/**
 * How this Site sends mail, decided once from the environment.
 *
 * Resend first, SMTP second, and neither if nothing is set. An unconfigured Site is a
 * supported state rather than an error: the contact form still records every enquiry, and
 * the Dashboard is where they are read. See docs/EMAIL.md for setting either up.
 */

let cached: EmailAdapter | null = null;

export function email(): EmailAdapter {
  if (cached) return cached;

  const from = process.env.EMAIL_FROM;
  const resendKey = process.env.RESEND_API_KEY;

  if (resendKey) {
    if (!from) {
      throw new Error(
        "RESEND_API_KEY is set but EMAIL_FROM is not. Resend needs a verified sender, " +
          'for example EMAIL_FROM="Acme <hello@acme.com>".',
      );
    }
    cached = resendEmail({ apiKey: resendKey, from });
    return cached;
  }

  const host = process.env.SMTP_HOST;
  if (host) {
    // A half-configured mail server fails at boot rather than on a visitor's enquiry.
    const missing = Object.entries({
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASSWORD: process.env.SMTP_PASSWORD,
      EMAIL_FROM: from,
    })
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(`SMTP is partly configured. Missing: ${missing.join(", ")}.`);
    }

    cached = smtpEmail({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      user: process.env.SMTP_USER!,
      password: process.env.SMTP_PASSWORD!,
      from: from!,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : undefined,
    });
    return cached;
  }

  cached = unconfiguredEmail();
  return cached;
}

/** Where enquiries go when a contact Block does not name its own recipient. */
export function defaultRecipient(): string | null {
  return process.env.CONTACT_RECIPIENT || null;
}
