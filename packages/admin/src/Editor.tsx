"use client";

import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useReducer, useState } from "react";

import type { BlockRegistry, PageLayout, SlotName } from "@mimnets/core";

import { History, type PageVersionSummary } from "./History";
import { SaveIcon } from "./icons";
import { Preview } from "./Preview";
import { SettingsPanel } from "./SettingsPanel";
import {
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
  /** Persists the draft. Throwing here surfaces the message to the Author. */
  onSave: (layout: PageLayout) => Promise<void>;
  /**
   * Publishes the draft and returns the version list as it now stands, so the panel stays
   * accurate without the Editor knowing anything about routing or revalidation.
   */
  onPublish: (layout: PageLayout) => Promise<PageVersionSummary[]>;
  /** Loads an old version back into the draft. */
  onRestore: (versionId: string) => Promise<PageLayout>;
  versions: PageVersionSummary[];
  /** Slots this person may not change. Empty for an Owner. */
  lockedSlots?: SlotName[];
  signedInAs?: string;
  onSignOut?: () => Promise<void>;
}

type Tab = "settings" | "history";

export function Editor({
  layout,
  registry,
  pageTitle,
  onSave,
  onPublish,
  onRestore,
  versions: initialVersions,
  lockedSlots = [],
  signedInAs,
  onSignOut,
}: EditorProps) {
  const [state, dispatch] = useReducer(editorReducer, layout, initialState);
  const [status, setStatus] = useState<"idle" | "saving" | "publishing">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState(initialVersions);
  const [tab, setTab] = useState<Tab>("settings");

  // A small distance before a drag begins, so clicking a Block to select it does not drag it.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

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

  async function run(kind: "saving" | "publishing", work: () => Promise<string>) {
    setStatus(kind);
    setError(null);
    setMessage(null);
    try {
      const result = await work();
      dispatch({ type: "saved" });
      setMessage(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong");
    } finally {
      setStatus("idle");
    }
  }

  const busy = status !== "idle";

  return (
    <div className="mn-ed">
      <header className="mn-ed-bar">
        <strong>{pageTitle}</strong>

        <span className={`mn-ed-state${error ? " is-error" : state.dirty ? " is-dirty" : ""}`}>
          {error ?? message ?? (state.dirty ? "Unsaved changes" : "All changes saved")}
        </span>

        <button
          type="button"
          className="mn-button"
          disabled={busy || !state.dirty}
          onClick={() =>
            run("saving", async () => {
              await onSave(state.layout);
              return "Draft saved";
            })
          }
        >
          <SaveIcon />
          {status === "saving" ? "Saving…" : "Save draft"}
        </button>

        {signedInAs ? <span className="mn-ed-who">{signedInAs}</span> : null}

        <button
          type="button"
          className="mn-button mn-button-primary"
          disabled={busy}
          onClick={() =>
            run("publishing", async () => {
              setVersions(await onPublish(state.layout));
              return "Published";
            })
          }
        >
          {status === "publishing" ? "Publishing…" : "Publish"}
        </button>

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
  );
}
