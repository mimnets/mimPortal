# Mimnets

A TypeScript product for building websites. It is a set of shared packages plus a
starter app that is cloned once per website. Each clone ships with a dashboard where
content, layout and theme are changed without touching code.

## Language

### The product

**Mimnets**:
This product — the shared packages and the Starter that are cloned to create a Site.
_Avoid_: the template, the framework, the boilerplate

**Starter**:
The minimal app inside Mimnets that is cloned to create a Site.
_Avoid_: skeleton, scaffold

**Site**:
One deployed website created by cloning the Starter. Owns its own database, domain,
content and Theme.
_Avoid_: tenant, instance, project

**Theme**:
The visual identity of a Site — colours, fonts, spacing, radii — applied to every Block.
_Avoid_: template, skin, style

**Preset**:
A named bundle of a Theme and starting Page layouts, chosen when a Site or a Page is
first created.
_Avoid_: template, starter, design, variant

### Page structure

**Page**:
A single addressable screen of a Site, identified by its path.
_Avoid_: route, screen, view

**Slot**:
A named region of a Page that holds content: Header, Main, Sidebar, Footer.
_Avoid_: module, area, zone, region

**Section**:
A full-width horizontal band inside a Slot, divided into one or more Columns.
_Avoid_: row, band, strip

**Column**:
A vertical lane inside a Section holding an ordered list of Blocks.
_Avoid_: cell, track

**Block**:
A single piece of content placed in a Column — a heading, image, video, form.
_Avoid_: module, widget, component, element

**Block Type**:
The definition a Block is an instance of: its editable fields and how it renders.
_Avoid_: block schema, component type

### Editing

**Dashboard**:
The whole admin area of a Site, of which the Editor is one part.
_Avoid_: admin panel, CMS, backend

**Editor**:
The drag-and-drop interface for arranging Sections and Blocks within a Page's Slots.
_Avoid_: builder, canvas, page builder

**Draft**:
The in-progress state of a Page, visible only inside the Dashboard.
_Avoid_: unpublished, working copy

**Published**:
The state of a Page that public visitors see.
_Avoid_: live, released

**Shared Slot**:
A Header or Footer defined once for the Site and used by any number of Pages. Editing one
changes every Page using it. A Page may keep its own instead.
_Avoid_: global header, template part, partial, include

**Media library**:
Every image a Site has uploaded, listed in the Dashboard and shared by all its Pages.
_Avoid_: assets, uploads, files, gallery

### People

**Owner**:
The person who owns and deploys a Site and can change its code.
_Avoid_: admin, developer, superuser

**Author**:
A person given Dashboard access to change content, but not code or structure.
_Avoid_: client, user, editor
