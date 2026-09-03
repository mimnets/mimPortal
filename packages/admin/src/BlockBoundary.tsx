"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Keeps one Block's failure to that Block.
 *
 * A Block Type's `render` is arbitrary code — a Site writes its own — and in the Editor it
 * runs on *partially typed* props on every keystroke. A URL field holding "h" while somebody
 * types "https://…" is enough, if the Block calls `new URL()` on it.
 *
 * Without this, that throw unmounted the whole Editor. The layout lives in a `useReducer`
 * and there is no autosave, so unmounting did not merely show an error — it took the
 * Author's unsaved work with it. Everything they had done since the last save was gone
 * because a component was mid-keystroke.
 *
 * React error boundaries have to be class components; that is the only reason this is one.
 *
 * Recovery is automatic. `resetKey` changes whenever the Block's own props change, so the
 * next keystroke that makes the props valid again renders the Block rather than leaving the
 * Author staring at a message about a problem they have already fixed.
 */
export class BlockBoundary extends Component<
  { resetKey: string; label: string; children: ReactNode },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidUpdate(previous: { resetKey: string }) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // The Author gets a sentence; whoever wrote the Block gets the stack.
    console.error(`[mimnets] The "${this.props.label}" Block threw while rendering.`, error, info);
  }

  override render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="mn-block-error" role="status">
        <strong>This Block could not be drawn.</strong>
        <p>
          Its settings are on the right, and the Site itself is fine — nothing has been saved
          or published. Changing a field usually fixes it; deleting the Block always does.
        </p>
        <code>{this.state.error.message}</code>
      </div>
    );
  }
}
