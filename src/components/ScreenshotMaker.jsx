import { useEffect, useMemo, useRef, useState } from 'react'
import appscreenHtml from '@/appscreen/appscreen.html?raw'
import appscreenCss from '@/appscreen/appscreen.css?raw'

const SCRIPT_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js',
  '/appscreen/llm.js',
  '/appscreen/language-utils.js',
  '/appscreen/magical-titles.js',
  '/appscreen/three-renderer.js',
  '/appscreen/app.js'
]

const scopeSelectors = (selectors, scope) => {
  return selectors.split(',').map((selector) => {
    const trimmed = selector.trim()
    if (!trimmed) return ''
    if (trimmed === ':root' || trimmed === 'html' || trimmed === 'body') return scope
    if (trimmed.startsWith('html')) return trimmed.replace(/^html/, scope)
    if (trimmed.startsWith('body')) return trimmed.replace(/^body/, scope)
    return `${scope} ${trimmed}`
  }).join(', ')
}

const extractBlock = (css, startIndex) => {
  const openIndex = css.indexOf('{', startIndex)
  if (openIndex === -1) return null
  let depth = 0
  for (let i = openIndex; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1
    if (css[i] === '}') depth -= 1
    if (depth === 0) {
      return {
        header: css.slice(startIndex, openIndex).trim(),
        body: css.slice(openIndex + 1, i),
        endIndex: i + 1
      }
    }
  }
  return null
}

const scopeCss = (css, scope) => {
  let i = 0
  let output = ''

  while (i < css.length) {
    const nextBrace = css.indexOf('{', i)
    const nextAt = css.indexOf('@', i)

    if (nextAt !== -1 && (nextBrace === -1 || nextAt < nextBrace)) {
      const block = extractBlock(css, nextAt)
      if (!block) {
        output += css.slice(i)
        break
      }

      const header = block.header
      if (header.startsWith('@keyframes') || header.startsWith('@-webkit-keyframes') || header.startsWith('@-moz-keyframes') || header.startsWith('@-o-keyframes')) {
        output += css.slice(nextAt, block.endIndex)
        i = block.endIndex
        continue
      }

      if (header.startsWith('@media') || header.startsWith('@supports') || header.startsWith('@container') || header.startsWith('@layer')) {
        output += `${header}{${scopeCss(block.body, scope)}}`
        i = block.endIndex
        continue
      }

      output += css.slice(nextAt, block.endIndex)
      i = block.endIndex
      continue
    }

    if (nextBrace === -1) {
      output += css.slice(i)
      break
    }

    const selectorText = css.slice(i, nextBrace).trim()
    const block = extractBlock(css, i)
    if (!block) break
    if (selectorText) {
      output += `${scopeSelectors(selectorText, scope)}{${block.body}}`
    }
    i = block.endIndex
  }

  return output
}

const waitForElement = (id) => {
  if (document.getElementById(id)) return Promise.resolve()
  return new Promise((resolve) => {
    const tick = () => {
      if (document.getElementById(id)) {
        resolve()
        return
      }
      requestAnimationFrame(tick)
    }
    tick()
  })
}

const loadScript = (src) => {
  const existing = document.querySelector(`script[src="${src}"]`)
  if (existing) {
    return existing.dataset.loaded === 'true'
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          existing.addEventListener('load', resolve)
          existing.addEventListener('error', reject)
        })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = false
    script.dataset.loaded = 'false'
    script.onload = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    script.onerror = reject
    document.body.appendChild(script)
  })
}

export default function ScreenshotMaker({ localizationPayload, aiConfig, active }) {
  const [scriptsLoaded, setScriptsLoaded] = useState(false)
  const initializedRef = useRef(false)
  const rootRef = useRef(null)
  const scopedCss = useMemo(() => scopeCss(appscreenCss, '.appscreen-root'), [])
  const aiPayload = useMemo(() => {
    if (!aiConfig) return null
    const apiKey = aiConfig.apiKeys?.openai || ''
    const model = aiConfig.models?.openai || ''
    const provider = aiConfig.provider === 'openai' ? 'openai' : ''
    if (!apiKey && !model && !provider) return null
    return { apiKey, model, provider }
  }, [aiConfig])

  useEffect(() => {
    if (!rootRef.current) return
    if (!rootRef.current.innerHTML) {
      rootRef.current.innerHTML = appscreenHtml
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (window.__appscreenScriptsLoaded) {
        setScriptsLoaded(true)
        return
      }
      for (const src of SCRIPT_URLS) {
        await loadScript(src)
      }
      if (!cancelled) {
        window.__appscreenScriptsLoaded = true
        setScriptsLoaded(true)
      }
    }

    load().catch((error) => {
      console.error('Failed to load screenshot maker scripts', error)
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!scriptsLoaded || initializedRef.current) return

    const init = async () => {
      await waitForElement('file-input')
      if (window.AppscreenBridge?.init) {
        window.AppscreenBridge.init()
        initializedRef.current = true
      }
    }

    init().catch((error) => {
      console.error('Failed to init screenshot maker', error)
    })
  }, [scriptsLoaded])

  useEffect(() => {
    if (!scriptsLoaded) return
    if (window.AppscreenBridge?.mount) {
      window.AppscreenBridge.mount()
    }
  }, [scriptsLoaded])

  useEffect(() => {
    if (!active || !scriptsLoaded) return
    const kick = () => {
      if (window.AppscreenBridge?.mount) {
        window.AppscreenBridge.mount()
      }
      if (window.AppscreenBridge?.syncLocalizationData && localizationPayload) {
        window.AppscreenBridge.syncLocalizationData(localizationPayload)
      }
      if (window.AppscreenBridge?.syncAiConfig && aiPayload) {
        window.AppscreenBridge.syncAiConfig(aiPayload)
      }
    }
    requestAnimationFrame(kick)
  }, [active, scriptsLoaded, localizationPayload, aiPayload])

  useEffect(() => {
    if (!scriptsLoaded || !localizationPayload) return
    if (window.AppscreenBridge?.syncLocalizationData) {
      window.AppscreenBridge.syncLocalizationData(localizationPayload)
    }
  }, [scriptsLoaded, localizationPayload])

  useEffect(() => {
    if (!scriptsLoaded || !aiPayload) return
    if (window.AppscreenBridge?.syncAiConfig) {
      window.AppscreenBridge.syncAiConfig(aiPayload)
    }
  }, [scriptsLoaded, aiPayload])

  return (
    <div className="space-y-4">
      <style
        dangerouslySetInnerHTML={{
          __html: `${scopedCss}\n.appscreen-root{\n  --bg-primary: var(--background);\n  --bg-secondary: var(--card);\n  --bg-tertiary: var(--muted);\n  --border-color: var(--border);\n  --text-primary: var(--foreground);\n  --text-secondary: var(--muted-foreground);\n  --accent: var(--primary);\n  --accent-hover: var(--primary);\n  width: 100%;\n}\n.appscreen-root .app-container{\n  width: 100%;\n  max-width: none;\n}\n`
        }}
      />
      <div ref={rootRef} className="appscreen-root w-full" />
    </div>
  )
}
