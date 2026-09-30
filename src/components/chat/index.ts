/**
 * Chat display mode — public exports.
 */

export { DataVisNitroChat } from './DataVisNitroChat';
export {
  buildChatConversation,
  resolveChatFieldMap,
  DEFAULT_CHAT_FIELD_CANDIDATES,
  type ChatConversationModel,
} from './chat-mapping';
export type { ChatFieldMap, ResolvedChatFieldMap, DataVisNitroChatProps } from './types';
