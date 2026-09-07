// @vitest-environment jsdom

/**
 * The comparison table Block.
 *
 * Two things are being asserted. The first is the table semantics — scope on every header —
 * because that is the entire difference between "Priority support, Standard, not included"
 * and a wall of ticks read out with nothing to attach them to, and the two look identical.
 *
 * The second is the positional matching between a feature's values and the plans. That shape
 * is the Block's one real weakness, so the cases where an Author gets it wrong are the cases
 * worth pinning down: too few values, too many, and none at all.
 */

import { emptyContext } from "@mimnets/core";
import { cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { compareBlock } from "./design";

afterEach(cleanup);

type CompareProps = Parameters<typeof compareBlock.render>[0];

const values = (...list: string[]) => list.map((value) => ({ value }));

function props(overrides: Record<string, unknown> = {}): CompareProps {
  return compareBlock.propsSchema.parse({
    title: "What you get",
    plans: [
      { name: "Standard", price: "£20", note: "a month" },
      { name: "Full", price: "£45", note: "a month", featured: true },
    ],
    rows: [
      { label: "Pages", values: values("5", "Unlimited") },
      { label: "Priority support", values: values("no", "yes") },
    ],
    ...overrides,
  }) as CompareProps;
}

function draw(value: CompareProps) {
  return render(<>{compareBlock.render(value, emptyContext(), { id: "blk-test" })}</>);
}

describe("the comparison table Block", () => {
  it("renders nothing without plans", () => {
    expect(draw(props({ plans: [] })).container.innerHTML).toBe("");
  });

  it("is a real table with both kinds of header scoped", () => {
    const { container } = draw(props());

    const columns = Array.from(container.querySelectorAll('th[scope="col"]'));
    const rowHeads = Array.from(container.querySelectorAll('th[scope="row"]'));

    // Without scope a screen reader has to guess which header covers which cell, and it
    // guesses wrong on any table with a corner cell.
    expect(columns.map((th) => within(th as HTMLElement).getByText(/Standard|Full/).textContent))
      .toEqual(["Standard", "Full"]);
    expect(rowHeads.map((th) => th.textContent)).toEqual(["Pages", "Priority support"]);
  });

  it("gives the table a caption even when it has no visible title", () => {
    const { container } = draw(props({ title: "" }));

    // A table announced only as "table" is a table nobody can navigate to on purpose.
    expect(container.querySelector("caption")!.textContent).toBe("Comparison of plans");
  });

  it("lines each value up with its plan", () => {
    const { container } = draw(props());

    const firstRow = container.querySelectorAll("tbody tr")[0]!;
    const cells = Array.from(firstRow.querySelectorAll("td")).map((td) => td.textContent);
    expect(cells).toEqual(["5", "Unlimited"]);
  });

  it("turns yes and no into a tick and a dash that both say what they mean", () => {
    const { container } = draw(props());

    const supportRow = container.querySelectorAll("tbody tr")[1]!;
    const cells = supportRow.querySelectorAll("td");

    // The glyph is hidden from the reader and the word is hidden from the page.
    expect(cells[0]!.querySelector(".mn-visually-hidden")!.textContent).toBe("Not included");
    expect(cells[1]!.querySelector(".mn-visually-hidden")!.textContent).toBe("Included");
    expect(cells[1]!.querySelector('[aria-hidden="true"]')!.textContent).toBe("✓");
  });

  it.each([["YES"], ["Yes"], ["true"], ["included"], ["✓"]])(
    "accepts %s as a tick however it was written",
    (written) => {
      const { container } = draw(
        props({ rows: [{ label: "Support", values: values(written, "no") }] }),
      );

      expect(container.querySelector("tbody td .mn-visually-hidden")!.textContent).toBe(
        "Included",
      );
    },
  );

  it("shows any other text exactly as the Author wrote it", () => {
    const { container } = draw(
      props({ rows: [{ label: "Storage", values: values("50 GB", "2 TB") }] }),
    );

    const cells = Array.from(container.querySelectorAll("tbody td")).map((td) => td.textContent);
    expect(cells).toEqual(["50 GB", "2 TB"]);
  });

  it("pads a row an Author left short rather than misaligning it", () => {
    const { container } = draw(
      props({ rows: [{ label: "Reports", values: values("yes") }] }),
    );

    // Two plans, one value. The second cell is empty; it is not the first value shifted over.
    const cells = container.querySelectorAll("tbody td");
    expect(cells).toHaveLength(2);
    expect(cells[1]!.textContent).toBe("");
  });

  it("ignores values beyond the last plan rather than growing a headerless column", () => {
    const { container } = draw(
      props({ rows: [{ label: "Reports", values: values("yes", "yes", "yes", "yes") }] }),
    );

    // A cell with no header above it is unreadable to a screen reader and invisible to sighted
    // readers, because the table has no column for it.
    expect(container.querySelectorAll("tbody td")).toHaveLength(2);
  });

  it("still renders the plans when no features were added", () => {
    const { container } = draw(props({ rows: [] }));

    expect(container.querySelectorAll('th[scope="col"]')).toHaveLength(2);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(0);
  });

  it("marks the highlighted plan down its whole column", () => {
    const { container } = draw(props());

    // Tinting a column keeps the row alignment; lifting it out as a card destroys it.
    const featured = container.querySelectorAll("[data-featured]");
    // One header plus one cell per feature row.
    expect(featured.length).toBe(1 + 2);
  });

  it("gives the Editor a usable blank row, values array and all", () => {
    // This is the codebase's first repeater nested inside a repeater. The Editor builds a new
    // item by calling `schema.parse(undefined)` on each sub-field (FieldInput.tsx:201), so the
    // inner repeater's array default is what stands between "Add item" and a Block that throws
    // on `row.values[i]`. It is one `.default([])` deep in the field builder, and nothing else
    // would notice if it went.
    const rows = compareBlock.fields.rows as {
      fields?: Record<string, { schema: { parse: (value: unknown) => unknown } }>;
    };
    const blank = Object.fromEntries(
      Object.entries(rows.fields ?? {}).map(([key, sub]) => [key, sub.schema.parse(undefined)]),
    );

    expect(blank).toEqual({ label: "", values: [] });

    // And the Block renders that blank row rather than throwing on it.
    const { container } = draw(props({ rows: [blank] }));
    expect(container.querySelectorAll("tbody td")).toHaveLength(2);
  });

  it("refuses a dangerous address in a plan's button", () => {
    const { container } = draw(
      props({
        plans: [
          {
            name: "Full",
            price: "£45",
            link: { label: "Choose Full", href: "javascript:alert(1)", newTab: false },
          },
        ],
      }),
    );

    expect(container.querySelector("tfoot a")!.getAttribute("href")).toBe("/");
  });

  it("adds the buttons row only when a plan has one", () => {
    expect(draw(props()).container.querySelector("tfoot")).toBeNull();

    const { container } = draw(
      props({
        plans: [
          {
            name: "Full",
            price: "£45",
            featured: true,
            link: { label: "Choose Full", href: "/signup", newTab: false },
          },
        ],
      }),
    );

    const button = container.querySelector("tfoot a")!;
    expect(button.textContent).toBe("Choose Full");
    expect(button.getAttribute("href")).toBe("/signup");
  });
});
