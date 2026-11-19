import React from 'react';
import { GlobeIcon, type IconComponent, type IconProps } from '@/components/icons';
import type { CtfCategory } from '@/lib/ctf/writeups';

function IconBase({
  className,
  title,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** Padlock for Crypto category badges. */
export function LockIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      <path d="M12 16h.01" />
    </IconBase>
  );
}

/** Open padlock for decode actions. */
export function UnlockIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.6-1.7" />
      <path d="M12 16h.01" />
    </IconBase>
  );
}

/** Eight-point impact burst for Pwn category badges. */
export function BurstIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M12 2.5l1.9 4.9 4.8-2.1-2.1 4.8 4.9 1.9-4.9 1.9 2.1 4.8-4.8-2.1-1.9 4.9-1.9-4.9-4.8 2.1 2.1-4.8-4.9-1.9 4.9-1.9-2.1-4.8 4.8 2.1L12 2.5Z" />
    </IconBase>
  );
}

/** Document sheet for TL;DR sections. */
export function NoteIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </IconBase>
  );
}

/** Conical lab flask for interactive lab headings. */
export function FlaskIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M9 3h6" />
      <path d="M10 3v5.5L5.2 17.6A2 2 0 0 0 7 20.5h10a2 2 0 0 0 1.8-2.9L14 8.5V3" />
      <path d="M7.5 15h9" />
    </IconBase>
  );
}

/** Open book for background concepts. */
export function BooksIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M12 6.5C10.5 5 8 4.5 4 5v13.5c4-.5 6.5 0 8 1.5" />
      <path d="M12 6.5C13.5 5 16 4.5 20 5v13.5c-4-.5-6.5 0-8 1.5" />
      <path d="M12 6.5V20" />
    </IconBase>
  );
}

/** Ladder for step-by-step solve chains. */
export function LadderIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M8 3v18M16 3v18" />
      <path d="M8 7h8M8 12h8M8 17h8" />
    </IconBase>
  );
}

/** Brick wall for dead-ends sections. */
export function BrickWallIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M3 10h18M3 15h18" />
      <path d="M12 5v5M8 10v5M16 10v5M12 15v4" />
    </IconBase>
  );
}

/** Telescope on tripod for further-reading sections. */
export function TelescopeIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M4.5 12.5L16.5 5.5l3 5.2L6.5 16l-2-3.5Z" />
      <path d="M11.5 14L8.5 21M12.5 13.5L15.5 21" />
    </IconBase>
  );
}

/** Pocket calculator for IP-to-decimal conversion tools. */
export function CalculatorIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 7h8" />
      <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" />
      <path d="M8.5 16h.01M12 16h.01M15.5 16h.01" />
    </IconBase>
  );
}

/** Checkered race flag for timing/race diagrams. */
export function FlagCheckeredIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M5 21V4" />
      <path d="M5 4h13a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5" />
      <path d="M5 9h14M10 4v10M15 4v10" />
    </IconBase>
  );
}

/** Gentle smile for encouragement copy. */
export function SmileIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 10h.01M15 10h.01" />
      <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" />
    </IconBase>
  );
}

/** Right arrow for step transitions and mappings. */
export function ArrowRightIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </IconBase>
  );
}

/** Left arrow for back navigation. */
export function ArrowLeftIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M19 12H5" />
      <path d="M11 6l-6 6 6 6" />
    </IconBase>
  );
}

/** Down arrow for peeling/decoding layers. */
export function ArrowDownIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M12 5v14" />
      <path d="M6 13l6 6 6-6" />
    </IconBase>
  );
}

/** Counter-clockwise arrow for reset buttons. */
export function RotateCcwIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.7" />
      <path d="M4 4v5h5" />
    </IconBase>
  );
}

/** Play triangle for run / auto-solve actions. */
export function PlayIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M7 5l12 7-12 7V5Z" />
    </IconBase>
  );
}

/** Category-to-icon map for Solved CTF badges and cards. */
export const CATEGORY_ICON: Record<CtfCategory, IconComponent> = {
  Web: GlobeIcon,
  Crypto: LockIcon,
  Pwn: BurstIcon,
};
