import { createContext, useContext, type JSX } from 'solid-js'
import type { AuthProvider } from '../auth/types'
import { BackendFactory } from '../backend/types'
import type { PlasticineConfig } from '../config/define-config'
import { CMSStore, createCMSStore } from './store'

/**
 * Context for providing CMS store to components
 */
const CMSContext = createContext<CMSStore>()

export function CMSProvider(props: {
  config: PlasticineConfig<any>
  backend: BackendFactory
  auth: AuthProvider
  schemaPath?: string
  children: JSX.Element
}) {
  const store = createCMSStore({
    config: props.config,
    backend: props.backend,
    auth: props.auth,
    schemaPath: props.schemaPath,
  })

  return <CMSContext.Provider value={store}> {props.children} </CMSContext.Provider>
}

export function useCMS(): CMSStore {
  const context = useContext(CMSContext)
  if (!context) {
    throw new Error('useCMS must be used within a CMSProvider')
  }
  return context
}
