/**
 * useGridAssistant — chat state machine connecting the Ozwell LLM to the
 * grid tool layer.
 *
 * Per turn: send history + a fresh grid-aware system prompt to Ozwell,
 * stream the reply, parse fenced-JSON tool calls out of it, execute them
 * against the grid, then feed the results back for a natural-language
 * confirmation (bounded loop so data Q&A can chain reads).
 */

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { askOzwellStream, isOzwellConfigured } from '@mieweb/ui';
import type { AIMessage, AIMessageContent, MCPToolCall, OzwellMessage } from '@mieweb/ui';
import type { GridToolContext, GridToolResult } from './grid-tools';
import { executeGridTool, getGridTool } from './grid-tools';
import { buildGridSystemPrompt } from './prompt';
import { parseAssistantReply, previewStreamingText, type ParsedToolCall } from './parse';

/** Options for the grid assistant hook. */
export interface UseGridAssistantOptions extends GridToolContext {
  /** Max LLM round-trips per user message (tool → result → follow-up). Default 3. */
  maxToolRounds?: number;
}

/** State and callbacks to wire into an AIChat component. */
export interface UseGridAssistantReturn {
  messages: AIMessage[];
  isGenerating: boolean;
  /** Whether the Ozwell backend is configured (window.__ozwell / localStorage). */
  configured: boolean;
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
}

const DEFAULT_MAX_TOOL_ROUNDS = 3;

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeMessage(role: AIMessage['role'], content: AIMessageContent[], status: AIMessage['status'] = 'complete'): AIMessage {
  return { id: makeId(), role, content, timestamp: new Date(), status };
}

function toToolCallBlock(call: ParsedToolCall): MCPToolCall {
  const def = getGridTool(call.tool);
  return {
    id: makeId(),
    toolName: call.tool,
    description: def?.description,
    parameters: Object.entries(call.params).map(([name, value]) => ({
      name,
      type: def?.parameters.find((p) => p.name === name)?.type ?? typeof value,
      value,
    })),
    status: 'running',
    startedAt: new Date(),
  };
}

function completeToolCall(toolCall: MCPToolCall, result: GridToolResult): MCPToolCall {
  const completedAt = new Date();
  return {
    ...toolCall,
    status: result.ok ? 'success' : 'error',
    completedAt,
    duration: completedAt.getTime() - new Date(toolCall.startedAt).getTime(),
    ...(result.ok
      ? { result: { type: result.data === undefined ? 'text' : 'json', data: result.data ?? result.summary, summary: result.summary } }
      : { error: result.summary }),
  };
}

export function useGridAssistant(options: UseGridAssistantOptions): UseGridAssistantReturn {
  const { view, prefs, columns, setGlobalSearch, maxToolRounds = DEFAULT_MAX_TOOL_ROUNDS } = options;
  const { t } = useTranslation();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  /**
   * Full conversation transcript sent to the LLM — includes raw assistant
   * replies (with tool JSON) and tool results, which the display messages
   * intentionally omit.
   */
  const transcriptRef = useRef<OzwellMessage[]>([]);
  const busyRef = useRef(false);

  const updateMessage = useCallback((id: string, patch: Partial<AIMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busyRef.current) return;

    setMessages((prev) => [...prev, makeMessage('user', [{ type: 'text', text: trimmed }])]);
    transcriptRef.current.push({ role: 'user', content: trimmed });

    if (!isOzwellConfigured()) {
      setMessages((prev) => [
        ...prev,
        makeMessage('assistant', [{ type: 'text', text: t('ASSISTANT.NOT_CONFIGURED') }]),
      ]);
      return;
    }

    busyRef.current = true;
    setIsGenerating(true);

    const ctx: GridToolContext = { view, prefs, columns, setGlobalSearch };

    try {
      for (let round = 0; round < maxToolRounds; round += 1) {
        const assistantId = makeId();
        setMessages((prev) => [...prev, { ...makeMessage('assistant', []), id: assistantId, status: 'streaming' }]);

        // Fresh system prompt each round so the model sees current grid state.
        const full = await askOzwellStream(
          transcriptRef.current,
          (_delta, sofar) => {
            updateMessage(assistantId, { content: [{ type: 'text', text: previewStreamingText(sofar) }] });
          },
          { system: buildGridSystemPrompt(ctx) },
        );

        transcriptRef.current.push({ role: 'assistant', content: full });
        const { toolCalls, text: replyText } = parseAssistantReply(full);

        const content: AIMessageContent[] = [];
        if (replyText) content.push({ type: 'text', text: replyText });
        const toolBlocks = toolCalls.map((call) => ({ type: 'tool_use' as const, toolCall: toToolCallBlock(call) }));
        content.push(...toolBlocks);
        updateMessage(assistantId, { content, status: 'complete' });

        if (toolCalls.length === 0) break;

        // Execute tools sequentially, updating each block's status inline.
        for (let i = 0; i < toolCalls.length; i += 1) {
          console.log('[GridAssistant] tool call:', toolCalls[i].tool, toolCalls[i].params);
          const result = await executeGridTool(ctx, toolCalls[i].tool, toolCalls[i].params);
          console.log('[GridAssistant] tool result:', toolCalls[i].tool, result);
          toolBlocks[i] = { type: 'tool_use', toolCall: completeToolCall(toolBlocks[i].toolCall, result) };
          const nextContent: AIMessageContent[] = replyText ? [{ type: 'text', text: replyText }] : [];
          nextContent.push(...toolBlocks);
          updateMessage(assistantId, { content: nextContent });
          transcriptRef.current.push({
            role: 'system',
            content: `Tool result for ${toolCalls[i].tool}: ${JSON.stringify(result)}`,
          });
        }

        // Loop: let the model confirm the outcome or chain another read.
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        makeMessage('assistant', [{
          type: 'text',
          text: t('ASSISTANT.ERROR', { message: err instanceof Error ? err.message : String(err) }),
        }], 'error'),
      ]);
    } finally {
      busyRef.current = false;
      setIsGenerating(false);
    }
  }, [view, prefs, columns, setGlobalSearch, maxToolRounds, t, updateMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    transcriptRef.current = [];
  }, []);

  return {
    messages,
    isGenerating,
    configured: isOzwellConfigured(),
    sendMessage,
    clearMessages,
  };
}
