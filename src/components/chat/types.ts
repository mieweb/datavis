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
  /** Conversation title shown in the SuperChat header. */
  title?: string;
  /**
   * The participant treated as the local user (right-aligned bubbles). Matched
   * against the resolved sender value. Defaults to no local user.
   */
  currentSender?: string;
  /** Thread order: `asc` (oldest→newest, default) or `desc` (feed style). */
  order?: 'asc' | 'desc';
  /** Additional class name forwarded to the SuperChat container. */
  className?: string;
}
