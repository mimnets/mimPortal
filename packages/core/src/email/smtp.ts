import { createTransport } from "nodemailer";

import { looksLikeEmail, type EmailAdapter, type EmailMessage } from "./adapter";

/**
 * Any SMTP server: a mailbox the Owner already has, or a relay on the same VPS.
 *
 * This is the self-hosted path, the counterpart to the local disk in storage. It is also the
 * one with a deliverability cost that is worth stating plainly: mail sent through a shared
 * host's SMTP is far more likely to land in spam than mail sent through a transactional
 * provider, and a client's enquiry notification arriving in Junk is the same as it not
 * arriving. Use it when a provider is not an option, not as the first choice.
 *
 * Unlike the rest of Mimnets this leans on a dependency. Writing an SMTP client by hand
 * means TLS negotiation and four authentication mechanisms, which is a different kind of
 * risk from signing an HTTP request.
 */
export function smtpEmail(options: {
  host: string;
  port: number;
  user: string;
  password: string;
  /** The From address. Many servers reject anything that is not the authenticated mailbox. */
  from: string;
  /** True for implicit TLS on 465. Port 587 upgrades with STARTTLS and wants this false. */
  secure?: boolean;
}): EmailAdapter {
  const transport = createTransport({
    host: options.host,
    port: options.port,
    secure: options.secure ?? options.port === 465,
    auth: { user: options.user, pass: options.password },
  });

  return {
    name: `SMTP (${options.host})`,
    configured: true,

    async send(message: EmailMessage) {
      if (!looksLikeEmail(message.to)) {
        throw new Error(`${JSON.stringify(message.to)} is not an email address.`);
      }

      await transport.sendMail({
        from: options.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        replyTo: message.replyTo,
      });
    },
  };
}
