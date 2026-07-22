/**
 * Grid assistant — natural-language grid control ("Hey Ozwell").
 *
 * - grid-tools: pure tool registry executing against ViewInstance/PrefsInstance
 * - prompt: grid-aware system prompt builder
 * - parse: fenced-JSON tool-call extraction from LLM replies
 * - use-grid-assistant: chat state machine (Ozwell stream → tools → results)
 * - GridAssistant: AIChat-based panel component
 */

export {
  GRID_TOOLS,
  getGridTool,
  executeGridTool,
  ASSISTANT_SPEC_CHANGE_EVENT,
  ASSISTANT_GLOBAL_SEARCH_EVENT,
  type GridAssistantColumn,
  type GridToolContext,
  type GridToolResult,
  type GridToolDefinition,
  type GridToolParameterDef,
} from './grid-tools';

export { buildGridSystemPrompt } from './prompt';

export {
  parseAssistantReply,
  previewStreamingText,
  type ParsedToolCall,
  type ParsedAssistantReply,
} from './parse';

export {
  useGridAssistant,
  type UseGridAssistantOptions,
  type UseGridAssistantReturn,
} from './use-grid-assistant';

export { GridAssistant, type GridAssistantProps } from './GridAssistant';
