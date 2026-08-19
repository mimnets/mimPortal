"use client";

import { useState } from "react";

import type { Field, FieldsShape } from "@mimnets/core";

import { Assist } from "./Assist";
import { useAssist } from "./assist-context";
import { MediaBrowser, useMedia } from "./media";

/**
 * Renders one editable field from its declaration. This is the only place a Block's form
 * is built: nothing hand-writes a form per Block Type, which is what keeps adding a Block
 * to minutes of work.
 */

interface FieldInputProps {
  field: Field;
  name: string;
  value: unknown;
  onChange: (value: unknown) => void;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function RepeaterItem({
  fields,
  value,
  onChange,
}: {
  fields: FieldsShape;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  return (
    <div className="mn-repeater-fields">
      {Object.entries(fields).map(([key, field]) => (
        <FieldInput
          key={key}
          name={key}
          field={field}
          value={value[key]}
          onChange={(next) => onChange({ ...value, [key]: next })}
        />
      ))}
    </div>
  );
}

export function FieldInput({ field, name, value, onChange }: FieldInputProps) {
  const id = `field-${name}`;

  switch (field.kind) {
    case "textarea":
      return (
        <label className="mn-field" htmlFor={id}>
          <span>{field.label}</span>
          <textarea
            id={id}
            rows={6}
            value={String(value ?? "")}
            onChange={(event) => onChange(event.target.value)}
          />
          {field.help ? <small>{field.help}</small> : null}
          <AssistRow kind="textarea" field={field} value={value} onChange={onChange} />
        </label>
      );

    case "select":
      return (
        <label className="mn-field" htmlFor={id}>
          <span>{field.label}</span>
          <select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      );

    case "number":
      return (
        <label className="mn-field" htmlFor={id}>
          <span>{field.label}</span>
          <input
            id={id}
            type="number"
            value={Number(value ?? 0)}
            onChange={(event) => onChange(event.target.valueAsNumber)}
          />
        </label>
      );

    case "boolean":
      return (
        <label className="mn-field mn-field-inline" htmlFor={id}>
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span>{field.label}</span>
        </label>
      );

    case "image":
      return <ImageField field={field} id={id} value={value} onChange={onChange} />;

    case "link": {
      const link = asRecord(value);
      return (
        <fieldset className="mn-field-group">
          <legend>{field.label}</legend>
          <label className="mn-field" htmlFor={`${id}-label`}>
            <span>Label</span>
            <input
              id={`${id}-label`}
              value={String(link.label ?? "")}
              onChange={(event) => onChange({ ...link, label: event.target.value })}
            />
          </label>
          <label className="mn-field" htmlFor={`${id}-href`}>
            <span>Destination</span>
            <input
              id={`${id}-href`}
              value={String(link.href ?? "")}
              onChange={(event) => onChange({ ...link, href: event.target.value })}
            />
          </label>
          <label className="mn-field mn-field-inline" htmlFor={`${id}-newtab`}>
            <input
              id={`${id}-newtab`}
              type="checkbox"
              checked={Boolean(link.newTab)}
              onChange={(event) => onChange({ ...link, newTab: event.target.checked })}
            />
            <span>Open in a new tab</span>
          </label>
        </fieldset>
      );
    }

    case "repeater": {
      const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      const fields = field.fields ?? {};

      const replace = (next: Record<string, unknown>[]) => onChange(next);
      const move = (from: number, to: number) => {
        if (to < 0 || to >= items.length) return;
        const next = [...items];
        const [moved] = next.splice(from, 1);
        if (moved) next.splice(to, 0, moved);
        replace(next);
      };

      return (
        <fieldset className="mn-field-group">
          <legend>{field.label}</legend>
          {items.map((item, index) => (
            // Repeater items are positional and have no identity of their own.
            // eslint-disable-next-line react/no-array-index-key
            <div className="mn-repeater-item" key={index}>
              <div className="mn-repeater-bar">
                <span>#{index + 1}</span>
                <span>
                  <button type="button" onClick={() => move(index, index - 1)} aria-label="Move up">
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, index + 1)}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => replace(items.filter((_, i) => i !== index))}
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </span>
              </div>
              <RepeaterItem
                fields={fields}
                value={item}
                onChange={(next) => replace(items.map((old, i) => (i === index ? next : old)))}
              />
            </div>
          ))}
          <button
            type="button"
            className="mn-button"
            onClick={() => {
              const blank = Object.fromEntries(
                Object.entries(fields).map(([key, sub]) => [key, sub.schema.parse(undefined)]),
              );
              replace([...items, blank]);
            }}
          >
            Add item
          </button>
        </fieldset>
      );
    }

