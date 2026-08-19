// Email is a server concern: it holds an API key and opens SMTP connections. It is
// deliberately not re-exported from "@mimnets/core", which the Editor imports in a browser.

export { unconfiguredEmail, looksLikeEmail } from "./adapter";
export type { EmailAdapter, EmailMessage } from "./adapter";
export { resendEmail } from "./resend";
export { smtpEmail } from "./smtp";
