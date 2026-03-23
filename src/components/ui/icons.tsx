import { ChevronIcon, CloseIcon, QuickActionIcons, RefreshIcon, SendIcon } from '@mieweb/ui';

function joinClassNames(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export interface MiewebIconProps {
  className?: string;
}

function iconClassName(className?: string) {
  return joinClassNames('h-4 w-4 shrink-0', className);
}

export function HelpIcon({ className }: MiewebIconProps) {
  return <QuickActionIcons.Help className={iconClassName(className)} aria-hidden="true" />;
}

export function SettingsIcon({ className }: MiewebIconProps) {
  return <QuickActionIcons.Settings className={iconClassName(className)} aria-hidden="true" />;
}

export function SearchIcon({ className }: MiewebIconProps) {
  return <QuickActionIcons.Search className={iconClassName(className)} aria-hidden="true" />;
}

export function DocumentIcon({ className }: MiewebIconProps) {
  return <QuickActionIcons.Document className={iconClassName(className)} aria-hidden="true" />;
}

export function ClipboardIcon({ className }: MiewebIconProps) {
  return <QuickActionIcons.Clipboard className={iconClassName(className)} aria-hidden="true" />;
}

export function CalendarIcon({ className }: MiewebIconProps) {
  return <QuickActionIcons.Calendar className={iconClassName(className)} aria-hidden="true" />;
}

export function UserIcon({ className }: MiewebIconProps) {
  return <QuickActionIcons.User className={iconClassName(className)} aria-hidden="true" />;
}

export function BellIcon({ className }: MiewebIconProps) {
  return <QuickActionIcons.Bell className={iconClassName(className)} aria-hidden="true" />;
}

export function RefreshGlyphIcon({ className }: MiewebIconProps) {
  return <RefreshIcon className={iconClassName(className)} aria-hidden="true" />;
}

export function CloseGlyphIcon({ className }: MiewebIconProps) {
  return <CloseIcon className={iconClassName(className)} aria-hidden="true" />;
}

export function SendGlyphIcon({ className }: MiewebIconProps) {
  return <SendIcon className={iconClassName(className)} aria-hidden="true" />;
}

export interface ChevronGlyphIconProps extends MiewebIconProps {
  direction: 'up' | 'down' | 'left' | 'right';
}

export function ChevronGlyphIcon({ className, direction }: ChevronGlyphIconProps) {
  return <ChevronIcon className={iconClassName(className)} direction={direction} aria-hidden="true" />;
}

export interface DisclosureGlyphIconProps extends MiewebIconProps {
  expanded: boolean;
}

export function DisclosureGlyphIcon({ className, expanded }: DisclosureGlyphIconProps) {
  return <ChevronGlyphIcon className={className} direction={expanded ? 'down' : 'right'} />;
}

export interface SortGlyphIconProps extends MiewebIconProps {
  direction?: 'asc' | 'desc';
}

export function SortGlyphIcon({ className, direction }: SortGlyphIconProps) {
  if (direction === 'asc') {
    return <ChevronGlyphIcon className={className} direction="up" />;
  }
  if (direction === 'desc') {
    return <ChevronGlyphIcon className={className} direction="down" />;
  }

  return (
    <span className={joinClassNames('inline-flex flex-col items-center justify-center gap-px', className)} aria-hidden="true">
      <ChevronGlyphIcon className="h-3 w-3" direction="up" />
      <ChevronGlyphIcon className="-mt-1 h-3 w-3" direction="down" />
    </span>
  );
}

export interface DoubleChevronGlyphIconProps extends MiewebIconProps {
  direction: 'up' | 'down';
}

export function DoubleChevronGlyphIcon({ className, direction }: DoubleChevronGlyphIconProps) {
  const offsetClassName = direction === 'up' ? '-mb-1' : '-mt-1';

  return (
    <span className={joinClassNames('inline-flex flex-col items-center justify-center', className)} aria-hidden="true">
      <ChevronGlyphIcon className={joinClassNames('h-3 w-3', offsetClassName)} direction={direction} />
      <ChevronGlyphIcon className={joinClassNames('h-3 w-3', offsetClassName)} direction={direction} />
    </span>
  );
}

export function DragHandleIcon({ className }: MiewebIconProps) {
  return (
    <span className={joinClassNames('inline-flex flex-col items-center justify-center', className)} aria-hidden="true">
      <ChevronGlyphIcon className="-mb-1 h-3 w-3" direction="up" />
      <ChevronGlyphIcon className="-mt-1 h-3 w-3" direction="down" />
    </span>
  );
}