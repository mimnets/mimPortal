import { isNotNull } from "drizzle-orm";
import type { BlockInstance, PageLayout } from "@mimnets/core";
import { createDatabase, pages, sharedSlots } from "@mimnets/core/db";

import { registry } from "../blocks.config";
import { looksLikeEmail } from "@mimnets/core/email";

import { defaultRecipient } from "./email";
import { requireDatabaseUrl } from "./env";
import { parseSections } from "./slots";

/**
 * Where an enquiry is sent, decided by the server.
 *
 * The contact Block carries a "Send enquiries to" field, and the form used to post it as a
 * hidden input. A hidden input is visitor input: anybody could name their own address and
 * have the Site deliver a message of their writing, from its own verified domain, to whoever
 * they liked. The address is now looked up here from the published Block whose form name
 * matches — the same place the Author set it, and the one place a visitor cannot reach.
 *
 * An unrecognised form name falls back to the Site's own address rather than being refused:
 * the enquiry is already stored by the time this is asked, and losing the notification for a
 * Page that is mid-publish would be a worse failure than a misfiled one.
 */

const CONTACT = "contact";
const DEFAULT_SLUG = "contact";

/**
 * The address a notification may be answered to, or nothing.
 *
 * Whoever filled in the form typed this, and it lands in a mail header. Headers are
 * line-delimited, so an interior CRLF is how somebody asked only for an email address writes
 * a second one — a Bcc, say. `looksLikeEmail` refuses all whitespace and so refuses that.
 *
 * The returned value is the *trimmed* one on purpose, and this function exists to make that
 * unavoidable. `looksLikeEmail` trims before testing, so a value with trailing whitespace
 * passes the check while the original still carries it; sending the original would mean the
 * string that was validated and the string that was sent were not the same string. They are
 * now, because only one of them ever leaves here.
 *
 * An address that fails is dropped rather than refused. The enquiry is already stored and the
 * Owner still receives it; what is lost is one-keystroke reply on a message from somebody who
 * typed something that was never an address.
 */
export function replyToFor(senderEmail: string): string | undefined {
  return looksLikeEmail(senderEmail) ? senderEmail.trim() : undefined;
}

interface ContactProps {
  slug?: unknown;
  recipient?: unknown;
  extras?: unknown;
}

/**
 * The questions this form asks, in order, from the published Block.
 *
 * The same rule as the recipient and for the same reason: an input's `name` comes back as
 * visitor input, so a posted answer is identified by its position and the question it belongs
 * to is read here. A visitor cannot invent a question, and cannot rename one.
 */
export function extraLabelsInSections(
  sections: PageLayout["slots"]["main"],
  slug: string,
): string[] | null {
  for (const section of sections) {
    for (const column of section.columns) {
      for (const block of column.blocks) {
        if (!isContactFor(block, slug)) continue;

        const { extras } = block.props as ContactProps;
        if (!Array.isArray(extras)) return [];

        return extras.map((one) => {
          const label = (one as { label?: unknown })?.label;
          return typeof label === "string" ? label : "";
        });
      }
    }
  }
  return null;
}

function isContactFor(block: BlockInstance, slug: string): boolean {
  if (block.type !== CONTACT) return false;
  const props = block.props as ContactProps;
  const named = typeof props.slug === "string" ? props.slug.trim() : "";
  return (named || DEFAULT_SLUG) === slug;
}

/**
 * Exported for its own test: this is the rule that replaced the hidden input, so it is worth
 * checking against a layout rather than only through a database.
 */
export function recipientInSections(
  sections: PageLayout["slots"]["main"],
  slug: string,
): string | null {
  for (const section of sections) {
    for (const column of section.columns) {
      for (const block of column.blocks) {
        if (!isContactFor(block, slug)) continue;
        const props = block.props as ContactProps;
        const recipient = typeof props.recipient === "string" ? props.recipient.trim() : "";
        if (recipient) return recipient;
      }
    }
  }
  return null;
}

/**
 * Everything the server needs to know about a form, from one pass over the published Site.
 *
 * One walk rather than two: both answers come from the same Block, and reading the layouts
 * twice to ask two questions about the same object would double the cost of every submission.
 */
export async function formSettingsForSlug(
  slug: string,
): Promise<{ recipient: string | null; labels: string[] }> {
  const db = createDatabase(requireDatabaseUrl());

  let recipient: string | null = null;
  let labels: string[] | null = null;

  const consider = (sections: PageLayout["slots"]["main"]) => {
    recipient ??= recipientInSections(sections, slug);
    labels ??= extraLabelsInSections(sections, slug);
  };

  // Published layouts only, for the reason `recipientForForm` gives: a form that is not on
  // the public Site cannot have been submitted from it.
  const rows = await db
    .select({ layout: pages.publishedLayout })
    .from(pages)
    .where(isNotNull(pages.publishedLayout));

  for (const row of rows) {
    const { layout } = registry.safeParseLayout(row.layout);
    for (const sections of Object.values(layout.slots)) consider(sections);
  }

  for (const row of await db.select().from(sharedSlots)) {
    const sections = parseSections(row);
    if (sections) consider(sections);
  }

  return { recipient: recipient ?? defaultRecipient(), labels: labels ?? [] };
}

export async function recipientForForm(slug: string): Promise<string | null> {
  const db = createDatabase(requireDatabaseUrl());

  // Published layouts only. A form that is not on the public Site cannot have been submitted
  // from it, so a draft must not be able to redirect a live Site's mail.
  const rows = await db
    .select({ layout: pages.publishedLayout })
    .from(pages)
    .where(isNotNull(pages.publishedLayout));

  for (const row of rows) {
    const { layout } = registry.safeParseLayout(row.layout);
    for (const sections of Object.values(layout.slots)) {
      const found = recipientInSections(sections, slug);
      if (found) return found;
    }
  }

  // A contact Block in a shared Header or Footer lives in its own row, not in any Page.
  for (const row of await db.select().from(sharedSlots)) {
    const sections = parseSections(row);
    if (!sections) continue;
    const found = recipientInSections(sections, slug);
    if (found) return found;
  }

  return defaultRecipient();
}
