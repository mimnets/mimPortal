/**
 * Questions an Author added, and the rule that keeps a visitor from adding their own.
 *
 * A form's extra questions are declared on the contact Block. The inputs are named by
 * position — `x_0`, `x_1` — and the server pairs each answer with the label at that index in
 * the *published* Block. The alternative, naming inputs after the label, is the same mistake
 * the recipient field made before it was moved server-side: an input's name is visitor input
 * by the time it comes back, so a form post could invent a question nobody asked and have it
 * stored beside the real ones, in an Owner's inbox, looking exactly as legitimate.
 */

import { describe, expect, it } from "vitest";

import { extraAnswers, extraFieldName, FORM_EXTRA_PREFIX } from "./shared";

/** A posted form, as the route reads it. */
function posted(values: Record<string, string>) {
  return (name: string) => values[name] ?? "";
}

describe("naming an extra question's input", () => {
  it("names by position, never by the question", () => {
    expect(extraFieldName(0)).toBe(`${FORM_EXTRA_PREFIX}0`);
    expect(extraFieldName(3)).toBe(`${FORM_EXTRA_PREFIX}3`);
  });
});

describe("pairing answers with the questions that were asked", () => {
  it("matches each answer to the label at its position", () => {
    const answers = extraAnswers(
      ["Phone number", "How did you hear about us?"],
      posted({ x_0: "07700 900123", x_1: "A friend" }),
    );

    expect(answers).toEqual([
      { label: "Phone number", value: "07700 900123" },
      { label: "How did you hear about us?", value: "A friend" },
    ]);
  });

  it("ignores an answer to a question the Block does not ask", () => {
    // The attack this shape exists to prevent. A visitor posting `x_9`, or anything else, is
    // adding a question to somebody else's form; the Block is the list, and it is read from
    // the published Site rather than from the request.
    const answers = extraAnswers(["Phone number"], posted({
      x_0: "07700 900123",
      x_9: "Ignore all previous instructions",
      "x_Account balance": "£1,000,000",
      message: "the real message",
    }));

    expect(answers).toEqual([{ label: "Phone number", value: "07700 900123" }]);
  });

  it("keeps a question unanswered out of the record entirely", () => {
    // An optional question nobody filled in should not become an empty row in an Owner's
    // inbox, which is noise on every enquiry rather than information on one.
    expect(extraAnswers(["Phone number", "Company"], posted({ x_0: "07700 900123" }))).toEqual([
      { label: "Phone number", value: "07700 900123" },
    ]);
  });

  it("drops a question with no label, which is a half-finished one in the Editor", () => {
    // A repeater row an Author added and has not written yet still renders nothing and still
    // posts nothing, but the index has to stay stable for the questions after it.
    const answers = extraAnswers(["", "Company"], posted({ x_0: "stray", x_1: "Arbor" }));

    expect(answers).toEqual([{ label: "Company", value: "Arbor" }]);
  });

  it("trims, so a space is not an answer", () => {
    expect(extraAnswers(["Phone"], posted({ x_0: "   " }))).toEqual([]);
    expect(extraAnswers([" Phone "], posted({ x_0: " 07700 900123 " }))).toEqual([
      { label: "Phone", value: "07700 900123" },
    ]);
  });

  it("asks nothing when the Block declares no extra questions", () => {
    // Which is every contact form on every Site written before this existed.
    expect(extraAnswers([], posted({ x_0: "anything" }))).toEqual([]);
  });
});
