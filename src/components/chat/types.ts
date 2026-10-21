/**
 * Chat display-mode types.
 *
 * The chat display mode renders **plain** (ungrouped, unpivoted) view rows as
 * conversation messages in the `@mieweb/ui` SuperChat surface instead of table
 * rows. Each row becomes one message; specially-named fields carry the chat
 * semantics (who is speaking, what they said, when, on which channel, …).
 */

import type { TableColumn } from '../table/types';
import type { ViewData } from '../../adapters/use-data';

/**
 * Which data field supplies each chat role. Every entry is a field name (a key
 * in the plain row objects). Omitted roles fall back to
 * {@link DEFAULT_CHAT_FIELD_CANDIDATES} auto-detection against the columns.
 */
export interface ChatFieldMap {
  /** Field whose value is the speaker's display name (bubble author). */
  sender?: string;
  /** Field whose value is the message body, rendered as Markdown. */
  message?: string;
  /** Field whose value is the message timestamp (Date, ISO string, or epoch). */
  time?: string;
  /** Field whose value is a stable message id (defaults to the row id). */
  id?: string;
  /**
   * Field whose value is the id of this message's parent (its `messageId`).
   * When present, the conversation renders as a collapsible tree: messages that
   * share a `parentMessageId` are nested under it, ordered by `time`. Rows with
   * no parent (or an unknown parent) are top-level roots.
   */
  parentId?: string;
  /**
   * Field whose value names the room/topic a message belongs to. When present,
   * rows are grouped into one conversation per distinct room, listed in a
   * SuperChat conversation list above the (optionally threaded) messages.
   */
  room?: string;
  /** Field whose value is the speaker's sub-label / role (e.g. "Triage"). */
  role?: string;
  /** Field whose value is the speaker's avatar image URL. */
  avatar?: string;
  /** Field whose value is the delivery channel (portal / sms / voicemail / …). */
  channel?: string;
  /**
   * Field whose value classifies the speaker as `human`, `agent`, or `system`.
   * Values are matched case-insensitively; anything else defaults to `human`.
   */
  kind?: string;
}

/** One resolved chat role → concrete field name (after auto-detection). */
export type ResolvedChatFieldMap = ChatFieldMap;

export interface DataVisNitroChatProps {
  /** Processed view data from `useView()`. Only plain data is rendered. */
  viewData: ViewData | null;
  /** Column definitions (used for header labels and field auto-detection). */
  columns: TableColumn[];
  /**
   * Explicit role → field overrides. Anything omitted is auto-detected from the
   * available columns using {@link DEFAULT_CHAT_FIELD_CANDIDATES}.
   */
  fieldMap?: ChatFieldMap;
  /**
   * Conversation title shown in the SuperChat header. Ignored when rows are
   * grouped into rooms — each room's header shows its room name instead.
   */
  title?: string;
  /**
   * Group rows into rooms/topics when a `room` field is available, showing a
   * conversation list (one entry per room) beside the active room's messages.
   * Defaults to `true`; set `false` to render every row as one conversation.
   */
  showRooms?: boolean;
  /**
   * Room selected on first render, matched exactly (after trimming) against the
   * room value. Defaults to the most recently active room.
   */
  defaultActiveRoom?: string;
  /**
   * The participant treated as the local user (right-aligned bubbles). Matched
   * exactly (after trimming) against the resolved sender value, the same
   * identity rule used to group participants. Defaults to no local user.
   */
  currentSender?: string;
  /** Thread order: `asc` (oldest→newest, default) or `desc` (feed style). */
  order?: 'asc' | 'desc';
  /**
   * Threaded (tree) rendering, used when a `parentId` field is available:
   * - `'auto'` (default) — render the collapsible tree only when at least one
   *   message actually references a parent; otherwise fall back to the flat
   *   SuperChat thread.
   * - `true` — always render the threaded tree when a `parentId` field exists.
   * - `false` — never thread; always render the flat SuperChat thread.
   */
  threaded?: 'auto' | boolean;
  /** Collapse every thread with replies on first render. Defaults to `false`. */
  defaultCollapsed?: boolean;
  /** Additional class name forwarded to the SuperChat container. */
  className?: string;
}
