import { defineBlock, field } from "@mimnets/core";

/**
 * A Block that exists only on this Site.
 *
 * The point of it is the import above. Everything it needs — `defineBlock`, the field
 * helpers, the props type inferred from them — comes from `@mimnets/core` as an installed
 * package, not from a relative path into a monorepo. If a Site can add its own Block Type
 * without reaching into the packages that ship the standard ones, the boundary ADR-0001
 * drew is real; if it cannot, the boundary was decoration.
 *
 * A filing-deadline table is a fair example of the kind of thing a real client asks for and
 * the standard library should never grow: it is specific to accountancy, it would be dead
 * weight in every other Site, and it is about fifteen lines here.
 */
export const deadlinesBlock = defineBlock({
  name: "deadlines",
  label: "Filing deadlines",
  fields: {
    heading: field.text({ label: "Heading", default: "Key dates" }),
    // A repeater rather than nested Blocks: a list of dates is one Block's own data, and
    // drag-and-drop inside drag-and-drop is where page builders go to die (M1).
    dates: field.repeater({
      label: "Dates",
      fields: {
        what: field.text({ label: "What is due", default: "" }),
        when: field.text({ label: "When", default: "" }),
        note: field.text({ label: "Note", default: "" }),
      },
    }),
  },
  render: ({ heading, dates }) => (
    <section className="ledger-deadlines">
      <h2 className="mn-heading">{heading}</h2>
      <table>
        <caption className="mn-muted">Statutory dates for the current year</caption>
        <thead>
          <tr>
            <th scope="col">What is due</th>
            <th scope="col">When</th>
            <th scope="col">Note</th>
          </tr>
        </thead>
        <tbody>
          {dates.map((row, index) => (
            <tr key={index}>
              <th scope="row">{row.what}</th>
              <td>{row.when}</td>
              <td className="mn-muted">{row.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  ),
});
