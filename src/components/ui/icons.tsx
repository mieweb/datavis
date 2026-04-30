import {
  Bell,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  ChevronsUpDown,
  CircleHelp,
  ClipboardList,
  FileText,
  GripVertical,
  RefreshCw,
  Search,
  Send,
  Settings,
  User,
  X,
} from 'lucide-react';

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
  return <CircleHelp className={iconClassName(className)} aria-hidden="true" />;
}

export function SettingsIcon({ className }: MiewebIconProps) {
  return <Settings className={iconClassName(className)} aria-hidden="true" />;
}

export function SearchIcon({ className }: MiewebIconProps) {
  return <Search className={iconClassName(className)} aria-hidden="true" />;
}

export function DocumentIcon({ className }: MiewebIconProps) {
  return <FileText className={iconClassName(className)} aria-hidden="true" />;
}

export function ClipboardIcon({ className }: MiewebIconProps) {
  return <ClipboardList className={iconClassName(className)} aria-hidden="true" />;
}

export function CalendarIcon({ className }: MiewebIconProps) {
  return <Calendar className={iconClassName(className)} aria-hidden="true" />;
}

export function UserIcon({ className }: MiewebIconProps) {
  return <User className={iconClassName(className)} aria-hidden="true" />;
}

export function BellIcon({ className }: MiewebIconProps) {
  return <Bell className={iconClassName(className)} aria-hidden="true" />;
}

export function RefreshGlyphIcon({ className }: MiewebIconProps) {
  return <RefreshCw className={iconClassName(className)} aria-hidden="true" />;
}

export function CloseGlyphIcon({ className }: MiewebIconProps) {
  return <X className={iconClassName(className)} aria-hidden="true" />;
}

export function SendGlyphIcon({ className }: MiewebIconProps) {
  return <Send className={iconClassName(className)} aria-hidden="true" />;
}

const chevronMap = {
  up: ChevronUp,
  down: ChevronDown,
  left: ChevronLeft,
  right: ChevronRight,
} as const;

export interface ChevronGlyphIconProps extends MiewebIconProps {
  direction: 'up' | 'down' | 'left' | 'right';
}

export function ChevronGlyphIcon({ className, direction }: ChevronGlyphIconProps) {
  const Icon = chevronMap[direction];
  return <Icon className={iconClassName(className)} aria-hidden="true" />;
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

  return <ChevronsUpDown className={iconClassName(className)} aria-hidden="true" />;
}

export interface DoubleChevronGlyphIconProps extends MiewebIconProps {
  direction: 'up' | 'down';
}

export function DoubleChevronGlyphIcon({ className, direction }: DoubleChevronGlyphIconProps) {
  const Icon = direction === 'up' ? ChevronsUp : ChevronsDown;
  return <Icon className={iconClassName(className)} aria-hidden="true" />;
}

export function DragHandleIcon({ className }: MiewebIconProps) {
  return <GripVertical className={iconClassName(className)} aria-hidden="true" />;
}