import { describe, expect, it } from 'vitest';

import type { NormalizedViewData } from '../../adapters/wcdatavis-interop';
import { buildChatConversation } from './chat-mapping';

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
