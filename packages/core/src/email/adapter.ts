/**
 * How a Site sends mail.
 *
 * The same shape as the StorageAdapter, and for the same reason: a Site picks one
 * implementation from its environment and nothing above this interface knows which. A
 * contact form and a password reset both call `send` and neither knows whether the message
 * left through an API or a mail server.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain text. Every message has one, because a text-only client is still a client. */
  text: string;
  /** Optional HTML alternative. */
  html?: string;
  /** Where a reply should go, when that differs from the Site's own address. */
  replyTo?: string;
}

export interface EmailAdapter {
  /** Names the implementation, so the Dashboard can say how mail is leaving. */
  readonly name: string;
  /** True when the Site is actually configured to send. */
  readonly configured: boolean;
  send(message: EmailMessage): Promise<void>;
}

/**
 * The adapter a Site has before anybody configures mail.
 *
 * It accepts messages and drops them, deliberately and loudly in the logs. A contact form
 * on an unconfigured Site still records every enquiry in the database — losing the
 * notification is recoverable, and refusing the submission would lose the enquiry itself,
 * which is the one thing that must not happen.
 */
export function unconfiguredEmail(): EmailAdapter {
  return {
    name: "not configured",
    configured: false,
    async send(message) {
      console.warn(
        `[mimnets] No email is configured, so this message was not sent: ` +
          `"${message.subject}" to ${message.to}. ` +
          `Set RESEND_API_KEY or the SMTP_* variables to send mail.`,
      );
    },
  };
}

/** A very small check, to catch a mistyped recipient before an adapter is asked to send. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
