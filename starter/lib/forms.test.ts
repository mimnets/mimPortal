import { renderToStaticMarkup } from "react-dom/server";
import { blockStyleDefaults, sectionDefaults, type PageLayout } from "@mimnets/core";
import { contactBlock } from "@mimnets/blocks";
import { describe, expect, it } from "vitest";

import { recipientInSections } from "./forms";

/**
 * Where an enquiry is sent.
 *
 * The old answer came out of a hidden field, which made it visitor input: anybody could post
 * their own address and have the Site send mail from its verified domain to whoever they
 * named. These check both halves of the replacement — that the markup no longer offers the
 * field, and that the server can find the address without it.
 */

type Sections = PageLayout["slots"]["main"];

function contactSection(props: Record<string, unknown>, id = "sec"): Sections[number] {
  return {
    id,
    layout: "1",
    columns: [
      {
        id: `col-${id}`,
        blocks: [{ id: `blk-${id}`, type: "contact", props, style: blockStyleDefaults() }],
      },
    ],
    ...sectionDefaults(),
  };
}

describe("the contact form's markup", () => {
  it("no longer carries the recipient as a hidden field", () => {
    const html = renderToStaticMarkup(
      contactBlock.render(
        {
          heading: "Get in touch",
          intro: "",
          recipient: "owner@example.com",
          buttonLabel: "Send",
          successMessage: "Thanks",
          slug: "contact",
        },
        {
          siteName: "Example",
          menus: {},
          currentPath: "/contact",
          mediaBaseUrl: "/media",
          formToken: "t",
          query: {},
        },
      ),
    );

    expect(html).not.toContain('name="recipient"');
    // The address itself must not reach the page at all, in any field.
    expect(html).not.toContain("owner@example.com");
  });
});

describe("finding the recipient in a published layout", () => {
  it("reads the address from the Block whose form name matches", () => {
    const sections = [
      contactSection({ slug: "careers", recipient: "jobs@example.com" }, "a"),
      contactSection({ slug: "contact", recipient: "hello@example.com" }, "b"),
    ];

    expect(recipientInSections(sections, "contact")).toBe("hello@example.com");
    expect(recipientInSections(sections, "careers")).toBe("jobs@example.com");
  });

  it("treats a Block with no form name as the default one", () => {
    const sections = [contactSection({ recipient: "hello@example.com" })];

    expect(recipientInSections(sections, "contact")).toBe("hello@example.com");
  });

  it("gives no address for a form name that is not on the Page", () => {
    const sections = [contactSection({ slug: "contact", recipient: "hello@example.com" })];

    expect(recipientInSections(sections, "invoices")).toBeNull();
  });

  it("gives no address when the Author left the field empty, so the Site's own is used", () => {
    const sections = [contactSection({ slug: "contact", recipient: "   " })];

    expect(recipientInSections(sections, "contact")).toBeNull();
  });

  it("ignores a recipient that is not a string", () => {
    const sections = [contactSection({ slug: "contact", recipient: { to: "attacker@example.com" } })];

    expect(recipientInSections(sections, "contact")).toBeNull();
  });

  it("ignores Blocks of every other type", () => {
    const sections: Sections = [
      {
        id: "sec",
        layout: "1",
        columns: [
          {
            id: "col",
            blocks: [{ id: "blk", type: "text", props: { body: "not a form" }, style: blockStyleDefaults() }],
          },
        ],
        ...sectionDefaults(),
      },
    ];

    expect(recipientInSections(sections, "contact")).toBeNull();
  });
});
