// @vitest-environment jsdom

/**
 * Selecting a Section by clicking it.
 *
 * The settings panel tells an Author, in as many words, to "click a Block to edit its fields,
 * or a Section to change its Columns". The second half of that was not true: the Section's
 * click handler selected the Section, the click then carried on up to the preview root whose
 * own handler clears the selection, and both applied in that order. The net result was
 * nothing selected, so Section settings were reachable only by adding a Section — which sets
 * the selection inside the reducer — and never by clicking one.
 *
 * Confirmed in a browser before it was fixed, and confirmed fixed in a browser afterwards.
 * The assertion below is about the dispatch sequence rather than the rendered panel, because
 * that sequence is the whole bug: with the fault present the Section is selected *and then*
 * unselected, which no single snapshot of the panel can distinguish from never having been
 * selected at all.
 */

import { createRegistry, defineBlock, emptyContext, emptyLayout, field } from "@mimnets/core";
import type { PageLayout } from "@mimnets/core";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { newBlock, newSection } from "./state";
import { Preview } from "./Preview";

afterEach(cleanup);

const spacer = defineBlock({
  name: "spacer",
  label: "Spacer",
  fields: { note: field.text({ label: "Note", default: "" }) },
  render: ({ note }) => <p>{note as string}</p>,
});

const registry = createRegistry([spacer]);

function pageWithOneSection(): PageLayout {
  const layout = emptyLayout();
  const section = newSection("1");
  section.columns[0]!.blocks.push(newBlock(spacer));
  layout.slots.main.push(section);
  return layout;
}

function draw() {
  const dispatch = vi.fn();
  const result = render(
    <Preview
      layout={pageWithOneSection()}
      registry={registry}
      selection={null}
      dispatch={dispatch}
      context={emptyContext()}
      visibleSlots={["main"]}
    />,
  );
  return { ...result, dispatch };
}

describe("clicking a Section", () => {
  it("selects it", () => {
    const { container, dispatch } = draw();

    fireEvent.click(container.querySelector(".mn-ed-section")!);

    expect(dispatch).toHaveBeenCalledWith({
      type: "select",
      selection: { kind: "section", path: { slot: "main", section: 0 } },
    });
  });

  it("does not then unselect it on the way up", () => {
    const { container, dispatch } = draw();

    fireEvent.click(container.querySelector(".mn-ed-section")!);

    // The bug in one line. Two dispatches — the Section, then null from the preview root —
    // leave the panel empty and look exactly like a click that did nothing.
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalledWith({ type: "select", selection: null });
  });

  it("still lets a click on the preview background clear the selection", () => {
    const { container, dispatch } = draw();

    // Stopping propagation must not cost the deselect-by-clicking-away behaviour, which is
    // the reason the root handler exists.
    fireEvent.click(container.querySelector(".mn-ed-preview")!);

    expect(dispatch).toHaveBeenCalledWith({ type: "select", selection: null });
  });

  it("selects the Block, not the Section, when a Block is clicked", () => {
    const { container, dispatch } = draw();

    fireEvent.click(container.querySelector(".mn-ed-block")!);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      type: "select",
      selection: { kind: "block" },
    });
  });
});
