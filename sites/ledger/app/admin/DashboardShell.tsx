import Link from "next/link";
import type { ReactNode } from "react";

import type { CurrentUser } from "../../lib/session";
import { signOut } from "./sign-out";

/**
 * The frame every Dashboard screen sits in.
 *
 * It replaced a bar that had been pasted into five pages, which is why the links had drifted
 * apart and why signing out existed on none of them. A single shell also makes the shape of
 * the product legible: what a Site is made of, grouped, with the current place marked.
 *
 * Grouped by what a thing *is*, not by how often it is used. Content is what an Author
 * changes daily; Structure is what an Owner sets up once and a client should rarely touch;
 * Settings is where the wiring is described. An Author sees only the first group.
 */

export type DashboardSection =
  | "pages"
  | "media"
  | "enquiries"
  | "menus"
  | "slots"
  | "design"
  | "settings";

interface NavItem {
  section: DashboardSection;
  href: string;
  label: string;
  /** Owner-only items are hidden from an Author rather than shown and refused. */
  ownerOnly?: boolean;
  icon: ReactNode;
}

const CONTENT: NavItem[] = [
  { section: "pages", href: "/admin", label: "Pages", icon: <PageIcon /> },
  { section: "media", href: "/admin/media", label: "Media", icon: <MediaIcon /> },
  { section: "enquiries", href: "/admin/enquiries", label: "Enquiries", icon: <MailIcon /> },
];

const STRUCTURE: NavItem[] = [
  { section: "menus", href: "/admin/menus", label: "Menus", ownerOnly: true, icon: <MenuIcon /> },
  {
    section: "slots",
    href: "/admin/slots",
    label: "Headers & Footers",
    ownerOnly: true,
    icon: <SlotIcon />,
  },
];

const DESIGN: NavItem[] = [
  { section: "design", href: "/admin/design", label: "Design", ownerOnly: true, icon: <WandIcon /> },
];

const SETTINGS: NavItem[] = [
  {
    section: "settings",
    href: "/admin/settings",
    label: "Site settings",
    ownerOnly: true,
    icon: <GearIcon />,
  },
];

export function DashboardShell({
  current,
  person,
  title,
  actions,
  children,
}: {
  current: DashboardSection;
  person: CurrentUser;
  title: string;
  /** Buttons belonging to this screen, shown beside its title. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const isOwner = person.role === "owner";

  const group = (items: NavItem[], heading: string) => {
    const visible = items.filter((item) => isOwner || !item.ownerOnly);
    if (visible.length === 0) return null;

    return (
      <div className="mn-nav-group">
        <h2>{heading}</h2>
        <ul>
          {visible.map((item) => (
            <li key={item.section}>
              <Link
                href={item.href}
                className={`mn-nav-link${item.section === current ? " is-current" : ""}`}
                aria-current={item.section === current ? "page" : undefined}
              >
                <span className="mn-nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="mn-shell">
      <aside className="mn-shell-side">
        <Link href="/admin" className="mn-shell-brand">
          Dashboard
        </Link>

        <nav className="mn-shell-nav">
          {group(CONTENT, "Content")}
          {group(STRUCTURE, "Structure")}
          {group(DESIGN, "Design")}
          {group(SETTINGS, "Settings")}
        </nav>

        <div className="mn-shell-foot">
          <a className="mn-nav-link" href="/" target="_blank" rel="noreferrer">
            <span className="mn-nav-icon" aria-hidden="true">
              <ExternalIcon />
            </span>
            View Site
          </a>

          <div className="mn-shell-who">
            <strong>{person.name}</strong>
            <span>{person.role}</span>
          </div>

          <form action={signOut}>
            <button type="submit" className="mn-button">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="mn-shell-main">
        <header className="mn-shell-head">
          <h1>{title}</h1>
          {actions ? <div className="mn-shell-actions">{actions}</div> : null}
        </header>

        <div className="mn-shell-body">{children}</div>
      </main>
    </div>
  );
}

/* ---- Icons -----------------------------------------------------------------
   Drawn here rather than pulled from a set: six glyphs is not worth a
   dependency, a licence, and a font request on every Dashboard load. */

function PageIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M4 1.5h5l3 3v10h-8z" />
      <path d="M9 1.5v3.5h3" />
    </svg>
  );
}

function MediaIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M2 10.5l3.5-3 3 2.5 2-1.5 3.5 3" />
      <circle cx="6" cy="6" r="1" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
      <path d="M2.5 5l5.5 4 5.5-4" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M3 4.5h10M3 8h10M3 11.5h6" strokeLinecap="round" />
    </svg>
  );
}

function SlotIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
      <path d="M2 6h12M2 10.5h12" />
    </svg>
  );
}

function WandIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M3 13l7-7" strokeLinecap="round" />
      <path d="M11.5 2.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" />
      <path d="M4.5 3l.4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="8" cy="8" r="2.25" />
      <path d="M8 1.5v1.8M8 12.7v1.8M14.5 8h-1.8M3.3 8H1.5M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3M12.6 12.6l-1.3-1.3M4.7 4.7L3.4 3.4" strokeLinecap="round" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M7 3.5H3.5v9h9V9" />
      <path d="M9.5 2.5h4v4M13 3l-5.5 5.5" strokeLinecap="round" />
    </svg>
  );
}
