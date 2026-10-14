import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

export type Profile = Database['public']['Tables']['profiles']['Row']

export type AuthContextValue = {
  session: Session | null
  user: User | null
  initializing: boolean
  profile: Profile | null
  profileLoading: boolean
  refetchProfile: () => Promise<unknown>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
