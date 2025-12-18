import { createContext, useContext, type JSX } from 'solid-js'
import type { PlasticineConfig } from './define-config'
import { BackendFactory, CMSStore, createCMSStore } from './store'

/**
 * Context for providing CMS store to components
 */
const CMSContext = createContext<CMSStore>()

export function CMSProvider(props: {
  config: PlasticineConfig
  backend: BackendFactory
  schemaPath?: string
  children: JSX.Element
}) {
  const store = createCMSStore({
    config: props.config,
    backend: props.backend,
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
