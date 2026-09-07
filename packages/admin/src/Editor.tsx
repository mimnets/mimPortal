"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useEffect, useReducer, useState, type ReactNode } from "react";

import type { BlockRegistry, PageLayout, RenderContext, SlotName } from "@mimnets/core";
import { emptyContext } from "@mimnets/core";

import { History, type PageVersionSummary } from "./History";
import { AssistProvider, type AssistSettings } from "./assist-context";
import { MediaProvider, type MediaBridge } from "./media";
import { BlueprintProvider, type BlueprintBridge } from "./blueprints";
import { RedoIcon, SaveIcon, UndoIcon } from "./icons";
import { Preview, PREVIEW_VIEWPORTS, type PreviewViewport } from "./Preview";
import { SettingsPanel } from "./SettingsPanel";
import {
  canRedo,
  canUndo,
  editorReducer,
  findBlockPath,
  findColumnTarget,
  findSectionPath,
  initialState,
} from "./state";

export interface EditorProps {
  layout: PageLayout;
  registry: BlockRegistry;
  pageTitle: string;
  /**
   * Persists the draft. Throwing here surfaces the message to the Author.
   *
   * Takes the revision the Editor is working from and returns the one it just wrote, so a
   * tab that has been open while somebody else edited is refused rather than silently
   * replacing their work. A consumer with nothing to guard passes and returns nothing.
   */
  onSave: (layout: PageLayout, expectedRevision: number | null) => Promise<number | void>;
  /**
   * Publishes the draft and returns the version list as it now stands, so the panel stays
   * accurate without the Editor knowing anything about routing or revalidation.
   */
  onPublish: (layout: PageLayout, expectedRevision: number | null) => Promise<PublishResult>;
  /** The Page's revision when this Editor opened. Absent for a shared Slot, which has none. */
  revision?: number | null;
  /** Loads an old version back into the draft. */
  onRestore: (versionId: string) => Promise<PageLayout>;
  versions: PageVersionSummary[];
  /** Slots this person may not change. Empty for an Owner. */
  lockedSlots?: SlotName[];
  /** Why each locked Slot is locked, when "the Owner did it" is not the reason. */
  slotNotes?: Partial<Record<SlotName, string>>;
  /** Restrict the Editor to certain Slots. Used when editing a shared Header on its own. */
  visibleSlots?: SlotName[];
  /** Overrides the Publish button, which a shared Slot does not have. */
  saveLabel?: string;
  hidePublish?: boolean;
  /** Menus and Site name, resolved by the server so the preview matches the public Site. */
  context?: RenderContext;
  signedInAs?: string;
  onSignOut?: () => Promise<void>;
  /**
   * The Site's media library. Absent in isolation — the image field then shows a storage
   * key instead of a picker — and wired to server actions in a real Dashboard.
   */
  media?: MediaBridge;
  /**
   * Saved Sections an Author can drop into a Page. Absent hides the controls entirely,
   * the same way an absent media bridge leaves the image field showing a storage key.
   */
  blueprints?: BlueprintBridge;
  /**
   * Links back to the rest of the Dashboard.
   *
   * Passed in rather than built here, because the admin package does not know a Site's
   * routes. Without it the Editor is a room with no door: opening a Page left the browser's
   * back button as the only way to reach Pages, Media or anything else.
   */
  nav?: ReactNode;
  /**
   * Whether this Site has an AI provider configured. Absent or disabled hides the
   * assistant's buttons — one that always fails is worse than none.
   */
  assist?: AssistSettings;
}

export interface PublishResult {
  versions: PageVersionSummary[];
  /** The Page's revision after publishing, so the Editor keeps saving without a reload. */
  revision: number;
}

type Tab = "settings" | "history";

