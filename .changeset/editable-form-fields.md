---
"@mimnets/blocks": minor
"@mimnets/core": minor
---

A contact form can ask more than name, email and message. **This adds a database column, so
an upgrading Site must run its migrations.**

The contact Block takes an `extras` list: a question, an answer kind (one line, several lines,
phone, email, number) and whether it is required. They are asked after the message, shown above
it in the Dashboard, and included in the notification email above the message — because a phone
number or a preferred date is what an Owner scans for, and the message is what they then read.

Name, email and message stay and are not in that list. They are what an enquiry *is*: the
Dashboard shows them as the sender, the notification is addressed from them, and the reply
button needs the address. A form that could remove them would produce enquiries nobody can
answer.

**The inputs are named by position — `x_0`, `x_1` — not by the question.** An input's `name`
comes back as visitor input, so if the label were the name, a form post could invent a question
nobody asked and have it stored beside the real ones, in an Owner's inbox, looking exactly as
legitimate. The server reads the labels from the *published* Block at the same index and pairs
them up; anything posted that does not correspond to a declared question is dropped. This is the
same rule that moved `recipient` out of the markup, applied to the same class of problem.

A consequence worth knowing: reordering the questions on a Block changes what future visitors
are asked and leaves what past ones said alone, because an Enquiry stores the label it was
answered under rather than looking it up on read.

`@mimnets/core` gains `extraFieldName`, `extraAnswers`, `FORM_EXTRA_PREFIX` and the
`ExtraAnswer` type.

**Upgrading an existing Site:**

1. Run `pnpm db:migrate`. The migration adds one nullable-by-default `jsonb` column to
   `form_submissions`; it is additive and needs no downtime.
2. Nothing else. Every existing contact form declares no extra questions and behaves exactly
   as it did, and every stored enquiry reads back with an empty list.
