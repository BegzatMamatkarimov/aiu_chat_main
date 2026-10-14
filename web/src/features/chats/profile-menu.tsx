import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { LogOut, Settings } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/auth/use-auth'
import { useCourseLabel } from '@/features/profile/course'
import { initials } from '@/features/profile/initials'

export function ProfileMenu() {
  const { t } = useTranslation()
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const courseLabel = useCourseLabel()
  const name = profile?.display_name || user?.email || ''

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('chats.profileMenu')}
          className="glass-accent glass-press flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
          ) : (
            initials(name)
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="truncate text-sm font-semibold text-foreground">{name}</span>
          {profile?.username && <span className="truncate text-xs text-muted-foreground">@{profile.username}</span>}
          {profile?.course && <span className="truncate text-xs text-muted-foreground">{courseLabel(profile.course)}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void navigate('/settings')}>
          <Settings />
          {t('pages.settings.title')}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            void signOut().then(() => navigate('/login', { replace: true }))
          }}
        >
          <LogOut />
          {t('auth.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
