import type { SVGProps } from "react";

/**
 * A small inline icon set. No icon dependency: a CMS ships one library of glyphs and then
 * lives with it forever, and these are the only ones the Editor needs.
 *
 * All icons are 16×16, stroked, and inherit `currentColor` so a Theme never has to restyle
 * them.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const GripIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="6" cy="4" r="1" fill="currentColor" stroke="none" />
    <circle cx="10" cy="4" r="1" fill="currentColor" stroke="none" />
    <circle cx="6" cy="8" r="1" fill="currentColor" stroke="none" />
    <circle cx="10" cy="8" r="1" fill="currentColor" stroke="none" />
    <circle cx="6" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="10" cy="12" r="1" fill="currentColor" stroke="none" />
  </Icon>
);

export const TrashIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.5 9h7l.5-9M6.5 6.5v4M9.5 6.5v4" />
  </Icon>
);

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 3v10M3 8h10" />
  </Icon>
);

export const UndoIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 8h6.5a3.5 3.5 0 0 1 0 7H6" />
    <path d="M5.5 5 2.5 8l3 3" />
  </Icon>
);

export const RedoIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M13 8H6.5a3.5 3.5 0 0 0 0 7H10" />
    <path d="M10.5 5l3 3-3 3" />
  </Icon>
);

/** Two overlapping sheets — the copy sitting on top of what it was copied from. */
export const DuplicateIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1" />
    <path d="M10.5 2.5H3.5a1 1 0 0 0-1 1v7" />
  </Icon>
);

export const SaveIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 3h7l3 3v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M5.5 3v4h5M5.5 13v-3h5v3" />
  </Icon>
);

export const HeadingIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 3v10M12 3v10M4 8h8" />
  </Icon>
);

export const TextIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 4h10M3 8h10M3 12h6" />
  </Icon>
);

export const ImageIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2.5" y="3.5" width="11" height="9" rx="1" />
    <circle cx="6" cy="6.5" r="1" />
    <path d="M3 11l3-2.5 3 2 2-1.5 2 2" />
  </Icon>
);

export const BlockIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
  </Icon>
);

/** Slot glyphs: a page outline with the relevant band filled. */
export const SlotIcon = ({ slot, ...props }: IconProps & { slot: string }) => {
  const bands: Record<string, { y: number; height: number }> = {
    header: { y: 3, height: 2.5 },
    main: { y: 6, height: 4 },
    sidebar: { y: 6, height: 4 },
    footer: { y: 10.5, height: 2.5 },
  };
  const band = bands[slot] ?? bands.main!;
  return (
    <Icon {...props}>
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      {slot === "sidebar" ? (
        <rect x="10" y={band.y} width="3.5" height={band.height} fill="currentColor" stroke="none" />
      ) : (
        <rect
          x="2.5"
          y={band.y}
          width="11"
          height={band.height}
          fill="currentColor"
          stroke="none"
        />
      )}
    </Icon>
  );
};

export const LockIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.5" y="7" width="9" height="6" rx="1.5" />
    <path d="M5.75 7V5.25a2.25 2.25 0 0 1 4.5 0V7" />
  </Icon>
);

export const MenuIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
  </Icon>
);

export const LogoIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M5.5 9.5 8 5.5l2.5 4" />
  </Icon>
);

export const ICONS_BY_BLOCK: Record<string, (props: IconProps) => React.JSX.Element> = {
  heading: HeadingIcon,
  text: TextIcon,
  image: ImageIcon,
  menu: MenuIcon,
  logo: LogoIcon,
};
