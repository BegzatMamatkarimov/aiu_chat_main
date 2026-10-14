import { createContext, useContext } from 'react'

export type ShellState = {
  /** ≥768px: список и чат рядом */
  desktop: boolean
  /** открыт ли /c/:chatId */
  open: boolean
}

export const ShellContext = createContext<ShellState>({ desktop: true, open: false })

export const useShell = () => useContext(ShellContext)
