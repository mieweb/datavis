/**
 * DataVisNitroChat — the "chat" display mode for DataVis.
 *
 * Renders plain view rows as messages in the `@mieweb/ui` SuperChat surface
 * instead of as rows in a table. Drop it into `<DataGrid>` in place of
 * `<TableRenderer>`, or use it standalone. Only plain (ungrouped, unpivoted)
 * data is supported; grouped/pivoted data renders an explanatory placeholder.
 *
 * Field semantics are resolved from the column names (see
 * {@link resolveChatFieldMap}) or overridden via the `fieldMap` prop:
 *   - `sender`  → the bubble author's display name
 *   - `message` → the Markdown message body
 *   - `time`    → the message timestamp (thread ordering)
 *   - `role` / `avatar` / `channel` / `kind` → participant + message metadata
 *
 * When a `parentId` field (e.g. `parentMessageId`) is present, replies are
 * linked via each message's `parentId` and SuperChat renders them as a native
 * collapsible reply tree (see its `threaded` / `defaultCollapsed` props).
 *
 * When a `room` field (e.g. `room` / `topic`) is present, rows are grouped into
 * one conversation per room and rendered through SuperChatInbox: a conversation
 * list of rooms above (beside) each room's — optionally threaded — messages.
 *
 * With a `time` field, each room's messages are sub-grouped into relative date
 * buckets (Today / Earlier this week / … / Older), nested under the room in the
 * conversation list. The room acts as an accordion header (all its messages);
 * opening a bucket shows just that timeframe and reports the bucket's
 * runtime-resolved date-range filter via `onDrillDown`.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SuperChat,
  SuperChatInbox,
  type SuperChatConversation,
} from '@mieweb/ui/components/SuperChat';

import {
  resolveRelativeDateRanges,
  type RelativeDateBucket,
} from '../../adapters/relative-date-groups';
import {
  buildAllRoomsConversation,
  buildChatConversation,
  buildChatRooms,
  findParticipantIdBySender,
  findRoomIdByName,
  resolveChatFieldMap,
  type ChatConversationModel,
  type ChatRoomsModel,
} from './chat-mapping';
import {
  buildDateBucketDrillFilter,
  DATE_BUCKET_LABELS,
  splitThreadByDateBucket,
} from './date-buckets';
import type { DataVisNitroChatProps } from './types';

/** A whole (room-less) conversation, shaped like a single-room model. */
function singleConversationModel(
  { participants, thread }: ChatConversationModel,
  title: string,
): ChatRoomsModel {
  // No room names: drill-down filters then constrain only the time field.
  return { participants, rooms: [{ id: 'datavis-chat', title, participants, thread }], roomNameById: {} };
}