    case "text":
    default:
      return (
        <label className="mn-field" htmlFor={id}>
          <span>{field.label}</span>
          <input
            id={id}
            value={String(value ?? "")}
            onChange={(event) => onChange(event.target.value)}
          />
          {field.help ? <small>{field.help}</small> : null}
          <AssistRow kind="text" field={field} value={value} onChange={onChange} />
        </label>
      );
  }
}

/**
 * An image is chosen from the Site's library, not typed as a URL.
 *
 * Pasting a URL was fine while images lived somewhere else; now that a Site owns its files,
 * a text box would only invite links to images that vanish. When no library is wired up the
 * field falls back to showing the raw key, so the Editor still works in isolation.
 */
function ImageField({
  field,
  id,
  value,
  onChange,
}: {
  field: Field;
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const media = useMedia();
  const [browsing, setBrowsing] = useState(false);
  const image = asRecord(value);
  const key = String(image.key ?? "");

  return (
    <fieldset className="mn-field-group">
      <legend>{field.label}</legend>

      {key ? (
        <div className="mn-image-chosen">
          <img src={`${media?.baseUrl ?? "/media"}/${key}`} alt="" />
          <span className="mn-media-meta">
            {typeof image.width === "number" && typeof image.height === "number"
              ? `${image.width}×${image.height}`
              : "size unknown"}
          </span>
        </div>
      ) : (
        <p className="mn-media-empty">No image chosen.</p>
      )}

      {media ? (
        <div className="mn-image-actions">
          <button type="button" className="mn-button" onClick={() => setBrowsing(true)}>
            {key ? "Replace" : "Choose image"}
          </button>
          {key ? (
            <button
              type="button"
              className="mn-button"
              onClick={() => onChange({ key: "", alt: "", width: null, height: null })}
            >
              Remove
            </button>
          ) : null}
        </div>
      ) : (
        <label className="mn-field" htmlFor={`${id}-key`}>
          <span>Storage key</span>
          <input
            id={`${id}-key`}
            value={key}
            onChange={(event) => onChange({ ...image, key: event.target.value })}
          />
        </label>
      )}

      <label className="mn-field" htmlFor={`${id}-alt`}>
        <span>Alt text</span>
        <input
          id={`${id}-alt`}
          value={String(image.alt ?? "")}
          onChange={(event) => onChange({ ...image, alt: event.target.value })}
        />
        <small>Describe what the image shows. Leave empty only if it is decorative.</small>
      </label>

      {browsing ? (
        <MediaBrowser
          onClose={() => setBrowsing(false)}
          onPick={(item) => {
            // The library's description is the starting point, not a replacement for one the
            // Author has already written for this particular placement.
            onChange({
              key: item.key,
              alt: String(image.alt ?? "") || item.alt,
              width: item.width,
              height: item.height,
            });
            setBrowsing(false);
          }}
        />
      ) : null}
    </fieldset>
  );
}

/**
 * Draws the assistant under a field, or nothing at all when the Site has no provider
 * configured. A button that always fails is worse than no button.
 */
function AssistRow({
  kind,
  field,
  value,
  onChange,
}: {
  kind: "text" | "textarea";
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const assist = useAssist();
  if (!assist?.enabled) return null;

  return (
    <Assist
      kind={kind}
      value={String(value ?? "")}
      fieldLabel={field.label}
      pageTitle={assist.pageTitle}
      siteName={assist.siteName}
      onChange={onChange}
    />
  );
}
