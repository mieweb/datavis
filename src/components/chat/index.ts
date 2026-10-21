/**
 * Chat display mode — public exports.
 */

export { DataVisNitroChat } from './DataVisNitroChat';
export {
  buildChatConversation,
  buildChatRooms,
  findRoomIdByName,
  resolveChatFieldMap,
  DEFAULT_CHAT_FIELD_CANDIDATES,
  type ChatConversationModel,
  type ChatRoomsModel,
} from './chat-mapping';
export type { ChatFieldMap, ResolvedChatFieldMap, DataVisNitroChatProps } from './types';
