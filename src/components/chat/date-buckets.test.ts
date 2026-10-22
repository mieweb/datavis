import { describe, expect, it } from 'vitest';
import type { SuperChatMessage } from '@mieweb/ui/components/SuperChat';

import { resolveRelativeDateRanges } from '../../adapters/relative-date-groups';
import { buildDateBucketDrillFilter, splitThreadByDateBucket } from './date-buckets';

// Thursday 7 May 2026, 15:00 local time.
const NOW = new Date(2026, 4, 7, 15);
const ranges = resolveRelativeDateRanges({ now: NOW });

function message(id: string, time: string): SuperChatMessage {
  return { id, participantId: 'p', text: id, time };
}

const thread = [
  message('old', '2025-11-02T10:00:00'),
  message('mon', '2026-05-04T08:00:00'),
  message('tue', '2026-05-05T08:00:00'),
  message('now', '2026-05-07T09:00:00'),
];

describe('splitThreadByDateBucket', () => {
  it('lists non-empty buckets newest first, keeping message order', () => {
    expect(
      splitThreadByDateBucket(thread, ranges).map(({ bucket, thread: messages }) => [bucket, messages.map((m) => m.id)]),
    ).toEqual([
      ['today', ['now']],
      ['this_week', ['mon', 'tue']],
      ['older', ['old']],
    ]);
  });

  it('skips messages without a valid date', () => {
    expect(splitThreadByDateBucket([message('bad', 'not a date')], ranges)).toEqual([]);
  });
});

describe('buildDateBucketDrillFilter', () => {
  const fieldMap = { time: 'sentAt', room: 'room' };

  it('combines the room and the runtime date range', () => {
    expect(buildDateBucketDrillFilter(fieldMap, 'this_week', 'Bed 12', { now: NOW })).toEqual({
      room: { $eq: 'Bed 12' },
      sentAt: { $gte: '2026-05-04 00:00:00', $lt: '2026-05-07 00:00:00' },
    });
  });

  it('matches blank room values for the untitled room', () => {
    expect(buildDateBucketDrillFilter(fieldMap, 'today', '', { now: NOW }).room).toEqual({ $exists: false });
  });

  it('filters only the time field outside rooms mode', () => {
    expect(buildDateBucketDrillFilter(fieldMap, 'older', undefined, { now: NOW })).toEqual({
      sentAt: { $lt: '2026-01-01 00:00:00' },
    });
  });
});
