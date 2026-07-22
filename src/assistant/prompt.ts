/**
 * System-prompt builder for the grid assistant.
 *
 * Because the Ozwell chat endpoint is text-only, the prompt teaches the model
 * a fenced-JSON tool-call protocol and documents the grid's columns, current
 * state, and available tools so it can translate natural language into
 * precise tool invocations.
 */

import type { GridToolContext, GridToolDefinition } from './grid-tools';
import { GRID_TOOLS } from './grid-tools';

function describeTool(tool: GridToolDefinition): string {
  const params = tool.parameters.length === 0
    ? '  (no parameters)'
    : tool.parameters
        .map((p) => `  - ${p.name} (${p.type}${p.required ? ', required' : ''}): ${p.description}`)
        .join('\n');
  return `### ${tool.name}\n${tool.description}\n${params}`;
}

function describeColumns(ctx: GridToolContext): string {
  return ctx.columns
    .map((c) => `- ${c.field}${c.type ? ` (${c.type})` : ''}: "${c.header}"`)
    .join('\n');
}

function describeState(ctx: GridToolContext): string {
  const { view } = ctx;
  const state = {
    sort: view.getSort?.() ?? null,
    filter: view.getFilter?.() ?? null,
    group: view.getGroup?.() ?? null,
    pivot: view.getPivot?.() ?? null,
    aggregate: view.getAggregate?.() ?? null,
  };
  return JSON.stringify(state);
}

/**
 * Build the system prompt for a chat turn. Called fresh per turn so the
 * model always sees the grid's current configuration.
 */
export function buildGridSystemPrompt(ctx: GridToolContext): string {
  return `You are Ozwell, an assistant that controls a data grid on the user's screen. You translate the user's natural-language requests into tool calls that configure the grid (sorting, filtering, grouping, pivoting, aggregates, search, perspectives) and you answer questions about the visible data.

## How to call tools
To perform a grid action, reply with a fenced json code block containing exactly one object:
\`\`\`json
{ "tool": "<tool name>", "params": { ... } }
\`\`\`
Rules:
- You may include several fenced json blocks in one reply to perform several actions.
- Any text outside the blocks is shown to the user — keep it to one short sentence, or omit it.
- Never say you will do or check something without including the fenced json tool call in the same reply. Saying "I'll check" without a tool block is an error — nothing will happen.
- Use exact field names from the column list below. Never invent fields or tools.
- After each tool runs you will receive its result as a system message; use it to confirm the outcome to the user in plain language, or to correct your call if it failed.
- To answer questions about the data (counts, averages, sums, extremes, distinct values), call grid_query_data — it computes exact answers over all visible rows. Use grid_get_state for the current configuration and row counts, and grid_get_data only when the user wants to see example rows.
- If the user's request is ambiguous (e.g. which column they mean), ask a short clarifying question instead of guessing.

## Example
User: "What's the average salary in marketing?"
Your reply:
\`\`\`json
{ "tool": "grid_query_data", "params": { "operation": "avg", "field": "salary", "where": [{ "field": "department", "operator": "$eq", "value": "Marketing" }] } }
\`\`\`
Then, after the tool result arrives, answer in plain language.

## Grid columns
${describeColumns(ctx)}

## Current grid state
${describeState(ctx)}

## Available tools
${GRID_TOOLS.map(describeTool).join('\n\n')}`;
}
