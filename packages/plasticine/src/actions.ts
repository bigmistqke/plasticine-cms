import { action } from '@solidjs/router'
import type { CMSActions } from './store'

/**
 * Router actions for CMS mutations
 * These wrap async operations and integrate with @solidjs/router's
 * submission tracking for automatic pending/error state management
 */

export const saveSchemaAction = action(async (content: string, cmsActions: CMSActions) => {
  await cmsActions.saveSchema(content)
  return { ok: true }
}, 'saveSchema')

export const saveItemAction = action(
  async (
    collection: string,
    data: Record<string, unknown>,
    existingSha: string | undefined,
    cmsActions: CMSActions,
  ) => {
    await cmsActions.saveItem(collection, data, existingSha)
    return { ok: true }
  },
  'saveItem',
)

export const deleteItemAction = action(
  async (collection: string, id: string, sha: string | undefined, cmsActions: CMSActions) => {
    await cmsActions.deleteItem(collection, id, sha)
    return { ok: true }
  },
  'deleteItem',
)

export const deleteMediaAction = action(
  async (url: string, path: string, sha: string | undefined, cmsActions: CMSActions) => {
    await cmsActions.deleteMedia(url, path, sha)
    return { ok: true }
  },
  'deleteMedia',
)
