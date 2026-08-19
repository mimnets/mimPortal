# Setting up email

A Site sends two kinds of message: a notification when somebody uses a contact form, and a
password reset link. Both go through the same `EmailAdapter`, so configuring it once covers
both.

**A Site with no email configured still works.** Every enquiry is written to the database
before anything is sent, and read in the Dashboard under **Enquiries**. Nothing is lost while
you are still deciding — you just do not get told when it arrives.

There are two implementations. Pick one.

| | Resend | SMTP |
| --- | --- | --- |
| Setup | An account, a verified domain, one API key | A mailbox you already have |
| Deliverability | Good, and it tells you when a message bounces | Varies, often poor from a shared host |
| Cost | Free tier covers a brochure Site comfortably | Whatever the mailbox costs |
| Use when | Anything a client is paying for | No provider is possible, or for local testing |

If you are setting up a Site for a client, use Resend. SMTP is the fallback for when that is
not an option — a client's enquiry landing in a Junk folder is the same as it never arriving.

---

## Option 1 — Resend

### 1. Create an account

Sign up at [resend.com](https://resend.com). The free tier is 3,000 emails a month, which is
far more than a brochure Site's contact form will produce.

### 2. Add and verify your domain

In the Resend dashboard, go to **Domains → Add Domain** and enter the domain the Site sends
*from* — usually the client's own domain, e.g. `acme.com`.

Resend gives you DNS records to add. Put them in whatever manages the domain's DNS
(Cloudflare, the registrar, the client's IT provider):

- **SPF** and **DKIM** records — these are what stop the mail being treated as forged. Both
  are required before Resend will send anything.
- A **DMARC** record is offered and is worth adding. It is what tells receiving servers what
  to do with mail that fails the other two.

Verification usually takes a few minutes; DNS can take longer. Resend shows the domain as
**Verified** when it is ready.

> You cannot skip this. Resend refuses to send from an unverified domain, and the Site will
> report the refusal on the enquiry rather than losing it.

### 3. Create an API key

**API Keys → Create API Key**. Give it **Sending access** only — it does not need permission
to read anything. Copy the key now; Resend shows it once.

### 4. Put it in the Site's environment

In `starter/.env`:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM="Acme <hello@acme.com>"
CONTACT_RECIPIENT=enquiries@acme.com
```

- `EMAIL_FROM` **must** be on the domain you verified. The display name is optional but
  worth setting — it is what appears in the client's inbox.
- `CONTACT_RECIPIENT` is where enquiries go when a contact Block does not name its own
  address. A Block's own **Send enquiries to** field overrides it, which is how one Site can
  route its sales form and its support form to different people.

Restart the Site. The Enquiries screen will say *notifications via Resend*.

---

## Option 2 — SMTP

Use any mailbox that allows SMTP sending. The settings come from whoever provides it.

### Common providers

| Provider | Host | Port | Notes |
| --- | --- | --- | --- |
| Fastmail | `smtp.fastmail.com` | 465 | Needs an app password |
| Gmail / Workspace | `smtp.gmail.com` | 587 | Needs 2FA on, then an app password |
| Microsoft 365 | `smtp.office365.com` | 587 | SMTP AUTH is often disabled by default |
| Mailgun / Postmark | provider's host | 587 | Their SMTP bridge, if you prefer it to an API |

### Use an app password, never the account password

Gmail, Fastmail and Microsoft 365 all issue a separate password scoped to mail sending. Use
one. It can be revoked without locking anybody out of their mailbox, and the real password
never ends up in a `.env` file on a server.

For Gmail: turn on 2-Step Verification, then **Google Account → Security → App passwords**.

### Configure the Site

```bash
SMTP_HOST=smtp.fastmail.com
SMTP_PORT=465
SMTP_USER=hello@acme.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM="Acme <hello@acme.com>"
CONTACT_RECIPIENT=enquiries@acme.com
```

**Ports.** 465 is implicit TLS and 587 upgrades with STARTTLS. The Site works this out from
the port number, so you rarely need `SMTP_SECURE`. Set `SMTP_SECURE=true` or `false` only if
your provider does something unusual.

**`EMAIL_FROM` usually has to match `SMTP_USER`.** Most servers reject mail sent from an
address the authenticated account does not own.

Restart the Site. The Enquiries screen will say *notifications via SMTP (your-host)*.

---

## Checking it works

1. Publish a Page with a contact Block.
2. Submit it as a visitor would.
3. The message appears under **Enquiries** in the Dashboard within a second — that part does
   not depend on email at all.
4. The notification arrives at `CONTACT_RECIPIENT`. Reply directly to it: the reply-to is set
   to whoever wrote in, so answering does not mean copying their address out of the message.

If the enquiry is listed but shows *Saved, but the notification did not send*, the reason is
on the row. The usual causes:

| What it says | What to do |
| --- | --- |
| `domain is not verified` | Finish the DNS step in Resend |
| `Invalid login` / `535` | Wrong password, or a real password where an app password is needed |
| `Missing credentials` | One of the four SMTP variables is unset |
| `EMAIL_FROM` rejected | The From address is not one the account is allowed to send as |
| Nothing arrives, no error | Check the spam folder, then check SPF and DKIM |

## Password resets

Nothing extra to configure. Once either option is set up, an Author who forgets their
password can reset it themselves. Before that, a Site has no way to send the link, and the
reset cannot complete.

## Where the settings live

Both options are read once at boot in `starter/lib/email.ts`. Resend wins if
`RESEND_API_KEY` is set; SMTP is used if `SMTP_HOST` is set; otherwise the Site runs
unconfigured and says so in the Dashboard.

A partly-filled configuration is treated as a mistake rather than ignored — a Site with
`SMTP_HOST` but no `SMTP_PASSWORD` refuses to start, instead of discovering the problem when
a customer's first enquiry disappears.
