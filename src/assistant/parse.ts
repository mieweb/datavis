/**
 * Tool-call parsing — extracts structured tool invocations from an
 * assistant's text reply.
 *
 * The Ozwell chat endpoint is text-only (no native function calling), so the
 * system prompt instructs the model to emit fenced ```json blocks shaped as
 * { "tool": string, "params": object }. This module finds those blocks and
 * returns both the parsed calls and the reply text with the blocks removed.
 */

/** A parsed tool invocation request from the model. */
export interface ParsedToolCall {
  tool: string;
  params: Record<string, unknown>;
}

/** Result of scanning an assistant reply for tool calls. */
export interface ParsedAssistantReply {
  /** Tool calls in the order they appeared. */
  toolCalls: ParsedToolCall[];
  /** The reply text with tool-call blocks removed (may be empty). */
  text: string;
}

const FENCED_JSON_RE = /```(?:json)?\s*\n?([\s\S]*?)```/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toToolCall(value: unknown): ParsedToolCall | null {
  if (!isRecord(value) || typeof value.tool !== 'string' || !value.tool) return null;
  return {
    tool: value.tool,
    params: isRecord(value.params) ? value.params : {},
  };
}

/**
 * Parse an assistant reply, extracting `{ "tool": …, "params": … }` blocks.
 *
 * Accepts a single object or an array of objects per fenced block. Blocks that
 * fail to parse or don't look like tool calls are left in the text untouched.
 */
export function parseAssistantReply(reply: string): ParsedAssistantReply {
  const toolCalls: ParsedToolCall[] = [];

  const text = reply.replace(FENCED_JSON_RE, (block, body: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body.trim());
    } catch {
      return block; // Not JSON — keep as-is (e.g. a code example).
    }

    const candidates = Array.isArray(parsed) ? parsed : [parsed];
    const calls = candidates.map(toToolCall);
    if (calls.some((c) => c === null)) return block; // Not a tool payload.

    toolCalls.push(...(calls as ParsedToolCall[]));
    return '';
  }).replace(/\n{3,}/g, '\n\n').trim();

  return { toolCalls, text };
}

/**
 * Display-safe preview of a partially streamed reply: completed tool-call
 * blocks are stripped, and an unterminated fenced block (a tool call still
 * streaming) is truncated so raw JSON never flashes in the chat.
 */
export function previewStreamingText(partial: string): string {
  const { text } = parseAssistantReply(partial);
  const fenceCount = (text.match(/```/g) ?? []).length;
  if (fenceCount % 2 === 1) {
    return text.slice(0, text.lastIndexOf('```')).trim();
  }
  return text;
}
