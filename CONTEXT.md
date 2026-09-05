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

**Enquiry**:
One message a visitor sent through a form on a Site, stored before any attempt is made to
deliver it, and readable in the Dashboard whether or not the notification arrived.
_Avoid_: submission, form submission, lead, contact, message

### Installing

**Install mode**:
Which of four states a Site is in, decided by asking its database rather than by reading a
file. Every install route refuses unless the Site is in the mode that route belongs to.
_Avoid_: install step, setup stage, installer state

**Provisioning**:
The install mode in which no usable database is configured, so the installer asks for one.
_Avoid_: setup, first run, bootstrap

**Onboarding**:
The install mode in which a database exists but nobody has installed the Site. The first
Owner is created and the Site is named. The only window in which an account is created over
HTTP.
_Avoid_: registration, sign-up, welcome

**Installed**:
The install mode in which every install route refuses, permanently.
_Avoid_: live, complete, done

**Unavailable**:
The install mode in which a database is configured but cannot be reached. Nothing about the
Site can be decided, so every install route refuses rather than guessing. Distinct from
Provisioning on purpose: treating an outage as an unconfigured Site reopens the installer.
_Avoid_: offline, down, error, broken

### People

**Owner**:
The person who owns and deploys a Site and can change its code.
_Avoid_: admin, developer, superuser

**Author**:
A person given Dashboard access to change content, but not code or structure.
_Avoid_: client, user, editor

### Prior art

**Editor library**:
A published package that provides a drag-and-drop editing interface and nothing else — no
storage, no accounts, no publishing. Puck, GrapesJS and ui-builder are Editor libraries.
Mimnets is not one; `packages/admin` is the only part of it that could have been built on
one ([ADR-0018](./docs/adr/0018-the-editor-is-ours-because-the-block-type-is.md)).
_Avoid_: page builder, canvas, framework, headless CMS

**Content platform**:
A product that supplies the database, accounts, media and publish workflow a Site needs,
without supplying the Editor. Payload, Directus, TinaCMS and Builder.io are Content
platforms, and they are the comparison that costs something to answer.
_Avoid_: CMS, backend, headless CMS
