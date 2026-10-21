/**
 * Chat mapping — convert plain view rows into a SuperChat conversation.
 *
 * A plain row is a flat `Record<string, unknown>` (see `wcdatavis-interop`'s
 * `legacyRowToPlainRow`). This module resolves which fields carry chat meaning
 * (sender / message / time / …), derives one participant per distinct sender,
 * and emits a `{ participants, thread }` conversation the SuperChat component
 * renders directly — or, with a `room` field, one conversation per room/topic
 * for the SuperChat conversation list.
 */

import type {
  Participant,
  ParticipantKind,
  SuperChatChannel,
  SuperChatConversation,
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
  id: ['messageid', 'msgid', 'id'],
  parentId: ['parentmessageid', 'parentmsgid', 'parentid', 'replyto', 'inreplyto', 'parent'],
  room: ['room', 'roomname', 'topic', 'topicname', 'conversation', 'conversationname'],
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

export interface ChatConversationModel {
  participants: Participant[];
  thread: SuperChatMessage[];
}

/**
 * Rows grouped into rooms/topics (the top-level conversation list). Participant
 * ids are shared across rooms, so a sender keeps the same id and accent color
 * in every room; `participants` lists everyone, each room lists its own.
 */
export interface ChatRoomsModel {
  participants: Participant[];
  rooms: SuperChatConversation[];
}

/** Participant id for `sender`, using the same exact (trimmed) identity as {@link buildChatConversation}. */
export function findParticipantIdBySender(
  participants: Participant[],
  sender: string | undefined,
): string | undefined {
  const target = sender?.trim();
  if (!target) return undefined;
  return participants.find((participant) => participant.name === target)?.id;
}

function plainRows(viewData: ViewData | null): Record<string, unknown>[] {
  return viewData?.isPlain && Array.isArray(viewData.data)
    ? (viewData.data as Record<string, unknown>[])
    : [];
}

/** Assigns one participant per distinct (exact, trimmed) sender name. */
function createParticipantRegistry(fieldMap: ResolvedChatFieldMap) {
  const participants: Participant[] = [];
  // Keyed by the exact sender name; ids are opaque so distinct names never collide.
  const participantBySender = new Map<string, Participant>();

  function participantFor(row: Record<string, unknown>): Participant {
    const senderName = fieldMap.sender ? toStringValue(row[fieldMap.sender]) : '';
    const displayName = senderName.trim() || 'Unknown';
    const existing = participantBySender.get(displayName);
    if (existing) return existing;

    const participant: Participant = {
      id: `sender-${participants.length}`,
      name: displayName,
      kind: fieldMap.kind ? resolveKind(row[fieldMap.kind]) : 'human',
      color: PARTICIPANT_COLORS[participants.length % PARTICIPANT_COLORS.length],
    };
    if (fieldMap.role) {
      const role = toStringValue(row[fieldMap.role]).trim();
      if (role) participant.role = role;
    }
    if (fieldMap.avatar) {
      const avatar = toStringValue(row[fieldMap.avatar]).trim();
      if (avatar) participant.avatar = avatar;
    }
    participantBySender.set(displayName, participant);
    participants.push(participant);
    return participant;
  }

  return { participants, participantFor };
}

function buildMessage(
  row: Record<string, unknown>,
  index: number,
  fieldMap: ResolvedChatFieldMap,
  participantId: string,
): SuperChatMessage {
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
  // `parentId` links replies so SuperChat can render a native threaded tree.
  const parentId = fieldMap.parentId ? toStringValue(row[fieldMap.parentId]).trim() : '';
  if (parentId) {
    message.parentId = parentId;
  }
  return message;
}

/**
 * Build the SuperChat `{ participants, thread }` model from plain view rows.
 * Returns empty collections when the data is missing or not plain.
 */
export function buildChatConversation(
  viewData: ViewData | null,
  fieldMap: ResolvedChatFieldMap,
): ChatConversationModel {
  const { participants, participantFor } = createParticipantRegistry(fieldMap);
  const thread = plainRows(viewData).map((row, index) =>
    buildMessage(row, index, fieldMap, participantFor(row).id),
  );
  return { participants, thread };
}

function latestMessageTime(room: SuperChatConversation): number {
  let latest = -Infinity;
  for (const message of room.thread) {
    const time = new Date(message.time).getTime();
    if (time > latest) latest = time;
  }
  return latest;
}

/**
 * Group plain view rows into rooms/topics by the `room` field, one SuperChat
 * conversation per distinct (exact, trimmed) room value. Rooms are ordered by
 * their latest message, newest first — the same order the SuperChat
 * conversation list shows. Rows with a blank room value are collected under
 * `untitledRoomTitle`.
 * Returns empty collections when the data is missing or not plain.
 */
export function buildChatRooms(
  viewData: ViewData | null,
  fieldMap: ResolvedChatFieldMap,
  untitledRoomTitle: string,
): ChatRoomsModel {
  const { participants, participantFor } = createParticipantRegistry(fieldMap);
  const rooms: SuperChatConversation[] = [];
  // Keyed by the exact room name ('' = untitled); ids are opaque like sender ids.
  const roomByName = new Map<string, SuperChatConversation>();

  plainRows(viewData).forEach((row, index) => {
    const roomName = fieldMap.room ? toStringValue(row[fieldMap.room]).trim() : '';
    let room = roomByName.get(roomName);
    if (!room) {
      room = {
        id: `room-${rooms.length}`,
        title: roomName || untitledRoomTitle,
        participants: [],
        thread: [],
      };
      roomByName.set(roomName, room);
      rooms.push(room);
    }

    const participant = participantFor(row);
    if (!room.participants.includes(participant)) {
      room.participants.push(participant);
    }
    room.thread.push(buildMessage(row, index, fieldMap, participant.id));
  });

  rooms.sort((a, b) => latestMessageTime(b) - latestMessageTime(a));
  return { participants, rooms };
}

/** Room id for `roomName`, using the same exact (trimmed) identity as {@link buildChatRooms}. */
export function findRoomIdByName(
  rooms: SuperChatConversation[],
  roomName: string | undefined,
): string | undefined {
  const target = roomName?.trim();
  if (!target) return undefined;
  return rooms.find((room) => room.title === target)?.id;
}
