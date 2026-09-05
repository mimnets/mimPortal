// @vitest-environment jsdom

/**
 * The media picker's focus trap, against the three-part contract its own comment sets out:
 * focus moves in on open, Tab and Shift+Tab cycle within, and the previously focused element
 * gets focus back on close.
 *
 * `aria-modal` tells a screen reader that everything outside the dialog is not there. Before
 * this trap existed the attribute was a claim the keyboard contradicted — Tab walked straight
 * out into an Editor the reader had just been told did not exist. That is the regression
 * these assertions exist to catch, and it is invisible to any test that does not press keys.
 *
 * One caveat, stated rather than hidden: the trap filters its focusable elements on
 * `offsetParent !== null` to skip ones that are not visible. jsdom performs no layout, so
 * `offsetParent` is null for everything and the filter would empty the list for reasons that
 * have nothing to do with the code. The stub below restores the *attached to the document*
 * meaning of `offsetParent` so the cycling logic can be tested; the visibility filter itself
 * is not covered here and still needs a browser.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MediaBrowser, MediaProvider, type MediaBridge, type MediaItem } from "./media";

function item(id: string, filename: string): MediaItem {
  return {
    id,
    key: `uploads/${id}`,
    url: `/media/uploads/${id}`,
    filename,
    contentType: "image/png",
    size: 1024,
    width: 800,
    height: 600,
    alt: filename,
    createdAt: "2026-09-05T00:00:00.000Z",
  };
}

const bridge: MediaBridge = {
  list: async () => [item("a", "roof.png"), item("b", "ledger.png")],
  upload: async () => item("c", "new.png"),
  baseUrl: "/media",
};

/**
 * The picker as an Author actually reaches it: a trigger that already has focus, and a dialog
 * that mounts afterwards. The order matters — the trap captures what to return focus to when
 * it mounts, so a test that focuses the trigger after opening is testing a sequence that
 * cannot happen and would let a broken return path pass.
 */
function Harness({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <button type="button" data-testid="trigger">
        Choose an image
      </button>
      {open ? (
        <MediaProvider value={bridge}>
          <MediaBrowser onPick={vi.fn()} onClose={onClose} />
        </MediaProvider>
      ) : null}
    </>
  );
}

function openPicker(onClose = vi.fn()) {
  const result = render(<Harness open={false} onClose={onClose} />);
  screen.getByTestId("trigger").focus();
  result.rerender(<Harness open onClose={onClose} />);

  const close = () => result.rerender(<Harness open={false} onClose={onClose} />);
  return { ...result, onClose, close };
}

let originalOffsetParent: PropertyDescriptor | undefined;

beforeEach(() => {
  originalOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetParent");
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get(this: HTMLElement) {
      return this.isConnected ? document.body : null;
    },
  });
});

afterEach(() => {
  if (originalOffsetParent) {
    Object.defineProperty(HTMLElement.prototype, "offsetParent", originalOffsetParent);
  } else {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetParent;
  }
  cleanup();
  vi.restoreAllMocks();
});

/** Every stop the trap considers, in the order it considers them. */
function stops(dialog: Element): HTMLElement[] {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

describe("the media picker's focus trap", () => {
  it("moves focus into the dialog when it opens", async () => {
    const { container } = openPicker();
    const dialog = container.querySelector('[aria-modal="true"]') ?? container.firstElementChild!;

    await waitFor(() => {
      expect(stops(dialog).length).toBeGreaterThan(0);
    });

    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("wraps forward from the last stop to the first", async () => {
    const { container } = openPicker();
    const dialog = container.querySelector('[aria-modal="true"]') ?? container.firstElementChild!;

    await waitFor(() => expect(stops(dialog).length).toBeGreaterThan(1));

    const all = stops(dialog);
    const first = all[0]!;
    const last = all[all.length - 1]!;

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(first);
  });

  it("wraps backward from the first stop to the last", async () => {
    const { container } = openPicker();
    const dialog = container.querySelector('[aria-modal="true"]') ?? container.firstElementChild!;

    await waitFor(() => expect(stops(dialog).length).toBeGreaterThan(1));

    const all = stops(dialog);
    const first = all[0]!;
    const last = all[all.length - 1]!;

    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(last);
  });

  it("takes the Tab press over rather than letting the browser act on it", async () => {
    const { container } = openPicker();
    const dialog = container.querySelector('[aria-modal="true"]') ?? container.firstElementChild!;

    await waitFor(() => expect(stops(dialog).length).toBeGreaterThan(1));

    const all = stops(dialog);
    all[all.length - 1]!.focus();

    // The wrap only holds because the default action is cancelled — without this the browser
    // moves focus onward *as well*, out of the dialog and into the Editor behind it. jsdom
    // does not implement native Tab movement, so asserting on `activeElement` alone would
    // pass whether or not this call happens; the cancellation is the observable part.
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    document.dispatchEvent(tab);

    expect(tab.defaultPrevented).toBe(true);
  });

  it("closes on Escape", async () => {
    const { container, onClose } = openPicker();
    const dialog = container.querySelector('[aria-modal="true"]') ?? container.firstElementChild!;

    await waitFor(() => expect(stops(dialog).length).toBeGreaterThan(0));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });

  it("gives focus back to whatever opened it", async () => {
    const { container, close } = openPicker();
    const dialog = container.querySelector('[aria-modal="true"]') ?? container.firstElementChild!;
    const trigger = screen.getByTestId("trigger");

    await waitFor(() => expect(stops(dialog).length).toBeGreaterThan(0));

    // The trap took focus off the trigger when it opened; that is the first half of this.
    expect(document.activeElement).not.toBe(trigger);

    close();

    // An Author who opens the picker from an image field is back at that field, not at the
    // top of the page.
    expect(document.activeElement).toBe(trigger);
  });
});
