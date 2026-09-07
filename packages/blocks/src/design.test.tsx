// @vitest-environment jsdom

/**
 * The accordion Block.
 *
 * Worth testing beyond "it renders" for one reason: the exclusive-open behaviour rests on the
 * `name` attribute being shared within a Block and different between Blocks, and that is a
 * property no amount of looking at one accordion in a browser will reveal. It only shows up
 * when a Page holds two.
 */

import { emptyContext } from "@mimnets/core";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { accordionBlock } from "./design";

afterEach(cleanup);

type AccordionProps = Parameters<typeof accordionBlock.render>[0];

/** Props as the Editor would hand them over: schema defaults with the questions filled in. */
function props(overrides: Partial<Record<string, unknown>> = {}): AccordionProps {
  return accordionBlock.propsSchema.parse({
    title: "Common questions",
    items: [
      { question: "Do you work weekends?", answer: "For an agreed fee, yes." },
      { question: "How are you paid?", answer: "Monthly, in arrears." },
    ],
    ...overrides,
  }) as AccordionProps;
}

function draw(value: AccordionProps) {
  return render(<>{accordionBlock.render(value, emptyContext(), { id: "blk-test" })}</>);
}

describe("the accordion Block", () => {
  it("renders nothing at all when it has no questions", () => {
    const { container } = draw(props({ items: [] }));

    // Not an empty box with a heading in it — an Author who has added no questions yet should
    // not be publishing a stray title to the Site.
    expect(container.innerHTML).toBe("");
  });

  it("gives every question a native disclosure", () => {
    const { container } = draw(props());

    const summaries = Array.from(container.querySelectorAll("summary")).map((s) => s.textContent);
    expect(summaries).toEqual(["Do you work weekends?", "How are you paid?"]);
  });

  it("groups its questions so opening one closes the last", () => {
    const { container } = draw(props({ exclusive: true }));

    const names = Array.from(container.querySelectorAll("details")).map((d) =>
      d.getAttribute("name"),
    );
    expect(names[0]).toBeTruthy();
    expect(new Set(names).size).toBe(1);
  });

  it("drops the grouping when the Author wants questions to stay open", () => {
    const { container } = draw(props({ exclusive: false }));

    const names = Array.from(container.querySelectorAll("details")).map((d) =>
      d.getAttribute("name"),
    );
    expect(names).toEqual([null, null]);
  });

  it("does not let two accordions on one Page close each other", () => {
    const first = draw(props());
    const second = draw(
      props({
        items: [{ question: "Where are you based?", answer: "Leeds." }],
      }),
    );

    const nameOf = (r: ReturnType<typeof draw>) =>
      r.container.querySelector("details")!.getAttribute("name");

    // The group is derived from the questions, so two different accordions are separate
    // groups. This is the assertion the browser could never have made on its own.
    expect(nameOf(first)).not.toBe(nameOf(second));
  });

  it("opens only the first question when asked to", () => {
    const { container } = draw(props({ openFirst: true }));

    const open = Array.from(container.querySelectorAll("details")).map((d) => d.hasAttribute("open"));
    expect(open).toEqual([true, false]);
  });

  it("starts fully closed by default", () => {
    const { container } = draw(props());

    const open = Array.from(container.querySelectorAll("details")).map((d) => d.hasAttribute("open"));
    expect(open).toEqual([false, false]);
  });
});
