/**
 * Date-bucket sub-grouping for chat rooms — splits a room's messages into the
 * relative date buckets from {@link resolveRelativeDateRanges} (shown nested
 * under the room in the conversation list) and builds the drill-down filter
 * for a bucket (room + runtime date range).
 */

import type { SuperChatMessage } from '@mieweb/ui/components/SuperChat';

import {
  RELATIVE_DATE_BUCKETS,
  relativeDateBucketOf,
  relativeDateBucketToFilter,
  type DateRange,
  type RelativeDateBucket,
  type RelativeDateOptions,
} from '../../adapters/relative-date-groups';
import type { FilterSpec } from '../filters/types';
import type { ResolvedChatFieldMap } from './types';

/** Translation key and English fallback for each date bucket's label. */
export const DATE_BUCKET_LABELS: Record<RelativeDateBucket, { key: string; fallback: string }> = {
  today: { key: 'CHAT.DATE_BUCKET.TODAY', fallback: 'Today' },
  this_week: { key: 'CHAT.DATE_BUCKET.THIS_WEEK', fallback: 'Earlier this week' },
  this_month: { key: 'CHAT.DATE_BUCKET.THIS_MONTH', fallback: 'Earlier this month' },
  this_year: { key: 'CHAT.DATE_BUCKET.THIS_YEAR', fallback: 'Earlier this year' },
  older: { key: 'CHAT.DATE_BUCKET.OLDER', fallback: 'Older' },
};

export interface DateBucketThread {
  bucket: RelativeDateBucket;
  thread: SuperChatMessage[];
}

/**
 * Split `thread` into its non-empty date buckets, newest bucket first; each
 * bucket keeps the messages' original order. Messages without a valid date
 * belong to no bucket.
 */
export function splitThreadByDateBucket(
  thread: SuperChatMessage[],
  ranges: Record<RelativeDateBucket, DateRange>,
): DateBucketThread[] {
  const byBucket = new Map<RelativeDateBucket, SuperChatMessage[]>();
  for (const message of thread) {
    const bucket = relativeDateBucketOf(message.time, ranges);
    if (!bucket) continue;
    const messages = byBucket.get(bucket);
    if (messages) messages.push(message);
    else byBucket.set(bucket, [message]);
  }
  return RELATIVE_DATE_BUCKETS
    .filter((bucket) => byBucket.has(bucket))
    .map((bucket) => ({ bucket, thread: byBucket.get(bucket)! }));
}

/**
 * The drill-down filter for a date bucket, resolved at call time: the time
 * field restricted to the bucket's range and, in rooms mode, the room field
 * restricted to `roomName` (`''` = the untitled room, i.e. a blank value).
 */
export function buildDateBucketDrillFilter(
  fieldMap: ResolvedChatFieldMap,
  bucket: RelativeDateBucket,
  roomName: string | undefined,
  options: RelativeDateOptions = {},
): FilterSpec {
  const filter: FilterSpec = {};
  if (fieldMap.room && roomName !== undefined) {
    filter[fieldMap.room] = roomName ? { $eq: roomName } : { $exists: false };
  }
  if (fieldMap.time) {
    filter[fieldMap.time] = relativeDateBucketToFilter(bucket, options);
  }
  return filter;
}
