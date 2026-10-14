export type Person = { id: string; name: string; course: number; hue: number }

export type Msg = {
  id: string
  chatId: string
  authorId: string
  text: string
  ts: number
  replyTo?: string
  reactions: Record<string, string[]>
  question?: boolean
  voice?: number
  fresh?: boolean
}

export type Chat = {
  id: string
  kind: 'subject' | 'direct'
  title: string
  short: string
  hue: number
  members?: number
  peerId?: string
  unread: number
  newQuestion?: boolean
  pinned?: { text: string; details: string; date?: string }
}

export const ME_ID = 'me'
export const ME_COURSE = 2

export const PEOPLE: Record<string, Person> = {
  me: { id: 'me', name: 'Алихан Сериков', course: 2, hue: 250 },
  aigerim: { id: 'aigerim', name: 'Айгерим Нурланова', course: 3, hue: 350 },
  daniyar: { id: 'daniyar', name: 'Данияр Сейткали', course: 4, hue: 150 },
  aruzhan: { id: 'aruzhan', name: 'Аружан Касымова', course: 1, hue: 30 },
  timur: { id: 'timur', name: 'Тимур Ермеков', course: 2, hue: 200 },
  madina: { id: 'madina', name: 'Мадина Сулейменова', course: 1, hue: 320 },
  yerlan: { id: 'yerlan', name: 'Ерлан Жумабеков', course: 4, hue: 270 },
  aliya: { id: 'aliya', name: 'Алия Оспанова', course: 3, hue: 60 },
  nursultan: { id: 'nursultan', name: 'Нурсултан Абенов', course: 2, hue: 110 },
  kamila: { id: 'kamila', name: 'Камила Ибраева', course: 1, hue: 10 },
  sanzhar: { id: 'sanzhar', name: 'Санжар Тулеуов', course: 3, hue: 230 },
  diana: { id: 'diana', name: 'Диана Ким', course: 2, hue: 180 },
}

export const CHATS: Chat[] = [
  {
    id: 'alg',
    kind: 'subject',
    title: 'Алгоритмы и структуры данных',
    short: 'АиСД',
    hue: 250,
    members: 412,
    unread: 3,
    newQuestion: true,
    pinned: {
      text: 'Экзамен по АиСД — 20 ноября',
      details: 'Аудитория 3.201, начало в 10:00. 2 вопроса по теории и 1 задача на графы. Список вопросов выложат в Moodle за месяц.',
      date: '2026-11-20',
    },
  },
  {
    id: 'calc',
    kind: 'subject',
    title: 'Математический анализ',
    short: 'МА',
    hue: 20,
    members: 318,
    unread: 4,
    newQuestion: true,
    pinned: {
      text: 'Коллоквиум 2 — 12 ноября',
      details: 'Темы: пределы последовательностей, непрерывность, производная. Можно взять один лист А4 с формулами.',
      date: '2026-11-12',
    },
  },
  {
    id: 'db',
    kind: 'subject',
    title: 'Базы данных',
    short: 'БД',
    hue: 160,
    members: 276,
    unread: 0,
    pinned: {
      text: 'Сдача лабораторных до 15 ноября',
      details: 'Лабораторные 1–4 сдаются преподавателю лично. Лабораторная 5 (индексы и планы запросов) — по желанию, +5 баллов.',
      date: '2026-11-15',
    },
  },
  { id: 'eng', kind: 'subject', title: 'Английский B2', short: 'B2', hue: 300, members: 154, unread: 1 },
  { id: 'phys', kind: 'subject', title: 'Физика', short: 'Фз', hue: 70, members: 201, unread: 0 },
  {
    id: 'sess',
    kind: 'subject',
    title: 'Подготовка к сессии — IT 2 курс',
    short: 'IT2',
    hue: 200,
    members: 89,
    unread: 27,
    pinned: {
      text: 'Расписание сессии — с 8 декабря',
      details: 'Первым идёт АиСД (20 ноября — допуск), затем математический анализ и базы данных. Расписание на сайте деканата.',
      date: '2026-12-08',
    },
  },
  {
    id: 'olymp',
    kind: 'subject',
    title: 'Сообщество студентов-программистов, готовящихся к олимпиадам по спортивному программированию и хакатонам AIU',
    short: 'ОП',
    hue: 340,
    members: 1034,
    unread: 5,
  },
  { id: 'dm-aigerim', kind: 'direct', title: 'Айгерим Нурланова', short: 'АН', hue: 350, peerId: 'aigerim', unread: 2 },
  { id: 'dm-daniyar', kind: 'direct', title: 'Данияр Сейткали', short: 'ДС', hue: 150, peerId: 'daniyar', unread: 0 },
  { id: 'dm-aruzhan', kind: 'direct', title: 'Аружан Касымова', short: 'АК', hue: 30, peerId: 'aruzhan', unread: 1 },
]

