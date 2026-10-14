import { createContext } from 'react'
import type { ChatListItem } from '@/features/chats/chat-list-row'

// Данные подключаются в задачах 4.3 (список) и 4.4 (поиск). Пока список пуст; демо-данные подставляет страница прототипов.
export const ChatListDataContext = createContext<ChatListItem[]>([])
