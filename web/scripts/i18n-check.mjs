// Проверка локалей: node scripts/i18n-check.mjs (npm run i18n:check). Без зависимостей.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const LOCALES = ['ru', 'kk', 'en']
const PLURAL_SUFFIXES = ['zero', 'one', 'two', 'few', 'many', 'other']
const PLURAL_RE = new RegExp(`_(${PLURAL_SUFFIXES.join('|')})$`)

// kk/en могут совпадать с ru: бренд, названия языков (на своём языке), идентификатор username, общие заимствования.
const SAME_AS_RU = new Set([
  'app.name',
  'chat.media.counter',
  'language.kk',
  'language.ru',
  'language.en',
  'auth.fields.email',
  'profile.fields.username',
  'profile.fields.course',
  'settings.profile',
  'chats.preview.image',
  'chats.preview.file',
])

const errors = []
const warnings = []
const err = (m) => errors.push(m)

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') flatten(v, key, out)
    else out[key] = v
  }
  return out
}

const flat = {}
for (const l of LOCALES) {
  flat[l] = flatten(JSON.parse(readFileSync(path.join(ROOT, 'src/locales', `${l}.json`), 'utf8')))
}

const baseOf = (key) => key.replace(PLURAL_RE, '')
const placeholders = (s) => [...new Set([...String(s).matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g)].map((m) => m[1]))].sort()

// Группируем: base -> { form -> value }; обычные ключи — форма ''.
const grouped = {}
for (const l of LOCALES) {
  grouped[l] = {}
  for (const [key, value] of Object.entries(flat[l])) {
    if (typeof value !== 'string') {
      err(`${l}: ${key} не строка`)
      continue
    }
    if (value.trim() === '') err(`${l}: ${key} пустая строка`)
    const m = key.match(PLURAL_RE)
    const base = baseOf(key)
    ;(grouped[l][base] ??= {})[m ? m[1] : ''] = value
  }
}

// 1. Одинаковый набор ключей.
const allBases = new Set(LOCALES.flatMap((l) => Object.keys(grouped[l])))
for (const base of allBases) {
  for (const l of LOCALES) {
    if (!grouped[l][base]) err(`${l}: нет ключа ${base}`)
  }
}

// 2. Плюральные формы по CLDR (i18next берёт их из Intl.PluralRules).
for (const l of LOCALES) {
  const needed = new Set(new Intl.PluralRules(l).resolvedOptions().pluralCategories)
  for (const [base, forms] of Object.entries(grouped[l])) {
    const names = Object.keys(forms)
    const isPlural = names.some((n) => n !== '')
    if (!isPlural) continue
    if (names.includes('')) err(`${l}: ${base} одновременно обычный и плюральный`)
    for (const n of needed) if (!names.includes(n)) err(`${l}: ${base} нет формы _${n}`)
    for (const n of names) if (!needed.has(n)) err(`${l}: ${base} лишняя форма _${n}`)
    for (const [n, v] of Object.entries(forms)) {
      if (!placeholders(v).includes('count')) err(`${l}: ${base}_${n} без {{count}}`)
    }
  }
}

// 3. Плейсхолдеры {{...}}: одинаковые во всех языках (для плюралей — объединение форм).
const phOf = (forms) => [...new Set(Object.values(forms).flatMap(placeholders))].sort().join(', ')
for (const base of allBases) {
  if (!LOCALES.every((l) => grouped[l][base])) continue
  const ref = phOf(grouped.ru[base])
  for (const l of ['kk', 'en']) {
    const got = phOf(grouped[l][base])
    if (got !== ref) err(`${l}: ${base} плейсхолдеры {${got}} != ru {${ref}}`)
  }
}

// 4. kk/en не совпадают с ru (кроме белого списка).
for (const l of ['kk', 'en']) {
  for (const [base, forms] of Object.entries(grouped[l])) {
    for (const [n, v] of Object.entries(forms)) {
      const ru = grouped.ru[base]?.[n]
      const key = n ? `${base}_${n}` : base
      if (ru !== undefined && ru === v && !SAME_AS_RU.has(key)) err(`${l}: ${key} совпадает с ru: «${v}»`)
    }
  }
}
for (const key of SAME_AS_RU) {
  if (!(key in flat.ru)) err(`белый список: ключа ${key} нет`)
}

// 5. Использование ключей в коде.
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !p.includes(`${path.sep}locales${path.sep}`) && !name.endsWith('.d.ts')) out.push(p)
  }
  return out
}
const source = walk(path.join(ROOT, 'src')).map((f) => readFileSync(f, 'utf8')).join('\n')
const noComments = source.replace(/(^|\s)\/\*[\s\S]*?\*\//g, '$1').replace(/(^|\s)\/\/.*$/gm, '$1')

const literals = new Set()
const templates = []
for (const m of noComments.matchAll(/(['"`])([A-Za-z][\w]*(?:\.[\w${}]+)+)\1/g)) {
  const s = m[2]
  if (s.includes('${')) {
    templates.push(new RegExp(`^${s.split(/\$\{[^}]*\}/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^.]+')}$`))
  } else literals.add(s)
}

const topLevel = new Set(Object.keys(flat.ru).map((k) => k.split('.')[0]))
const used = (base) => {
  if (literals.has(base)) return true
  if (templates.some((re) => re.test(base))) return true
  // ключи, собираемые из объекта (ERROR_KEYS и т.п.), уже попали в literals как полные строки
  return false
}

for (const base of Object.keys(grouped.ru)) {
  if (!used(base)) err(`не используется в коде: ${base}`)
}
const known = new Set(Object.keys(grouped.ru))
for (const s of literals) {
  if (!topLevel.has(s.split('.')[0])) continue
  if (known.has(s)) continue
  // префикс группы (например 'chats.create') — не ключ-лист, пропускаем
  if ([...known].some((k) => k.startsWith(`${s}.`))) continue
  warnings.push(`в коде строка, похожая на ключ, но её нет в ru.json: ${s}`)
}

for (const w of warnings) console.warn(`warn: ${w}`)
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`)
  console.error(`\ni18n:check — ошибок: ${errors.length}`)
  process.exit(1)
}
const total = Object.keys(grouped.ru).length
console.log(`i18n:check OK — ${total} ключей, языки: ${LOCALES.join('/')}, плюрали: ru one/few/many/other, kk и en one/other`)
