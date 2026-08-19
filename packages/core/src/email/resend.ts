import { looksLikeEmail, type EmailAdapter, type EmailMessage } from "./adapter";

/**
 * Resend, over its HTTP API.
 *
 * No SDK: the API is one POST with a JSON body, and pulling in a client library to make it
 * would be the same trade the S3 adapter declined. This keeps a Site's install small and
 * its dependency list readable.
 */
export function resendEmail(options: {
  apiKey: string;
  /** The verified sender, e.g. `Acme <hello@acme.com>`. Resend rejects unverified domains. */
  from: string;
}): EmailAdapter {
  return {
    name: "Resend",
    configured: true,

    async send(message: EmailMessage) {
      if (!looksLikeEmail(message.to)) {
        throw new Error(`${JSON.stringify(message.to)} is not an email address.`);
      }

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: options.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
          reply_to: message.replyTo,
        }),
      });

      if (!response.ok) {
        // Resend's body says which domain is unverified or which field is wrong; a bare
        // status leaves an Owner with nothing to act on.
        throw new Error(`Resend refused the message (${response.status}): ${await response.text()}`);
      }
    },
  };
}
