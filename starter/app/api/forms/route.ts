import { and, count, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { FORM_FIELDS, FORM_RESULT_PARAM } from "@mimnets/core";
import { createDatabase, formSubmissions, siteSettings } from "@mimnets/core/db";
import { elapsedSince, hashIp, runSpamChecks, safeReturnPath } from "@mimnets/core/forms";

import { authSecret, baseUrl, requireDatabaseUrl } from "../../../lib/env";
import { email } from "../../../lib/email";
import { recipientForForm, replyToFor } from "../../../lib/forms";
import { RATE_LIMIT_WINDOW_MS, spamSignals } from "../../../lib/spam";

/**
 * Where a contact form posts.
 *
 * A route handler rather than a server action, because the form has to work with no
 * JavaScript at all — a plain <form method="post"> can only reach a URL. The reply is a
 * redirect back to the Page it came from, which is also what stops a refresh resubmitting.
 */
export const dynamic = "force-dynamic";

/** A visitor is never told which check objected; that is a tuning guide for whoever tripped it. */
function back(returnTo: string, result: string) {
  const target = new URL(safeReturnPath(returnTo), baseUrl());
  target.searchParams.set(FORM_RESULT_PARAM, result);
  return NextResponse.redirect(target, { status: 303 });
}

function senderAddress(request: Request): string {
  // Behind a proxy the socket address is the proxy's. The first hop in X-Forwarded-For is
  // the client, and it is only trustworthy because this Site is expected to sit behind one.
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  const form = await request.formData();
  const text = (name: string) => String(form.get(name) ?? "").trim();

  const slug = text(FORM_FIELDS.slug) || "contact";
  const returnTo = safeReturnPath(text(FORM_FIELDS.returnTo) || "/");
  const secret = authSecret();
  const db = createDatabase(requireDatabaseUrl());

  const senderHash = hashIp(senderAddress(request), secret);
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

  const verdict = await runSpamChecks(spamSignals, {
    fields: Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])),
    elapsedMs: elapsedSince(text(FORM_FIELDS.renderedAt) || undefined, secret, Date.now()),
    ipHash: senderHash,
    recentFromIp: async () => {
      const [row] = await db
        .select({ total: count() })
        .from(formSubmissions)
        .where(and(eq(formSubmissions.senderHash, senderHash), gt(formSubmissions.createdAt, since)));
      return row?.total ?? 0;
    },
  });

  if (verdict.rejected) {
    // Logged, never stored and never explained to the sender. A rejected submission that
    // filled the table would hand a flooder the resource the rate limit is protecting.
    console.warn(`[mimnets] Rejected a submission to "${slug}" — ${verdict.signal}: ${verdict.reason}`);
    return back(returnTo, `${slug}:error`);
  }

  const name = text("name");
  const senderEmail = text("email");
  const message = text("message");

  if (message === "" || senderEmail === "") return back(returnTo, `${slug}:error`);

  // The row is written before anything is sent. A mail server that is briefly unreachable
  // must cost a notification, never the enquiry itself.
  const [saved] = await db
    .insert(formSubmissions)
    .values({ slug, path: returnTo, name, email: senderEmail, message, senderHash })
    .returning({ id: formSubmissions.id });

  const [settings] = await db
    .select({ siteName: siteSettings.siteName })
    .from(siteSettings)
    .where(eq(siteSettings.id, "singleton"))
    .limit(1);

  const siteName = settings?.siteName || "your Site";

  // Never from the request. See lib/forms.ts — a visitor who can name the recipient owns the
  // Site's outbound mail.
  const recipient = await recipientForForm(slug);

  if (recipient) {
    try {
      await email().send({
        to: recipient,
        subject: `New enquiry from ${siteName}${name ? ` — ${name}` : ""}`,
        // Reply goes to the person who wrote in, so answering is one keystroke — when the
        // address is one. See lib/forms.ts: this is visitor input reaching a mail header.
        replyTo: replyToFor(senderEmail),
        text: [
          `${name || "Someone"} sent a message through ${siteName}.`,
          "",
          `From:    ${name || "(no name)"} <${senderEmail}>`,
          `Page:    ${new URL(returnTo, baseUrl()).toString()}`,
          "",
          message,
          "",
          "—",
          `Read it in the Dashboard: ${new URL("/admin/enquiries", baseUrl()).toString()}`,
        ].join("\n"),
      });
    } catch (cause) {
      // The visitor is still thanked: their message is saved, and the delivery problem is
      // the Site's to fix, recorded on the row so the Dashboard can say so.
      const reason = cause instanceof Error ? cause.message : "Sending failed.";
      console.error(`[mimnets] Enquiry ${saved?.id} saved but not delivered: ${reason}`);
      if (saved) {
        await db
          .update(formSubmissions)
          .set({ deliveryError: reason })
          .where(eq(formSubmissions.id, saved.id));
      }
    }
  }

  return back(returnTo, slug);
}
