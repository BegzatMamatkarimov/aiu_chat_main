import { useTranslation } from 'react-i18next'
import { Globe, Lock } from 'lucide-react'

const COUNTER_FROM = 20

/** Счётчик символов: появляется, когда до предела остаётся мало. */
export function Counter({ value, max }: { value: string; max: number }) {
  const left = max - value.length
  if (left > COUNTER_FROM) return null
  return (
    <span className={`ml-auto shrink-0 tabular-nums ${left <= 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
      {value.length} / {max}
    </span>
  )
}

const TYPES = [
  { value: true, key: 'typePublic', Icon: Globe },
  { value: false, key: 'typePrivate', Icon: Lock },
] as const

/** Выбор «Публичная / Приватная»: радио с доступными именами; подсказку (`hintId`) рисует вызывающий. */
export function GroupTypeRadios({
  idPrefix,
  value,
  onChange,
  hintId,
}: {
  idPrefix: string
  value: boolean
  onChange: (isPublic: boolean) => void
  hintId: string
}) {
  const { t } = useTranslation()
  return (
    <div role="radiogroup" aria-label={t('chats.create.typeLabel')} className="grid grid-cols-2 gap-2">
      {TYPES.map(({ value: v, key, Icon }) => (
        <label
          key={key}
          htmlFor={`${idPrefix}-${key}`}
          className="glass-press relative flex min-w-0 cursor-pointer items-center gap-2 rounded-2xl border border-foreground/10 px-3 py-2.5 text-sm font-medium has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
        >
          <input
            id={`${idPrefix}-${key}`}
            type="radio"
            name={`${idPrefix}-type`}
            aria-labelledby={`${idPrefix}-${key}-label`}
            aria-describedby={hintId}
            checked={value === v}
            onChange={() => onChange(v)}
            className="sr-only"
          />
          <Icon aria-hidden="true" className="size-4 shrink-0" />
          <span id={`${idPrefix}-${key}-label`} className="truncate">
            {t(`chats.create.${key}`)}
          </span>
        </label>
      ))}
    </div>
  )
}
