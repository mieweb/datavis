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
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SuperChat, SuperChatInbox } from '@mieweb/ui/components/SuperChat';

import {
  buildChatConversation,
  buildChatRooms,
  findParticipantIdBySender,
  findRoomIdByName,
  resolveChatFieldMap,
} from './chat-mapping';
import type { DataVisNitroChatProps } from './types';

export function DataVisNitroChat({
  viewData,
  columns,
  fieldMap,
  title,
  showRooms = true,
  defaultActiveRoom,
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

  const model = useMemo(() => {
    if (groupByRoom) {
      const { participants, rooms } = buildChatRooms(
        viewData,
        resolvedFieldMap,
        t('CHAT.UNTITLED_ROOM', { defaultValue: 'General' }),
      );
      return { kind: 'rooms' as const, participants, rooms, messageCount: rooms.reduce((n, room) => n + room.thread.length, 0) };
    }
    const { participants, thread } = buildChatConversation(viewData, resolvedFieldMap);
    const conversation = {
      id: 'datavis-chat',
      title: title ?? t('CHAT.TITLE', { defaultValue: 'Conversation' }),
      participants,
      thread,
    };
    return { kind: 'single' as const, participants, conversation, messageCount: thread.length };
  }, [groupByRoom, viewData, resolvedFieldMap, title, t]);

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

  // 'auto' defers to SuperChat's own detection (threads when any message has a
  // parentId); an explicit boolean forces it on or off.
  const threadedProp = threaded === 'auto' ? undefined : threaded;

  return (
    <div
      data-slot="datavis-chat"
      className={['flex min-h-0 flex-col', className].filter(Boolean).join(' ')}
    >
      {model.kind === 'rooms' ? (
        <SuperChatInbox
          // Re-key on the requested room so changing `defaultActiveRoom` reselects.
          key={defaultActiveRoom}
          conversations={model.rooms}
          defaultActiveConversationId={findRoomIdByName(model.rooms, defaultActiveRoom)}
          currentParticipantId={currentParticipantId}
          order={order}
          threaded={threadedProp}
          defaultCollapsed={defaultCollapsed}
          readOnly
          className="min-h-0 flex-1"
        />
      ) : (
        <SuperChat
          conversation={model.conversation}
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
