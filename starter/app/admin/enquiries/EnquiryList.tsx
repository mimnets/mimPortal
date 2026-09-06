"use client";

import { useState, useTransition } from "react";

import type { Enquiry } from "../enquiry-actions";

/**
 * Everything the Site's forms have collected.
 *
 * This screen is the reason a failed notification is survivable. It exists so that "did the
 * email go out?" is never the same question as "did we lose the customer?".
 */
export function EnquiryList({
  enquiries: initial,
  canDelete,
  emailConfigured,
  emailName,
  onMarkRead,
  onDelete,
}: {
  enquiries: Enquiry[];
  canDelete: boolean;
  emailConfigured: boolean;
  emailName: string;
  onMarkRead: (id: string, read: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [items, setItems] = useState(initial);
  const [, startTransition] = useTransition();

  const unread = items.filter((one) => one.readAt === null).length;

  function toggleRead(item: Enquiry) {
    const read = item.readAt === null;
    startTransition(async () => {
      await onMarkRead(item.id, read);
      setItems((current) =>
        current.map((one) =>
          one.id === item.id ? { ...one, readAt: read ? new Date().toISOString() : null } : one,
        ),
      );
    });
  }

  function remove(item: Enquiry) {
    if (!confirm(`Delete this enquiry from ${item.name || item.email}? This is the only copy.`)) {
      return;
    }
    startTransition(async () => {
      await onDelete(item.id);
      setItems((current) => current.filter((one) => one.id !== item.id));
    });
  }

  return (
    <div className="mn-dash-body is-plain">
      <div className="mn-media-head">
        <strong>
          {items.length} enquir{items.length === 1 ? "y" : "ies"}
          {unread > 0 ? ` · ${unread} unread` : ""}
        </strong>
        <span className="mn-media-meta">
          {emailConfigured ? `notifications via ${emailName}` : "no email configured"}
        </span>
      </div>

      {!emailConfigured ? (
        <p className="mn-media-error">
          No email is configured, so nobody is notified when an enquiry arrives — they are
          only collected here. See <code>docs/EMAIL.md</code> to set up Resend or SMTP.
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="mn-media-empty">
          Nothing yet. Add a contact Block to a Page and publish it.
        </p>
      ) : (
        <ul className="mn-page-list">
          {items.map((item) => (
            <li
              key={item.id}
              className={`mn-enquiry${item.readAt === null ? " is-unread" : ""}`}
            >
              <div className="mn-enquiry-head">
                <strong>{item.name || "(no name)"}</strong>
                <a href={`mailto:${item.email}`}>{item.email}</a>
                <span className="mn-media-meta">
                  {new Date(item.createdAt).toLocaleString()} · {item.slug} · {item.path}
                </span>
              </div>

              {item.extra.length > 0 ? (
                /* Above the message on purpose: a phone number or a preferred date is what an
                   Owner scans for, and the message is what they then read. */
                <dl className="mn-enquiry-extra">
                  {item.extra.map((answer, index) => (
                    <div key={`${answer.label}-${index}`}>
                      <dt>{answer.label}</dt>
                      <dd>{answer.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              <p className="mn-enquiry-message">{item.message}</p>

              {item.deliveryError ? (
                <p className="mn-media-error">
                  Saved, but the notification did not send: {item.deliveryError}
                </p>
              ) : null}

              <div className="mn-image-actions">
                <button type="button" className="mn-button" onClick={() => toggleRead(item)}>
                  {item.readAt === null ? "Mark read" : "Mark unread"}
                </button>
                <a className="mn-button" href={`mailto:${item.email}`}>
                  Reply
                </a>
                {canDelete ? (
                  <button
                    type="button"
                    className="mn-button mn-button-danger"
                    onClick={() => remove(item)}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
