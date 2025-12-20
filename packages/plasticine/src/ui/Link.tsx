import { useSearchParams } from '@solidjs/router'
import { JSX } from 'solid-js'
import { CMSParams } from './CMS'

const PARAMS = ['view', 'collection', 'item'] as const

/** Link component that uses search params */
export function Link(props: {
  params: CMSParams
  class?: string
  activeClass?: string
  children: JSX.Element
}) {
  const [searchParams] = useSearchParams<CMSParams>()

  const href = () => {
    const params = new URLSearchParams()
    for (const key of PARAMS) {
      if (props.params[key]) params.set(key, props.params[key])
    }
    const search = params.toString()
    return search ? `?${search}` : '?'
  }

  const isActive = () =>
    PARAMS.every(key => {
      const param = props.params[key]
      return param === undefined ? !searchParams[key] : searchParams[key] === param
    })

  return (
    <a
      href={href()}
      class={`${props.class || ''} ${isActive() && props.activeClass ? props.activeClass : ''}`}
    >
      {props.children}
    </a>
  )
}
