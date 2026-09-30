/**
 * Chat mapping — convert plain view rows into a SuperChat conversation.
 *
 * A plain row is a flat `Record<string, unknown>` (see `wcdatavis-interop`'s
 * `legacyRowToPlainRow`). This module resolves which fields carry chat meaning
 * (sender / message / time / …), derives one participant per distinct sender,
 * and emits a `{ participants, thread }` conversation the SuperChat component
 * renders directly.
 */

import type {
  Participant,
  ParticipantKind,
  SuperChatChannel,
  SuperChatMessage,
} from '@mieweb/ui/components/SuperChat';

import type { TableColumn } from '../table/types';
import type { ViewData } from '../../adapters/use-data';
import type { ChatFieldMap, ResolvedChatFieldMap } from './types';

/**
 * Ordered candidate field names for each chat role, used when a role is not
 * explicitly mapped. Matching is case-insensitive and ignores non-alphanumeric
 * characters (so `sender_name` matches `sendername`).
 */
export const DEFAULT_CHAT_FIELD_CANDIDATES: Record<keyof ChatFieldMap, string[]> = {
  sender: ['sender', 'sendername', 'from', 'author', 'speaker', 'participant', 'user', 'name'],
  message: ['message', 'text', 'body', 'content', 'msg', 'comment', 'note'],
  time: ['time', 'timestamp', 'date', 'sent', 'sentat', 'createdat', 'when'],
  id: ['id', 'messageid', 'msgid'],
  role: ['role', 'title', 'position'],
  avatar: ['avatar', 'photo', 'image', 'picture', 'avatarurl'],
  channel: ['channel', 'medium', 'source'],
  kind: ['kind', 'participantkind', 'sendertype', 'type'],
};

/** Accent palette assigned round-robin to distinct senders. */
const PARTICIPANT_COLORS = [
  '#2563eb', // blue
  '#059669', // emerald
  '#d97706', // amber
  '#7c3aed', // violet
  '#dc2626', // red
  '#0891b2', // cyan
  '#db2777', // pink
  '#65a30d', // lime
];

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Resolve every chat role to a concrete field name, preferring explicit
 * overrides and otherwise auto-detecting from the available columns.
 */
export function resolveChatFieldMap(
  columns: TableColumn[],
  overrides: ChatFieldMap = {},
): ResolvedChatFieldMap {
  const fieldByNormalizedName = new Map<string, string>();
  for (const column of columns) {
    fieldByNormalizedName.set(normalizeKey(column.field), column.field);
  }

  const resolved: ResolvedChatFieldMap = {};
  for (const role of Object.keys(DEFAULT_CHAT_FIELD_CANDIDATES) as (keyof ChatFieldMap)[]) {
    const override = overrides[role];
    if (override) {
      resolved[role] = override;
      continue;
    }
    for (const candidate of DEFAULT_CHAT_FIELD_CANDIDATES[role]) {
      const match = fieldByNormalizedName.get(candidate);
      if (match) {
        resolved[role] = match;
        break;
      }
    }
  }

  return resolved;
}

function toStringValue(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function resolveKind(value: unknown): ParticipantKind {
  const normalized = normalizeKey(toStringValue(value));
  if (normalized === 'agent' || normalized === 'ai' || normalized === 'assistant' || normalized === 'bot') {
    return 'agent';
  }
  if (normalized === 'system') return 'system';
  return 'human';
}

function resolveTime(value: unknown, fallbackIndex: number): Date | string {
  if (value instanceof Date) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  if (typeof value === 'string' && value.trim() !== '') return value;
  // Keep append order stable when rows carry no timestamp.
  return new Date(Date.UTC(2000, 0, 1) + fallbackIndex * 60_000);
}

function participantIdFor(senderName: string): string {
  const slug = normalizeKey(senderName);
  return slug ? `sender-${slug}` : 'sender-unknown';
}

export interface ChatConversationModel {
  participants: Participant[];
  thread: SuperChatMessage[];
}

/**
 * Build the SuperChat `{ participants, thread }` model from plain view rows.
 * Returns empty collections when the data is missing or not plain.
 */
export function buildChatConversation(
  viewData: ViewData | null,
  fieldMap: ResolvedChatFieldMap,
): ChatConversationModel {
  const rows = viewData?.isPlain && Array.isArray(viewData.data)
    ? (viewData.data as Record<string, unknown>[])
    : [];

  const participants: Participant[] = [];
  const participantsById = new Map<string, Participant>();
  const thread: SuperChatMessage[] = [];

  rows.forEach((row, index) => {
    const senderName = fieldMap.sender ? toStringValue(row[fieldMap.sender]) : '';
    const displayName = senderName.trim() || 'Unknown';
    const participantId = participantIdFor(displayName);

    if (!participantsById.has(participantId)) {
      const participant: Participant = {
        id: participantId,
        name: displayName,
        kind: fieldMap.kind ? resolveKind(row[fieldMap.kind]) : 'human',
        color: PARTICIPANT_COLORS[participantsById.size % PARTICIPANT_COLORS.length],
      };
      if (fieldMap.role) {
        const role = toStringValue(row[fieldMap.role]).trim();
        if (role) participant.role = role;
      }
      if (fieldMap.avatar) {
        const avatar = toStringValue(row[fieldMap.avatar]).trim();
        if (avatar) participant.avatar = avatar;
      }
      participantsById.set(participantId, participant);
      participants.push(participant);
    }

    const rowId = fieldMap.id ? toStringValue(row[fieldMap.id]).trim() : '';
    const message: SuperChatMessage = {
      id: rowId || toStringValue(row._rowId) || `msg-${index}`,
      participantId,
      text: fieldMap.message ? toStringValue(row[fieldMap.message]) : '',
      time: resolveTime(fieldMap.time ? row[fieldMap.time] : undefined, index),
    };
    if (fieldMap.channel) {
      const channel = toStringValue(row[fieldMap.channel]).trim();
      if (channel) message.channel = channel as SuperChatChannel;
    }
    thread.push(message);
  });

  return { participants, thread };
}