export function DataVisNitroChat({
  viewData,
  columns,
  fieldMap,
  title,
  showRooms = true,
  defaultActiveRoom,
  showDateBuckets = true,
  weekStartsOn = 1,
  now,
  onDrillDown,
  currentSender,
  order = 'asc',
  threaded = 'auto',
  defaultCollapsed = false,
  className,
}: DataVisNitroChatProps) {
  const { t } = useTranslation();

  const resolvedFieldMap = useMemo(
    () => resolveChatFieldMap(columns, fieldMap),
    [columns, fieldMap],
  );
  const groupByRoom = showRooms && Boolean(resolvedFieldMap.room);
  const bucketByDate = showDateBuckets && Boolean(resolvedFieldMap.time);

  const model = useMemo(() => {
    const base: ChatRoomsModel = groupByRoom
      ? buildChatRooms(viewData, resolvedFieldMap, t('CHAT.UNTITLED_ROOM', { defaultValue: 'General' }))
      : singleConversationModel(
        buildChatConversation(viewData, resolvedFieldMap),
        title ?? t('CHAT.TITLE', { defaultValue: 'Conversation' }),
      );
    const { participants, roomNameById } = base;
    // With several rooms, an "All conversations" entry leads the list so the
    // complete message list is always one click away. It sorts first: its
    // latest activity ties the newest room's and the list's sort is stable.
    let conversations = groupByRoom && base.rooms.length > 1
      ? [
        buildAllRoomsConversation(base, t('CHAT.ALL_CONVERSATIONS', { defaultValue: 'All conversations' })),
        ...base.rooms,
      ]
      : base.rooms;
    const messageCount = base.rooms.reduce((n, c) => n + c.thread.length, 0);

    // Nest each conversation's date buckets under it as child conversations,
    // resolved against the current time whenever the data changes.
    const bucketById = new Map<string, { parentId: string; bucket: RelativeDateBucket }>();
    if (bucketByDate) {
      const ranges = resolveRelativeDateRanges({ now, weekStartsOn });
      conversations = conversations.map((conversation) => ({
        ...conversation,
        children: splitThreadByDateBucket(conversation.thread, ranges).map(({ bucket, thread }) => {
          const id = `${conversation.id}:${bucket}`;
          bucketById.set(id, { parentId: conversation.id, bucket });
          const label = DATE_BUCKET_LABELS[bucket];
          return {
            id,
            title: t(label.key, { defaultValue: label.fallback }),
            participants: conversation.participants,
            thread,
          };
        }),
      }));
    }

    return { participants, conversations, roomNameById, bucketById, messageCount };
  }, [groupByRoom, bucketByDate, viewData, resolvedFieldMap, title, now, weekStartsOn, t]);

  const currentParticipantId = useMemo(
    () => findParticipantIdBySender(model.participants, currentSender),
    [model.participants, currentSender],
  );

  if (viewData && !viewData.isPlain) {
    return (
      <div
        data-slot="datavis-chat-unsupported"
        className="rounded-lg border border-border bg-muted/40 p-6 text-sm text-muted-foreground"
      >
        {t('CHAT.PLAIN_ONLY', {
          defaultValue: 'Chat mode shows plain rows as messages. Clear grouping and pivoting to view the conversation.',
        })}
      </div>
    );
  }

  if (model.messageCount === 0) {
    return (
      <div
        data-slot="datavis-chat-empty"
        className="rounded-lg border border-border bg-muted/40 p-6 text-sm text-muted-foreground"
      >
        {t('CHAT.EMPTY', { defaultValue: 'No messages to display.' })}
      </div>
    );
  }

  // Opening a date bucket is a drill-down: report its room + runtime-resolved
  // date range so a host can apply it as a real view filter.
  const handleConversationOpened = (conversation: SuperChatConversation) => {
    const opened = model.bucketById.get(conversation.id);
    if (!opened || !onDrillDown) return;
    onDrillDown(buildDateBucketDrillFilter(
      resolvedFieldMap,
      opened.bucket,
      model.roomNameById[opened.parentId],
      { now, weekStartsOn },
    ));
  };

  // 'auto' defers to SuperChat's own detection (threads when any message has a
  // parentId); an explicit boolean forces it on or off.
  const threadedProp = threaded === 'auto' ? undefined : threaded;
  const [onlyConversation] = model.conversations;
  const showList = groupByRoom || Boolean(onlyConversation?.children?.length);

  return (
    <div
      data-slot="datavis-chat"
      className={['flex min-h-0 flex-col', className].filter(Boolean).join(' ')}
    >
      {showList ? (
        <SuperChatInbox
          // Re-key on the requested room so changing `defaultActiveRoom` reselects.
          key={defaultActiveRoom}
          conversations={model.conversations}
          defaultActiveConversationId={findRoomIdByName(model.conversations, defaultActiveRoom)}
          onConversationOpened={handleConversationOpened}
          currentParticipantId={currentParticipantId}
          order={order}
          threaded={threadedProp}
          defaultCollapsed={defaultCollapsed}
          readOnly
          className="min-h-0 flex-1"
        />
      ) : (
        <SuperChat
          conversation={onlyConversation}
          currentParticipantId={currentParticipantId}
          order={order}
          threaded={threadedProp}
          defaultCollapsed={defaultCollapsed}
          readOnly
          className="min-h-0"
        />
      )}
    </div>
  );
}

// Explicit displayName so tooling (e.g. Storybook's JSX source) shows
// `<DataVisNitroChat>` instead of the minified function name from the built bundle.
DataVisNitroChat.displayName = 'DataVisNitroChat';

// A transcript has no "show more" control, so <DataGrid> passes every row.
DataVisNitroChat.rendersAllRows = true;

