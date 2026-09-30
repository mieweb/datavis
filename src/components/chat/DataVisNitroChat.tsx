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
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SuperChat } from '@mieweb/ui/components/SuperChat';

import { buildChatConversation, resolveChatFieldMap } from './chat-mapping';
import type { DataVisNitroChatProps } from './types';

export function DataVisNitroChat({
  viewData,
  columns,
  fieldMap,
  title,
  currentSender,
  order = 'asc',
  className,
}: DataVisNitroChatProps) {
  const { t } = useTranslation();

  const resolvedFieldMap = useMemo(
    () => resolveChatFieldMap(columns, fieldMap),
    [columns, fieldMap],
  );

  const conversation = useMemo(() => {
    const { participants, thread } = buildChatConversation(viewData, resolvedFieldMap);
    return {
      id: 'datavis-chat',
      title: title ?? t('CHAT.TITLE', { defaultValue: 'Conversation' }),
      participants,
      thread,
    };
  }, [viewData, resolvedFieldMap, title, t]);

  const currentParticipantId = useMemo(() => {
    if (!currentSender) return undefined;
    const normalizedTarget = currentSender.trim().toLowerCase();
    return conversation.participants.find(
      (participant) => participant.name.trim().toLowerCase() === normalizedTarget,
    )?.id;
  }, [conversation.participants, currentSender]);

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

  if (conversation.thread.length === 0) {
    return (
      <div
        data-slot="datavis-chat-empty"
        className="rounded-lg border border-border bg-muted/40 p-6 text-sm text-muted-foreground"
      >
        {t('CHAT.EMPTY', { defaultValue: 'No messages to display.' })}
      </div>
    );
  }

  return (
    <div data-slot="datavis-chat" className={className}>
      <SuperChat
        conversation={conversation}
        currentParticipantId={currentParticipantId}
        order={order}
        readOnly
      />
    </div>
  );
}

// Explicit displayName so tooling (e.g. Storybook's JSX source) shows
// `<DataVisNitroChat>` instead of the minified function name from the built bundle.
DataVisNitroChat.displayName = 'DataVisNitroChat';
