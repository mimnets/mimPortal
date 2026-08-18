# Page layout as a single JSON document

A Page's entire Slot / Section / Column / Block tree is stored in one `jsonb` column and
validated by a Zod schema, rather than normalised into a table of Blocks with parent
references and sort orders. The Editor reads and writes the whole tree in one operation,
so a document matches how the data is actually used: reordering is an array move rather
than a rewrite of every sibling's sort index, and a version snapshot is a copy of a single
value.

## Consequences

- Querying across Blocks ("every Page containing a video") has no natural index. If that
  becomes necessary, derive a generated column rather than normalising the tree.
- The Zod schema is the only thing standing between a bad write and a corrupt Page, so it
  is shared by the database layer, the Editor's forms, and any AI that emits Blocks.
- Changing the shape of a Block Type's fields requires migrating existing documents,
  since old Pages hold data in the old shape.
