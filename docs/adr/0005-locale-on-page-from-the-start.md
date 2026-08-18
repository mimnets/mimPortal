# Locale on Page from the start

Every Page carries a `locale` from the first migration even though no Site is multilingual
and no translation UI is planned. Adding a locale later means migrating every Page,
touching every query, and rethinking routing on a live system with real client content;
carrying an unused column costs nothing by comparison.

## Consequences

- A future reader will find a `locale` column that nothing appears to use. That is
  deliberate — it is a placeholder, not dead code.
- Public routing ignores locale for now; all Pages are created with a single default.