export function Editor({
  layout,
  registry,
  pageTitle,
  onSave,
  onPublish,
  onRestore,
  revision: openedAt = null,
  versions: initialVersions,
  lockedSlots = [],
  slotNotes,
  visibleSlots,
  saveLabel,
  hidePublish = false,
  context = emptyContext(),
  signedInAs,
  onSignOut,
  media,
  blueprints,
  nav,
  assist,
}: EditorProps) {
  const [state, dispatch] = useReducer(editorReducer, layout, initialState);
  const [status, setStatus] = useState<"idle" | "saving" | "publishing">("idle");
  const [message, setMessage] = useState<string | null>(null);
  // Not persisted, deliberately. Which width you last checked is a property of the
  // checking, not of the Page, and a Page that reopened at phone width would read as
  // broken rather than as remembered.
  const [viewport, setViewport] = useState<PreviewViewport>("full");
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState(initialVersions);
  const [tab, setTab] = useState<Tab>("settings");

  /**
   * Which revision of the Page this Editor is writing against. Sent with every save and
   * publish, and replaced by whatever the server says it wrote — so a long editing session
   * keeps working, while a tab left open across somebody else's edit is refused.
   */
  const [revision, setRevision] = useState<number | null>(openedAt);

  /**
   * Asks before an unsaved draft is thrown away.
   *
   * The layout lives in a reducer and there is no autosave, so closing the tab, going back,
   * or following a link loses everything since the last Save — and nothing said so. This is
   * the last line rather than the first: Blocks no longer navigate on click, and a Block that
   * throws no longer unmounts the Editor. It covers what neither of those can, which is an
   * Author who simply closes the window.
   *
   * The browser shows its own wording and ignores ours; only the fact that we asked matters.
   */
  useEffect(() => {
    if (!state.dirty) return;

    const ask = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [state.dirty]);

  /**
   * Ctrl+Z and Ctrl+Shift+Z, or their Cmd equivalents on a Mac.
   *
   * Ignored while the Author is typing, because a text field has its own undo stack and
   * taking Ctrl+Z away from it would be a worse trade than not having the shortcut at all —
   * the toolbar button is still there for the Block they just deleted. `isContentEditable`
   * is checked alongside the input tags so that a rich field added later is covered without
   * anyone remembering to come back here.
   */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;

      event.preventDefault();
      dispatch({ type: event.shiftKey ? "redo" : "undo" });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // A small distance before a drag begins, so clicking a Block to select it does not drag it.
  //
  // The keyboard sensor is not an extra: dnd-kit's drag handles already announce "To pick up
  // a sortable item, press the space bar" to a screen reader, and without this registered
  // that instruction was a lie. Reordering was the one thing a keyboard-only Author could
  // not do — they could add a Block and delete it, but never move it.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;

    if (activeId.startsWith("sec:")) {
      const from = findSectionPath(state.layout, activeId.slice(4));
      const to = overId.startsWith("sec:") ? findSectionPath(state.layout, overId.slice(4)) : null;
      // Sections move within their own Slot; a Header Section does not become a Footer one.
      if (from && to && from.slot === to.slot) {
        dispatch({ type: "moveSection", slot: from.slot, from: from.section, to: to.section });
      }
      return;
    }

    const from = findBlockPath(state.layout, activeId);
    if (!from) return;

    if (overId.startsWith("col:")) {
      const target = findColumnTarget(state.layout, overId.slice(4));
      if (!target) return;
      const blocks = state.layout.slots[target.slot][target.section]?.columns[target.column]?.blocks;
      dispatch({ type: "moveBlock", from, to: { ...target, index: blocks?.length ?? 0 } });
      return;
    }

    const over = findBlockPath(state.layout, overId);
    if (over) {
      dispatch({
        type: "moveBlock",
        from,
        to: { slot: over.slot, section: over.section, column: over.column, index: over.block },
      });
    }
  }

  /**
   * `submitted` is the document as it was when the button was pressed, which is what was
   * sent. It is passed back to the reducer so that an Author who carried on typing during
   * the request keeps their unsaved-changes state instead of being told they are safe.
   */
  async function run(
    kind: "saving" | "publishing",
    submitted: PageLayout,
    work: () => Promise<string>,
  ) {
    setStatus(kind);
    setError(null);
    setMessage(null);
    try {
      const result = await work();
      dispatch({ type: "saved", layout: submitted });
      setMessage(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong");
    } finally {
      setStatus("idle");
    }
  }

  const busy = status !== "idle";

  return (
    <MediaProvider value={media ?? null}>
      <BlueprintProvider value={blueprints ?? null}>
      <AssistProvider value={assist ?? null}>
      <div className="mn-ed">
        <header className="mn-ed-bar">
          <strong>{pageTitle}</strong>

          {nav ? <nav className="mn-dash-nav">{nav}</nav> : null}

          {/* Announced, not merely displayed. "Draft saved" in a bare span is invisible to
              anyone not looking at that corner of the screen — and pressing Save and being
              told nothing is how people learn to press it twice. `polite` because it must
              not interrupt whatever is being read; `atomic` so the whole sentence is spoken
              rather than the words that changed. */}
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={`mn-ed-state${error ? " is-error" : state.dirty ? " is-dirty" : ""}`}
          >
            {error ?? message ?? (state.dirty ? "Unsaved changes" : "All changes saved")}
          </span>

          {/* Columns stack on narrow screens without anybody authoring it, so until this
              existed an Author never saw the stacked result until they published. It is a
              real narrowing rather than a zoom: the frame is a CSS container and the Block
              stylesheet carries `@container` twins of its `@media` rules. */}
          <label className="mn-ed-viewport" htmlFor="preview-viewport">
            <span className="mn-visually-hidden">Preview width</span>
            <select
              id="preview-viewport"
              value={viewport}
              onChange={(event) => setViewport(event.target.value as PreviewViewport)}
              title="Preview width"
            >
              {PREVIEW_VIEWPORTS.map((name) => (
                <option key={name} value={name}>
                  {name === "full" ? "Full width" : name === "tablet" ? "Tablet" : "Phone"}
                </option>
              ))}
            </select>
          </label>

          {/* Before Save, because they are the pair an Author reaches for most and undo is
              the one that has to be findable in a hurry. Titled rather than labelled: the
              bar is already crowded, and both icons are conventional enough to read. */}
          <div className="mn-ed-undo">
            <button
              type="button"
              className="mn-button mn-button-icon"
              disabled={busy || !canUndo(state)}
              onClick={() => dispatch({ type: "undo" })}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              <UndoIcon />
            </button>
            <button
              type="button"
              className="mn-button mn-button-icon"
              disabled={busy || !canRedo(state)}
              onClick={() => dispatch({ type: "redo" })}
              title="Redo (Ctrl+Shift+Z)"
              aria-label="Redo"
            >
              <RedoIcon />
            </button>
          </div>

          <button
            type="button"
            className="mn-button"
            disabled={busy || !state.dirty}
            onClick={() =>
              run("saving", state.layout, async () => {
                const next = await onSave(state.layout, revision);
                if (typeof next === "number") setRevision(next);
                return "Draft saved";
              })
            }
          >
            <SaveIcon />
            {status === "saving" ? "Saving…" : (saveLabel ?? "Save draft")}
          </button>

          {signedInAs ? <span className="mn-ed-who">{signedInAs}</span> : null}

          {/* A shared Header has no draft and no history: it is edited in one place and
              every Page using it changes at once, the same as a Menu. Publishing it would
              mean a Page could be live while its Header is not, and there is no good answer
              to what a visitor should see then. */}
          {hidePublish ? null : (
            <button
              type="button"
              className="mn-button mn-button-primary"
              disabled={busy}
              onClick={() =>
                run("publishing", state.layout, async () => {
                  const result = await onPublish(state.layout, revision);
                  setVersions(result.versions);
                  setRevision(result.revision);
                  return "Published";
                })
              }
            >
              {status === "publishing" ? "Publishing…" : "Publish"}
            </button>
          )}

          {onSignOut ? (
            <button type="button" className="mn-button" onClick={() => void onSignOut()}>
              Sign out
            </button>
          ) : null}
        </header>

        {/* A fixed id keeps the aria-describedby ids dnd-kit generates stable between the
            server render and hydration; without it React reports a mismatch on every handle. */}
        <DndContext
          id="mimnets-editor"
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={handleDragEnd}
        >
          <div className="mn-ed-split">
            <Preview
              layout={state.layout}
              registry={registry}
              selection={state.selection}
              dispatch={dispatch}
              lockedSlots={lockedSlots}
              slotNotes={slotNotes}
              visibleSlots={visibleSlots}
              context={context}
              viewport={viewport}
            />

            <aside className="mn-ed-panel">
              <div className="mn-ed-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "settings"}
                  className={`mn-ed-tab${tab === "settings" ? " is-active" : ""}`}
                  onClick={() => setTab("settings")}
                >
                  Settings
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "history"}
                  className={`mn-ed-tab${tab === "history" ? " is-active" : ""}`}
                  onClick={() => setTab("history")}
                >
                  History{versions.length > 0 ? ` (${versions.length})` : ""}
                </button>
              </div>

              {tab === "settings" ? (
                <SettingsPanel
                  layout={state.layout}
                  registry={registry}
                  selection={state.selection}
                  dispatch={dispatch}
                />
              ) : (
                <History
                  versions={versions}
                  onRestore={async (versionId) => {
                    const restored = await onRestore(versionId);
                    dispatch({ type: "loadLayout", layout: restored });
                    setTab("settings");
                    setMessage("Version restored into the draft — publish to make it live");
                  }}
                />
              )}
            </aside>
          </div>
        </DndContext>
      </div>
      </AssistProvider>
      </BlueprintProvider>
    </MediaProvider>
  );
}
