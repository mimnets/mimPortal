# Layout stored as data, rendered at runtime

A Page's layout is stored in the database as structured data and assembled by the server
on request, rather than compiled into static files by a build step. Drag-and-drop editing
is only worth having if a change is visible immediately, and a build-per-edit would put a
deployment pipeline between an Author and their own content.

## Consequences

- Public pages need a caching layer, since rendering happens per request.
- Hosting must run a server; a purely static host is not an option.