function at(daysAgo: number, time: string): number {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  const [h, m] = time.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

let seq = 0
function m(
  chatId: string,
  authorId: string,
  daysAgo: number,
  time: string,
  text: string,
  extra: Partial<Msg> = {},
): Msg {
  seq += 1
  return { id: `${chatId}-${seq}`, chatId, authorId, text, ts: at(daysAgo, time), reactions: {}, ...extra }
}

const alg1 = m('alg', 'timur', 3, '18:12', 'Ребята, кто-нибудь разбирал задачу про сбалансированные скобки на стеке? Не понимаю, почему мой вариант падает на пустой строке')
const alg3 = m('alg', 'madina', 1, '20:05', 'Подскажите, как понять, когда нужна быстрая сортировка, а когда сортировка слиянием? На экзамене такое спросят?', { question: true })
const alg8 = m('alg', 'nursultan', 0, '09:02', 'Кто сдавал АиСД в прошлом году — сколько задач было в билете и можно ли пользоваться шпаргалкой?', { question: true })
const alg11 = m('alg', 'kamila', 0, '09:40', 'А где взять список вопросов к экзамену? В Moodle пока ничего нет', { question: true })
const calc1 = m('calc', 'diana', 1, '19:30', 'Как доказать, что последовательность (1 + 1/n)^n возрастает? Через неравенство Бернулли не получается', { question: true })
const calc4 = m('calc', 'timur', 0, '08:15', 'Когда коллоквиум 2? В расписании 12 ноября, но преподаватель говорил про 10-е', { question: true })
const sess1 = m('sess', 'diana', 1, '21:00', 'Предлагаю собраться в субботу в библиотеке и прорешать билеты по АиСД. Кто за?', { question: true })

export const MESSAGES: Msg[] = [
  alg1,
  m('alg', 'daniyar', 3, '18:20', 'Проверь, что перед pop() стек не пустой. На пустой строке ты вызываешь pop() у пустого стека, отсюда и ошибка. Задача тут: https://leetcode.com/problems/valid-parentheses/', { replyTo: alg1.id, reactions: { '👍': ['aliya', 'timur', 'kamila'] } }),
  alg3,
  m('alg', 'yerlan', 1, '20:31', 'Коротко: слиянием — когда нужна стабильность и гарантированные O(n log n), быстрой — когда важна память и хватает среднего случая. На консультации просили сравнить по трём пунктам: время, память, стабильность.', { replyTo: alg3.id, reactions: { '🔥': ['madina', 'diana'] } }),
  m('alg', 'yerlan', 1, '20:32', 'Вот хорошая визуализация, посмотри: https://visualgo.net/ru/sorting'),
  m('alg', 'madina', 1, '20:40', 'Спасибо огромное! 🙏', { reactions: { '❤️': ['yerlan', 'aliya'] } }),
  m('alg', 'aliya', 1, '21:15', '', { voice: 23 }),
  alg8,
  m('alg', 'sanzhar', 0, '09:14', 'Было 2 теоретических вопроса и 1 задача на графы (BFS/DFS). Шпаргалки нельзя, но разрешили лист А4 с формулами по сложности', { replyTo: alg8.id, reactions: { '👍': ['nursultan', 'timur', 'kamila', 'diana', 'madina'] } }),
  m('alg', 'sanzhar', 0, '09:15', 'Ещё в билете просили оценить сложность своего решения, так что тренируйтесь писать O(...) словами'),
  alg11,
  m('alg', 'daniyar', 0, '09:48', 'Официальный список выложат за месяц, а пока берите прошлогодний — он почти не меняется. Вопросы про деревья и графы точно будут', { replyTo: alg11.id }),
  calc1,
  m('calc', 'sanzhar', 1, '19:44', 'Запиши (1+1/n)^n как произведение n+1 множителей (n штук по (1+1/n) и один раз 1) и примени неравенство Коши о среднем. Я так на коллоквиуме делал', { replyTo: calc1.id, reactions: { '👍': ['diana'] } }),
  m('calc', 'diana', 1, '19:50', 'Сработало, спасибо! Теперь понятно, откуда берётся e'),
  calc4,
  m('calc', 'aruzhan', 0, '08:40', 'Тоже слышала про 10-е 🤔'),
  m('calc', 'aliya', 0, '08:52', 'На прошлой лекции сказали: 12-го, а 10-го будет консультация', { replyTo: calc4.id }),
  m('db', 'nursultan', 2, '15:10', 'Кто-нибудь понял, чем INNER JOIN отличается от LEFT JOIN на практике? Пример с заказами и клиентами не зашёл'),
  m('db', 'aigerim', 2, '15:42', 'LEFT JOIN оставит клиентов без заказов (в колонках заказа будет NULL), INNER JOIN их выкинет. Попробуй запросом: SELECT c.name, o.id FROM clients c LEFT JOIN orders o ON o.client_id = c.id', { reactions: { '👍': ['nursultan', 'timur'] } }),
  m('db', 'nursultan', 2, '15:50', 'Теперь дошло, спасибо!'),
  m('eng', 'kamila', 1, '12:00', 'Кто идёт на разговорный клуб в четверг? Нужно ещё двое для диалогов'),
  m('eng', 'aliya', 1, '12:25', 'Я приду! Тема — «Job interview», можно потренировать ответы заранее'),
  m('eng', 'madina', 0, '10:30', 'Подскажите хорошие подкасты для B2? Хочу слушать по дороге в университет'),
  m('phys', 'timur', 4, '14:05', 'Лабораторная по оптике сдана, преподаватель принимает по средам с 15:00'),
  m('phys', 'yerlan', 4, '14:30', 'Для экзамена советую задачник Иродова: первые 30 задач каждого раздела'),
  sess1,
  m('sess', 'timur', 1, '21:05', 'Я за! Только давайте в 12:00, раньше не встану 😄', { replyTo: sess1.id, reactions: { '😂': ['diana', 'nursultan'] } }),
  m('sess', 'nursultan', 1, '21:10', 'Тоже буду. Возьму конспекты по графам'),
  m('sess', 'diana', 0, '08:05', 'Итого в субботу в 12:00, читальный зал на втором этаже. Бронирую стол'),
  m('sess', 'kamila', 0, '08:20', 'А первокурсников можно с собой взять? Мы с Мадиной тоже хотим подготовиться'),
  m('olymp', 'yerlan', 2, '19:00', 'Напоминаю: отборочный раунд AIU Cup — в воскресенье в 11:00. Регистрация открыта до пятницы'),
  m('olymp', 'daniyar', 2, '19:12', 'Разбор прошлогодних задач выложу на неделе. Начните с динамики на подотрезках — она встречается чаще всего', { reactions: { '🔥': ['sanzhar', 'timur', 'diana'] } }),
  m('olymp', 'sanzhar', 0, '07:55', 'Есть команда на хакатон? Нужен фронтенд-разработчик, мы уже закрыли бэкенд и дизайн'),
  m('dm-aigerim', 'aigerim', 1, '17:20', 'Привет! Ты вроде на 2 курсе, ИТ? Могу отдать конспекты по базам данных за прошлый год'),
  m('dm-aigerim', 'me', 1, '17:25', 'Привет! Да, очень пригодятся, спасибо!'),
  m('dm-aigerim', 'aigerim', 0, '10:03', 'Держи ссылку на папку: https://drive.google.com/drive/folders/demo — там и лабы, и разбор SQL-запросов'),
  m('dm-aigerim', 'aigerim', 0, '10:04', 'Если что-то будет непонятно — пиши 🙂'),
  m('dm-daniyar', 'me', 3, '16:40', 'Данияр, привет! Можно спросить про курсовую по АиСД?'),
  m('dm-daniyar', 'daniyar', 3, '17:02', 'Конечно, спрашивай. Лучше сразу пришли тему и что уже сделал'),
  m('dm-daniyar', 'me', 2, '11:15', 'Тему утвердили: поиск кратчайшего пути в графе общежитий. Взял Дейкстру'),
  m('dm-daniyar', 'daniyar', 2, '11:40', 'Хороший выбор. Сравни ещё с A* — комиссия такое любит', { reactions: { '👍': ['me'] } }),
  m('dm-daniyar', 'me', 2, '11:44', 'Спасибо за совет по курсовой!'),
  m('dm-aruzhan', 'aruzhan', 0, '11:10', 'Здравствуйте! Вы же на втором курсе? Подскажите, с чего начать готовиться к сессии по программированию?'),
]

export function courseLabel(course: number): string {
  return `${course} курс`
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}
