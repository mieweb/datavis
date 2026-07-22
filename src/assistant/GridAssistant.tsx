/**
 * GridAssistant — a chat panel that lets users configure and query a
 * DataVis NITRO grid in natural language ("Hey Ozwell").
 *
 * Wraps @mieweb/ui's AIChat and wires it to useGridAssistant, which
 * translates the model's replies into grid tool executions.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AIChat } from '@mieweb/ui';
import type { AISuggestedAction } from '@mieweb/ui';
import { useGridAssistant, type UseGridAssistantOptions } from './use-grid-assistant';

export interface GridAssistantProps extends UseGridAssistantOptions {
  /** Panel title. Defaults to the localized assistant title. */
  title?: string;
  /** Suggested starter prompts shown when the chat is empty. */
  suggestions?: AISuggestedAction[];
  /** Panel height (CSS value). Default '28rem'. */
  height?: string | number;
  /** Called when the user closes the panel. */
  onClose?: () => void;
  className?: string;
}

export function GridAssistant({
  title,
  suggestions,
  height = '28rem',
  onClose,
  className,
  ...assistantOptions
}: GridAssistantProps) {
  const { t } = useTranslation();
  const { messages, isGenerating, sendMessage, clearMessages } = useGridAssistant(assistantOptions);

  const defaultSuggestions = useMemo<AISuggestedAction[]>(() => [
    { id: 'sort', label: t('ASSISTANT.SUGGESTION.SORT'), prompt: t('ASSISTANT.SUGGESTION.SORT_PROMPT') },
    { id: 'filter', label: t('ASSISTANT.SUGGESTION.FILTER'), prompt: t('ASSISTANT.SUGGESTION.FILTER_PROMPT') },
    { id: 'group', label: t('ASSISTANT.SUGGESTION.GROUP'), prompt: t('ASSISTANT.SUGGESTION.GROUP_PROMPT') },
  ], [t]);

  return (
    <section className={className} aria-label={t('ASSISTANT.PANEL_LABEL')}>
      <AIChat
        title={title ?? t('ASSISTANT.TITLE')}
        messages={messages}
        isGenerating={isGenerating}
        height={height}
        inputPlaceholder={t('ASSISTANT.INPUT_PLACEHOLDER')}
        suggestions={messages.length === 0 ? (suggestions ?? defaultSuggestions) : undefined}
        onSendMessage={sendMessage}
        onSuggestedAction={(action) => void sendMessage(action.prompt)}
        onClear={clearMessages}
        onClose={onClose}
      />
    </section>
  );
}
