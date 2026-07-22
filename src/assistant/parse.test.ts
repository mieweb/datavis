import { describe, expect, it } from 'vitest';

import { parseAssistantReply, previewStreamingText } from './parse';

describe('parseAssistantReply', () => {
  it('returns plain text untouched when there are no tool calls', () => {
    const { toolCalls, text } = parseAssistantReply('Just a normal answer.');
    expect(toolCalls).toEqual([]);
    expect(text).toBe('Just a normal answer.');
  });

  it('extracts a single fenced tool call and strips it from the text', () => {
    const reply = [
      "I'll sort that for you.",
      '```json',
      '{"tool": "grid_set_sort", "params": {"sorts": [{"field": "salary", "direction": "desc"}]}}',
      '```',
    ].join('\n');

    const { toolCalls, text } = parseAssistantReply(reply);
    expect(toolCalls).toEqual([
      { tool: 'grid_set_sort', params: { sorts: [{ field: 'salary', direction: 'desc' }] } },
    ]);
    expect(text).toBe("I'll sort that for you.");
  });

  it('supports an array of tool calls in one block', () => {
    const reply = [
      '```json',
      '[{"tool": "grid_clear", "params": {"targets": ["all"]}}, {"tool": "grid_set_group", "params": {"fields": ["department"]}}]',
      '```',
    ].join('\n');

    const { toolCalls } = parseAssistantReply(reply);
    expect(toolCalls.map((c) => c.tool)).toEqual(['grid_clear', 'grid_set_group']);
  });

  it('defaults missing params to an empty object', () => {
    const { toolCalls } = parseAssistantReply('```json\n{"tool": "grid_reset"}\n```');
    expect(toolCalls).toEqual([{ tool: 'grid_reset', params: {} }]);
  });

  it('leaves non-tool JSON blocks in the text', () => {
    const reply = 'Here is the data:\n```json\n{"rows": [1, 2, 3]}\n```';
    const { toolCalls, text } = parseAssistantReply(reply);
    expect(toolCalls).toEqual([]);
    expect(text).toContain('"rows"');
  });

  it('ignores malformed JSON blocks without crashing', () => {
    const reply = '```json\n{"tool": "grid_set_sort", oops\n```';
    const { toolCalls, text } = parseAssistantReply(reply);
    expect(toolCalls).toEqual([]);
    expect(text).toContain('oops');
  });
});

describe('previewStreamingText', () => {
  it('strips completed tool blocks', () => {
    const partial = 'Working on it.\n```json\n{"tool": "grid_reset"}\n```\nDone';
    expect(previewStreamingText(partial)).toBe('Working on it.\n\nDone');
  });

  it('truncates an unterminated fence', () => {
    const partial = 'Sorting now.\n```json\n{"tool": "grid_set_sort", "par';
    expect(previewStreamingText(partial)).toBe('Sorting now.');
  });
});
