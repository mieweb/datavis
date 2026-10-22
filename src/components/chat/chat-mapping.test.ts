import { describe, expect, it } from 'vitest';

import type { NormalizedViewData } from '../../adapters/wcdatavis-interop';
import {
  ALL_ROOMS_ID,
  buildAllRoomsConversation,
  buildChatConversation,
  buildChatRooms,
  findParticipantIdBySender,
  findRoomIdByName,
  resolveChatFieldMap,
} from './chat-mapping';

function plainView(rows: Record<string, unknown>[]): NormalizedViewData {
  return { isPlain: true, isGroup: false, isPivot: false, data: rows };
}

const fieldMap = { sender: 'sender', message: 'message' };

describe('buildChatConversation', () => {
  it('keeps senders distinct when their names differ only by punctuation', () => {
    const { participants, thread } = buildChatConversation(
      plainView([
        { sender: 'A-B', message: 'one' },
        { sender: 'AB', message: 'two' },
      ]),
      fieldMap,
    );

    expect(participants.map((p) => p.name)).toEqual(['A-B', 'AB']);
    expect(new Set(participants.map((p) => p.id)).size).toBe(2);
    expect(thread[0].participantId).not.toBe(thread[1].participantId);
  });

  it('keeps non-ASCII sender names distinct', () => {
    const { participants, thread } = buildChatConversation(
      plainView([
        { sender: 'أحمد', message: 'مرحبا' },
        { sender: '王伟', message: '你好' },
        { sender: 'أحمد', message: 'شكرا' },
      ]),
      fieldMap,
    );

    expect(participants.map((p) => p.name)).toEqual(['أحمد', '王伟']);
    expect(thread.map((m) => m.participantId)).toEqual([
      participants[0].id,
      participants[1].id,
      participants[0].id,
    ]);
  });
});

describe('findParticipantIdBySender', () => {
  const { participants } = buildChatConversation(
    plainView([
      { sender: 'Alice', message: 'one' },
      { sender: 'alice', message: 'two' },
    ]),
    fieldMap,
  );

  it('matches case-distinct senders exactly', () => {
    expect(participants).toHaveLength(2);
    expect(findParticipantIdBySender(participants, 'alice')).toBe(participants[1].id);
    expect(findParticipantIdBySender(participants, 'Alice')).toBe(participants[0].id);
  });

  it('trims the requested sender and ignores blanks', () => {
    expect(findParticipantIdBySender(participants, '  alice ')).toBe(participants[1].id);
    expect(findParticipantIdBySender(participants, '  ')).toBeUndefined();
    expect(findParticipantIdBySender(participants, 'ALICE')).toBeUndefined();
  });
});

describe('resolveChatFieldMap', () => {
  it('auto-detects a room/topic column without stealing the delivery channel', () => {
    const resolved = resolveChatFieldMap([
      { field: 'Topic', header: 'Topic' },
      { field: 'channel', header: 'Channel' },
      { field: 'sender', header: 'Sender' },
    ]);

    expect(resolved.room).toBe('Topic');
    expect(resolved.channel).toBe('channel');
  });
});

describe('buildChatRooms', () => {
  const roomFieldMap = { ...fieldMap, room: 'room', time: 'time', id: 'id', parentId: 'parentId' };
  const rows = [
    { id: 'a1', room: 'Bed 12', sender: 'Alice', message: 'labs?', time: '2026-05-04T09:00:00Z' },
    { id: 'b1', room: 'Bed 14', sender: 'Bob', message: 'discharge', time: '2026-05-04T09:10:00Z' },
    { id: 'a2', room: 'Bed 12', sender: 'Bob', message: 'pending', time: '2026-05-04T09:01:00Z', parentId: 'a1' },
    { id: 'g1', room: '  ', sender: 'Alice', message: 'hello all', time: '2026-05-04T08:00:00Z' },
  ];

  it('groups rows into one conversation per room, newest room first', () => {
    const { rooms } = buildChatRooms(plainView(rows), roomFieldMap, 'General');

    expect(rooms.map((room) => room.title)).toEqual(['Bed 14', 'Bed 12', 'General']);
    expect(rooms[0].lastActivity).toEqual(new Date('2026-05-04T09:10:00Z'));
    expect(rooms[1].thread.map((m) => m.id)).toEqual(['a1', 'a2']);
    expect(rooms[1].thread[1].parentId).toBe('a1');
    expect(new Set(rooms.map((room) => room.id)).size).toBe(3);
  });

  it('shares participant ids across rooms and lists only each room’s speakers', () => {
    const { participants, rooms } = buildChatRooms(plainView(rows), roomFieldMap, 'General');
    const alice = participants.find((p) => p.name === 'Alice')!;

    expect(participants.map((p) => p.name)).toEqual(['Alice', 'Bob']);
    expect(rooms[0].participants.map((p) => p.name)).toEqual(['Bob']);
    expect(rooms[1].participants.map((p) => p.name)).toEqual(['Alice', 'Bob']);
    expect(rooms[2].thread[0].participantId).toBe(alice.id);
    expect(rooms[1].thread[0].participantId).toBe(alice.id);
  });

  it('returns no rooms for non-plain data', () => {
    const grouped = { isPlain: false, isGroup: true, isPivot: false, data: [] } as unknown as NormalizedViewData;
    expect(buildChatRooms(grouped, roomFieldMap, 'General').rooms).toEqual([]);
  });
});

describe('buildAllRoomsConversation', () => {
  const roomsModel = buildChatRooms(
    plainView([
      { id: 'a1', room: 'Bed 12', sender: 'Alice', message: 'one', time: '2026-05-04T09:00:00Z' },
      { id: 'b1', room: 'Bed 14', sender: 'Bob', message: 'two', time: '2026-05-04T09:10:00Z' },
      { id: 'a2', room: 'Bed 12', sender: 'Bob', message: 'three', time: '2026-05-04T09:05:00Z' },
    ]),
    { ...fieldMap, room: 'room', time: 'time', id: 'id' },
    'General',
  );

  it('holds every room message with the shared participants', () => {
    const all = buildAllRoomsConversation(roomsModel, 'All conversations');

    expect(all.id).toBe(ALL_ROOMS_ID);
    expect(all.title).toBe('All conversations');
    expect(all.participants).toBe(roomsModel.participants);
    expect(all.thread.map((m) => m.id).sort()).toEqual(['a1', 'a2', 'b1']);
    expect(all.lastActivity).toEqual(new Date('2026-05-04T09:10:00Z'));
  });
});

describe('findRoomIdByName', () => {
  const { rooms } = buildChatRooms(
    plainView([
      { room: 'Bed 12', sender: 'Alice', message: 'one' },
      { room: 'bed 12', sender: 'Alice', message: 'two' },
    ]),
    { ...fieldMap, room: 'room' },
    'General',
  );

  it('matches room names exactly after trimming', () => {
    expect(rooms).toHaveLength(2);
    const byTitle = Object.fromEntries(rooms.map((room) => [room.title, room.id]));
    expect(findRoomIdByName(rooms, ' bed 12 ')).toBe(byTitle['bed 12']);
    expect(findRoomIdByName(rooms, 'Bed 12')).toBe(byTitle['Bed 12']);
    expect(findRoomIdByName(rooms, 'BED 12')).toBeUndefined();
    expect(findRoomIdByName(rooms, '')).toBeUndefined();
  });
});
