type Draft = { userId: string; name: string; description: string }

let draft: Draft | null = null

/** Черновик окна «Новая группа»: живёт в памяти до перезагрузки страницы, у каждого пользователя свой. */
export function readGroupDraft(userId: string | undefined): { name: string; description: string } {
  return draft && draft.userId === userId ? draft : { name: '', description: '' }
}

export function writeGroupDraft(userId: string | undefined, name: string, description: string) {
  if (userId) draft = { userId, name, description }
}

export function clearGroupDraft() {
  draft = null
}
