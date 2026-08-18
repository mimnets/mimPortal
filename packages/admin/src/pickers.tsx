"use client";

import { useEffect, useRef, useState } from "react";

import type { BlockRegistry, ColumnLayout } from "@mimnets/core";
import { COLUMN_LAYOUTS } from "@mimnets/core";

import { BlockIcon, ICONS_BY_BLOCK, PlusIcon } from "./icons";

/**
 * Adding a Block used to be a native <select> reading "+ Add Block". A picker that shows
 * what each Block is — name and glyph — is the difference between an Author browsing and an
 * Author guessing.
 */
export function BlockPicker({
  registry,
  onPick,
  label = "Add Block",
}: {
  registry: BlockRegistry;
  onPick: (name: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocumentPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDocumentPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocumentPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="mn-picker" ref={root}>
      <button
        type="button"
        className="mn-picker-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <PlusIcon />
        <span>{label}</span>
      </button>

      {open ? (
        <div className="mn-picker-menu" role="menu">
          {registry.blocks.map((blockType) => {
            const Glyph = ICONS_BY_BLOCK[blockType.name] ?? BlockIcon;
            return (
              <button
                key={blockType.name}
                type="button"
                role="menuitem"
                className="mn-picker-item"
                onClick={(event) => {
                  event.stopPropagation();
                  onPick(blockType.name);
                  setOpen(false);
                }}
              >
                <span className="mn-picker-glyph">
                  <Glyph />
                </span>
                <span>{blockType.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Column layouts drawn as the proportions they produce. "2-1" means nothing on first
 * reading; two bars, one twice the width of the other, means it immediately.
 */
export function LayoutPicker({
  value,
  onChange,
  compact = false,
}: {
  value: ColumnLayout;
  onChange: (layout: ColumnLayout) => void;
  compact?: boolean;
}) {
  return (
    <div className={`mn-layouts${compact ? " is-compact" : ""}`} role="radiogroup" aria-label="Column layout">
      {(Object.keys(COLUMN_LAYOUTS) as ColumnLayout[]).map((layout) => (
        <button
          key={layout}
          type="button"
          role="radio"
          aria-checked={value === layout}
          aria-label={`${COLUMN_LAYOUTS[layout].length} columns, ${layout}`}
          title={layout}
          className={`mn-layout${value === layout ? " is-active" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            onChange(layout);
          }}
        >
          {COLUMN_LAYOUTS[layout].map((ratio, index) => (
            // Bars are positional, and the ratios within a layout never reorder.
            // eslint-disable-next-line react/no-array-index-key
            <span key={index} className="mn-layout-bar" style={{ flexGrow: ratio }} />
          ))}
        </button>
      ))}
    </div>
  );
}
