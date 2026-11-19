import React from 'react';

export interface IconProps {
  className?: string;
  title?: string;
}

export type IconComponent = React.ComponentType<IconProps>;

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

/** Gift box for Free AI & Credits. */
export function GiftIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <rect x="4" y="12" width="16" height="9" rx="1.5" />
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M12 8H8.5a2 2 0 1 1 0-4C10.5 4 12 6 12 8Zm0 0h3.5a2 2 0 1 0 0-4C13.5 4 12 6 12 8Z" />
    </IconBase>
  );
}

/** Trophy cup for CTF events and top scores. */
export function TrophyIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M7 4h10v6a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
      <path d="M12 15v4" />
      <path d="M8 19h8" />
    </IconBase>
  );
}

/** Flame for hot security alerts and KEV entries. */
export function FlameIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M12 3c2.5 3 6 5.5 6 10a6 6 0 0 1-12 0c0-2.4 1.1-4.5 2.5-6.2.2 1.3.9 2.2 1.8 2.6C10.2 6.8 11 4.6 12 3Z" />
      <path d="M12 19a2.5 2.5 0 0 1-2.5-2.5c0-1.4 1-2.4 2.5-3.5 1.5 1.1 2.5 2.1 2.5 3.5A2.5 2.5 0 0 1 12 19Z" />
    </IconBase>
  );
}

/** Cloud for Dev & Cloud topics. */
export function CloudIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M7 18h10.5a3.5 3.5 0 0 0 0-7 5.2 5.2 0 0 0-10-.5A3.8 3.8 0 0 0 7 18Z" />
    </IconBase>
  );
}

/** Four-point sparkle for All and highlights. */
export function SparkleIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M11 5l1.9 5.1L18 12l-5.1 1.9L11 19l-1.9-5.1L4 12l5.1-1.9L11 5Z" />
      <path d="M18.5 3.5v4M16.5 5.5h4" />
    </IconBase>
  );
}

/** Bookmark ribbon for Saved posts. */
export function BookmarkIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M6 4h12a1 1 0 0 1 1 1v16l-7-4-7 4V5a1 1 0 0 1 1-1Z" />
    </IconBase>
  );
}

/** Sun for Morning greeting. */
export function SunIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
      <path d="M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </IconBase>
  );
}

/** Coffee cup for Afternoon greeting and Paper theme. */
export function CoffeeIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" />
      <path d="M16 10h2a2.5 2.5 0 0 1 0 5h-2" />
      <path d="M8 4v2M12 4v2" />
    </IconBase>
  );
}

/** Crescent moon for Evening greeting. */
export function MoonIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6.8 6.8 0 0 0 9.5 9.5Z" />
    </IconBase>
  );
}

/** Sunset horizon for Dusk theme. */
export function SunsetIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M3 17h18" />
      <path d="M6 20h12" />
      <path d="M7 17a5 5 0 0 1 10 0" />
      <path d="M12 7v2M5.5 10.5l1.4 1.4M18.5 10.5l-1.4 1.4" />
    </IconBase>
  );
}

/** Lightning bolt for Daily Drop and header mark. */
export function BoltIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M13 3L5 14h6l-1 7 9-11h-6V3Z" />
    </IconBase>
  );
}

/** Simple checkmark for completed states. */
export function CheckIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M5 13l4 4L19 7" />
    </IconBase>
  );
}

/** Party popper for celebration milestones. */
export function PartyIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M4 20l4-11 7 7-11 4Z" />
      <path d="M14 5l1-2M19 10l2-1M17 6l2-2" />
      <path d="M11 8c1-2 3-2 4-1" />
    </IconBase>
  );
}

/** Target bullseye for weekly goal reached. */
export function TargetIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 12h.01" />
    </IconBase>
  );
}

/** Hourglass for event countdowns. */
export function HourglassIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M6 3h12M6 21h12" />
      <path d="M7 3v3a5 5 0 0 0 5 5 5 5 0 0 0 5-5V3M7 21v-3a5 5 0 0 1 5-5 5 5 0 0 1 5 5v3" />
    </IconBase>
  );
}

/** Lightbulb for Quick Takeaway callouts. */
export function LightbulbIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M9 14.6a5.5 5.5 0 1 1 6 0c-.6.6-1 1.4-1 2.4v1h-4v-1c0-1-.4-1.8-1-2.4Z" />
      <path d="M10 21h4" />
    </IconBase>
  );
}

/** Brain outline for tech glossary boxes. */
export function BrainIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M12 5a3 3 0 0 0-5.5 1.5A3 3 0 0 0 5 11.5a3 3 0 0 0 1.5 5.3A3 3 0 0 0 12 19V5Z" />
      <path d="M12 5a3 3 0 0 1 5.5 1.5A3 3 0 0 1 19 11.5a3 3 0 0 1-1.5 5.3A3 3 0 0 1 12 19" />
      <path d="M9 9.5a2 2 0 0 1 0 3M15 9.5a2 2 0 0 0 0 3" />
    </IconBase>
  );
}

/** Leaf for empty / calm practice state. */
export function LeafIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M19 5C12 5 6 8.5 6 15a5 5 0 0 0 5 5c6.5 0 8-6 8-15Z" />
      <path d="M5 19l8-8" />
    </IconBase>
  );
}

/** Five-point star for encouragement on practice completion. */
export function StarIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    </IconBase>
  );
}

/** Globe for language toggle chips. */
export function GlobeIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a13 13 0 0 1 0 18 13 13 0 0 1 0-18Z" />
    </IconBase>
  );
}

/** Interlocking rounded shapes for the Python language chip. */
export function PythonIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H7.5A2.5 2.5 0 0 0 5 13.5v1A2.5 2.5 0 0 0 7.5 17H9" />
      <path d="M15 16v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h5.5A2.5 2.5 0 0 0 19 10.5v-1A2.5 2.5 0 0 0 16.5 7H15" />
      <path d="M11.5 6.5h.01M12.5 17.5h.01" />
    </IconBase>
  );
}

/** Letter C inside a rounded square for the C language chip. */
export function CIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M15 9.5a4 4 0 1 0 0 5" />
    </IconBase>
  );
}

/** Letters JS inside a rounded square for the JavaScript language chip. */
export function JsIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M10 8v6a2 2 0 0 1-2 2H7" />
      <path d="M17 9.5A1.5 1.5 0 0 0 15.5 8h-1a2 2 0 0 0 0 4h1a2 2 0 0 1 0 4h-1a1.5 1.5 0 0 1-1.5-1.5" />
    </IconBase>
  );
}

/** Letter J inside a rounded square for the Java language chip. */
export function JavaIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M10 8h5M13.5 8v6a2.5 2.5 0 0 1-5 0" />
    </IconBase>
  );
}

/** Magnifying glass for searching the feed. */
export function SearchIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </IconBase>
  );
}

/** Open circular arc for loading spinners. */
export function SpinnerIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </IconBase>
  );
}

/** Share arrow rising from an open tray for sharing news cards. */
export function ShareIcon({ className, title }: IconProps) {
  return (
    <IconBase className={className} title={title}>
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </IconBase>
  );
}
