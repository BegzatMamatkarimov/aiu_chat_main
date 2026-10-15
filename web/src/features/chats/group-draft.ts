type Draft = { userId: string; name: string; description: string; isPublic: boolean }

let draft: Draft | null = null

/** Черновик окна «Новая группа»: живёт в памяти до перезагрузки страницы, у каждого пользователя свой. */
export function readGroupDraft(userId: string | undefined): { name: string; description: string; isPublic: boolean } {
  return draft && draft.userId === userId ? draft : { name: '', description: '', isPublic: true }
}

export function writeGroupDraft(userId: string | undefined, name: string, description: string, isPublic: boolean) {
  if (userId) draft = { userId, name, description, isPublic }
}

export function clearGroupDraft() {
  draft = null
}
