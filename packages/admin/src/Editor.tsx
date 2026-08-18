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

import type { BlockRegistry, PageLayout } from "@mimnets/core";

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
}

export function Editor({ layout, registry, pageTitle, onSave }: EditorProps) {
  const [state, dispatch] = useReducer(editorReducer, layout, initialState);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

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

  async function save() {
    setStatus("saving");
    setMessage(null);
    try {
      await onSave(state.layout);
      dispatch({ type: "saved" });
      setStatus("idle");
      setMessage("Draft saved");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not save");
    }
  }

  return (
    <div className="mn-ed">
      <header className="mn-ed-bar">
        <strong>{pageTitle}</strong>
        <span className="mn-ed-state">
          {state.dirty ? "Unsaved changes" : "No changes"}
          {message ? ` — ${message}` : ""}
        </span>
        <button
          type="button"
          className="mn-button mn-button-primary"
          disabled={status === "saving" || !state.dirty}
          onClick={save}
        >
          {status === "saving" ? "Saving…" : "Save draft"}
        </button>
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
          />
          <aside className="mn-ed-panel">
            <SettingsPanel
              layout={state.layout}
              registry={registry}
              selection={state.selection}
              dispatch={dispatch}
            />
          </aside>
        </div>
      </DndContext>
    </div>
  );
}
