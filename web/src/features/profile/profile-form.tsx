import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/use-auth'
import { COURSE_VALUES, isCourseValue } from '@/features/profile/course'
import { SUPPORTED_LANGUAGES } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const USERNAME_RE = /^[a-z0-9_]{3,32}$/

type Availability = 'idle' | 'checking' | 'taken' | 'available'

type Props = {
  submitLabel: string
  onSaved: () => void
}

export function ProfileForm({ submitLabel, onSaved }: Props) {
  const { t, i18n } = useTranslation()
  const { user, profile, refetchProfile } = useAuth()
  const userId = user?.id
  const currentUsername = profile?.username ?? ''

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [username, setUsername] = useState(currentUsername)
  const [course, setCourse] = useState(profile?.course ? String(profile.course) : '')
  const [major, setMajor] = useState(profile?.major ?? '')
  const [availability, setAvailability] = useState<Availability>('idle')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const usernameValid = USERNAME_RE.test(username)
  const needsCheck = usernameValid && username !== currentUsername

  useEffect(() => {
    if (!needsCheck || !userId) return
    let cancelled = false
    const timer = setTimeout(() => {
      setAvailability('checking')
      void (async () => {
        try {
          const { data, error: err } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', username)
            .neq('id', userId)
            .maybeSingle()
          if (cancelled) return
          setAvailability(err ? 'idle' : data ? 'taken' : 'available')
        } catch {
          if (!cancelled) setAvailability('idle')
        }
      })()
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [needsCheck, username, userId])

  const status: Availability = needsCheck ? availability : 'idle'

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (!userId) return

    const name = displayName.trim()
    const courseNum = Number(course)
    if (!name || name.length > 64 || !username || !course || !isCourseValue(courseNum)) {
      setError(t('profile.errors.required'))
      return
    }
    if (!usernameValid) {
      setError(t('profile.errors.usernameInvalid'))
      return
    }
    if (status === 'taken') return

    const lng = SUPPORTED_LANGUAGES.find((l) => l === i18n.resolvedLanguage) ?? 'ru'

    setSaving(true)
    try {
      const { error: err } = await supabase
        .from('profiles')
        .update({
          username,
          display_name: name,
          course: courseNum,
          major: major.trim() || null,
          locale: lng,
        })
        .eq('id', userId)
      if (err) {
        if (err.code === '23505') {
          setAvailability('taken')
          setError(t('profile.username.taken'))
        } else {
          setError(t('profile.errors.generic'))
        }
        return
      }
      await refetchProfile()
      toast.success(t('profile.saved'))
      onSaved()
    } catch {
      setError(t('profile.errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-name">{t('profile.fields.displayName')}</Label>
        <Input
          id="profile-name"
          type="text"
          autoComplete="name"
          maxLength={64}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={saving}
          className="text-base md:text-sm"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-username">{t('profile.fields.username')}</Label>
        <div className="relative">
          <span
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground"
            aria-hidden="true"
          >
            @
          </span>
          <Input
            id="profile-username"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={32}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value.toLowerCase())
              setAvailability('idle')
            }}
            disabled={saving}
            aria-describedby="profile-username-hint"
            className="pl-7 text-base md:text-sm"
          />
        </div>
        <p id="profile-username-hint" className="text-xs text-muted-foreground">
          {t('profile.usernameHint')}
        </p>
        {status === 'checking' && (
          <p role="status" className="text-xs text-muted-foreground">
            {t('profile.username.checking')}
          </p>
        )}
        {status === 'taken' && (
          <p role="status" className="text-xs text-destructive">
            {t('profile.username.taken')}
          </p>
        )}
        {status === 'available' && (
          <p role="status" className="text-xs text-green-600 dark:text-green-500">
            {t('profile.username.available')}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-course">{t('profile.fields.course')}</Label>
        <Select value={course} onValueChange={setCourse} disabled={saving}>
          <SelectTrigger id="profile-course" className="w-full text-base md:text-sm">
            <SelectValue placeholder={t('profile.fields.coursePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {COURSE_VALUES.map((value) => (
              <SelectItem key={value} value={String(value)}>
                {t(`profile.course.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-major">{t('profile.fields.major')}</Label>
        <Input
          id="profile-major"
          type="text"
          maxLength={100}
          placeholder={t('profile.fields.majorPlaceholder')}
          value={major}
          onChange={(e) => setMajor(e.target.value)}
          disabled={saving}
          className="text-base md:text-sm"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={saving || status === 'taken' || status === 'checking'}>
        {saving && <Loader2 className="animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  )
}
