import type { ChatListItem } from '@/features/chats/chat-list-row'

export type DemoMsg = {
  id: string
  from: string | 'me'
  text?: string
  voice?: number
  replyTo?: string
  time: string
  read?: boolean
  day?: string
}

export type Person = { name: string; course: number; hue: number }

export const PEOPLE: Record<string, Person> = {
  timur: { name: 'Тимур Ермеков', course: 2, hue: 200 },
  daniyar: { name: 'Данияр Сейткали', course: 4, hue: 150 },
  madina: { name: 'Мадина Сулейменова', course: 1, hue: 285 },
  yerlan: { name: 'Ерлан Жумабеков', course: 4, hue: 270 },
  aliya: { name: 'Алия Оспанова', course: 3, hue: 60 },
  sanzhar: { name: 'Санжар Тулеуов', course: 3, hue: 230 },
  aigerim: { name: 'Айгерим Нурланова', course: 3, hue: 350 },
}

export const CHATS: ChatListItem[] = [
  { id: 'alg', title: 'Алгоритмы и структуры данных', preview: 'Санжар: Шпаргалки нельзя, но разрешили лист А4 с формулами', time: '09:48', unread: 3 },
  { id: 'calc', title: 'Математический анализ', preview: 'Алия: На прошлой лекции сказали: 12-го, а 10-го будет консультация', time: '08:52', unread: 4 },
  { id: 'dm-aigerim', title: 'Айгерим Нурланова', preview: 'Держи ссылку на папку, там и лабы, и разбор SQL-запросов', time: '10:03', unread: 2 },
  { id: 'sess', title: 'Подготовка к сессии — IT 2 курс', preview: 'Диана: Итого в субботу в 12:00, читальный зал на втором этаже', time: '08:05', unread: 27 },
  { id: 'db', title: 'Базы данных', preview: 'Вы: Теперь дошло, спасибо!', time: 'Вчера', unread: 0 },
  { id: 'eng', title: 'Английский B2', preview: 'Мадина: Подскажите хорошие подкасты для B2?', time: 'Вчера', unread: 1 },
  { id: 'dm-daniyar', title: 'Данияр Сейткали', preview: 'Хороший выбор. Сравни ещё с A* — комиссия такое любит', time: 'Вт', unread: 0 },
  { id: 'phys', title: 'Физика', preview: 'Ерлан: Для экзамена советую задачник Иродова', time: '11 окт', unread: 0 },
]

export const DEMO_CHAT_META: Record<string, { subtitle: string; group: boolean }> = {
  alg: { subtitle: '412 участников', group: true },
  calc: { subtitle: '318 участников', group: true },
  'dm-aigerim': { subtitle: '3 курс', group: false },
}

export const MESSAGES: Record<string, DemoMsg[]> = {
  alg: [
    { id: 'a1', day: 'Вчера', from: 'timur', time: '18:12', text: 'Ребята, кто-нибудь разбирал задачу про сбалансированные скобки на стеке? Не понимаю, почему мой вариант падает на пустой строке' },
    { id: 'a2', from: 'daniyar', time: '18:20', replyTo: 'a1', text: 'Проверь, что перед pop() стек не пустой. Задача тут: https://leetcode.com/problems/valid-parentheses/' },
    { id: 'a3', from: 'me', time: '18:31', read: true, text: 'Спасибо, у меня та же проблема была 🙏' },
    { id: 'a4', from: 'madina', time: '20:05', text: 'Подскажите, как понять, когда нужна быстрая сортировка, а когда сортировка слиянием? На экзамене такое спросят?' },
    { id: 'a5', from: 'yerlan', time: '20:31', replyTo: 'a4', text: 'Слиянием — когда нужна стабильность и гарантированные O(n log n), быстрой — когда важна память. На консультации просили сравнить по трём пунктам: время, память, стабильность.' },
    { id: 'a6', from: 'yerlan', time: '20:32', text: 'Вот хорошая визуализация: https://visualgo.net/ru/sorting' },
    { id: 'a7', from: 'aliya', time: '21:15', voice: 23 },
    { id: 'a8', from: 'me', time: '21:20', read: true, text: 'Кто сдавал АиСД в прошлом году — сколько задач было в билете?' },
    { id: 'a9', day: 'Сегодня', from: 'sanzhar', time: '09:14', replyTo: 'a8', text: 'Было 2 теоретических вопроса и 1 задача на графы (BFS/DFS). Шпаргалки нельзя, но разрешили лист А4 с формулами по сложности' },
    { id: 'a10', from: 'me', time: '09:30', read: false, text: 'Отлично, начну с графов. Список вопросов уже выложили?' },
  ],
  calc: [
    { id: 'c1', day: 'Вчера', from: 'sanzhar', time: '19:30', text: 'Как доказать, что последовательность (1 + 1/n)^n возрастает? Через неравенство Бернулли не получается' },
    { id: 'c2', from: 'aliya', time: '19:44', replyTo: 'c1', text: 'Запиши как произведение n+1 множителей и примени неравенство Коши о среднем. Я так на коллоквиуме делал' },
    { id: 'c3', from: 'me', time: '19:50', read: true, text: 'Сработало, спасибо! Теперь понятно, откуда берётся e' },
  ],
  'dm-aigerim': [
    { id: 'd1', day: 'Вчера', from: 'aigerim', time: '17:20', text: 'Привет! Ты вроде на 2 курсе, ИТ? Могу отдать конспекты по базам данных за прошлый год' },
    { id: 'd2', from: 'me', time: '17:25', read: true, text: 'Привет! Да, очень пригодятся, спасибо!' },
    { id: 'd3', day: 'Сегодня', from: 'aigerim', time: '10:03', text: 'Держи ссылку на папку: https://drive.google.com/drive/folders/demo — там и лабы, и разбор SQL-запросов' },
    { id: 'd4', from: 'aigerim', time: '10:04', text: 'Если что-то будет непонятно — пиши 🙂' },
  ],
}

export function messagesFor(chatId: string): DemoMsg[] {
  const known = MESSAGES[chatId]
  if (known) return known
  const chat = CHATS.find((c) => c.id === chatId)
  return [{ id: `${chatId}-1`, from: 'aliya', time: chat?.time ?? '10:00', text: chat?.preview.replace(/^[^:]+: /, '') ?? 'Привет!' }]
}
