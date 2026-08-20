/**
 * The browser preview overlay component: polls the Host `browserPopup`
 * Remote service every 1.5s while expanded, decodes the base64 PNG via
 * `createImageBitmap`, and paints it on a canvas at native resolution
 * (CSS scales for display).
 * @module @deepseek-ai/dsh-browser-popup/client/BrowserPopup
 */

import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'

/** Poll interval for the live screenshot, in milliseconds. */
export const REFRESH_MS = 1500

/** Collapsed (default) overlay width, in pixels. */
export const DEFAULT_WIDTH = 340

/**
 * The floating overlay occupant for `shell.overlay`. Polls the
 * `remote.browserPopup` Remote while expanded, decodes the base64 PNG, and
 * paints it onto a canvas at native resolution.
 * @param ctx - the client context whose `remote.browserPopup` is polled.
 * @returns the overlay element.
 */
export function BrowserPopup(ctx: ClientContext): ReactElement {
  const [expanded, setExpanded] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [url, setUrl] = useState('未打开页面')
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)

  const drawOnCanvas = async (b64: string): Promise<void> => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      const bin = atob(b64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'image/png' })
      const bitmap = await createImageBitmap(blob)
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx2d = canvas.getContext('2d')
      if (!ctx2d) throw new Error('no 2d context')
      ctx2d.clearRect(0, 0, canvas.width, canvas.height)
      ctx2d.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height)
      bitmap.close()
      const containerWidth = (bodyRef.current && bodyRef.current.clientWidth) || DEFAULT_WIDTH
      const maxH = Math.floor(window.innerHeight * 0.72)
      let dispW = containerWidth
      let dispH = Math.floor(bitmap.height * (dispW / bitmap.width))
      if (dispH > maxH) {
        dispH = maxH
        dispW = Math.floor(bitmap.width * (dispH / bitmap.height))
      }
      canvas.style.width = `${dispW}px`
      canvas.style.height = `${dispH}px`
      setError('')
    } catch (e) {
      setError('canvas decode: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const refresh = async (): Promise<void> => {
    try {
      const shot = await ctx.remote.browserPopup.shot()
      if (shot.ok && shot.value.ok && shot.value.png) {
        await drawOnCanvas(shot.value.png)
      } else if (shot.ok && !shot.value.ok) {
        setError(shot.value.error ?? 'shot failed')
      } else if (!shot.ok) {
        setError(shot.error.message)
      }
      const info2 = await ctx.remote.browserPopup.pageInfo()
      if (info2.ok && info2.value.ok) {
        setUrl(info2.value.url || '未打开页面')
        setTitle(info2.value.title || '')
      } else if (info2.ok && !info2.value.ok) {
        setError(info2.value.error ?? 'pageInfo failed')
      } else if (!info2.ok) {
        setError(info2.error.message)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    if (!expanded) return undefined
    let alive = true
    const run = async (): Promise<void> => {
      if (!alive) return
      await refresh()
    }
    void run()
    const timer = window.setInterval(run, REFRESH_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [expanded])

  const btn = (text: string, onClick: () => void): ReactElement => (
    <button
      onClick={onClick}
      style={{
        background: 'transparent', border: 'none', color: '#c8c8d8', cursor: 'pointer',
        fontSize: '13px', lineHeight: '1', padding: '4px 6px', borderRadius: '6px', flexShrink: 0,
      }}
    >
      {text}
    </button>
  )

  if (!expanded) {
    return (
      <div
        onClick={() => { setExpanded(true) }}
        title="浏览器画面"
        style={{
          position: 'fixed', right: '16px', top: '16px', zIndex: 2147483000,
          background: '#2a2a38', border: '1px solid #3a3a4a', borderRadius: '999px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)', color: '#e8e8f0', cursor: 'pointer',
          fontFamily: 'system-ui, sans-serif', fontSize: '13px', padding: '8px 14px',
          display: 'flex', alignItems: 'center', gap: '8px', userSelect: 'none',
        }}
      >
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4caf50', display: 'inline-block' }} />
        浏览器画面
      </div>
    )
  }

  const width = maximized ? 'min(92vw - 32px, 1280px)' : `${DEFAULT_WIDTH}px`
  const maxHeight = maximized ? '90vh' : '70vh'

  return (
    <div
      style={{
        position: 'fixed', right: '16px', top: '16px', zIndex: 2147483000,
        width, maxHeight,
        background: '#1e1e28', border: '1px solid #3a3a4a', borderRadius: '12px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)', fontFamily: 'system-ui, sans-serif', color: '#e8e8f0',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
          background: '#2a2a38', borderBottom: '1px solid #3a3a4a', userSelect: 'none',
        }}
      >
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4caf50', flexShrink: 0 }} />
        <span
          style={{ fontSize: '12px', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {title || '浏览器画面'}
        </span>
        {btn('⟳', () => { void refresh() })}
        {btn(maximized ? '⤡' : '⛶', () => { setMaximized(!maximized) })}
        {btn('✕', () => { setExpanded(false) })}
      </div>
      <div
        ref={bodyRef}
        style={{
          flex: 1, overflow: 'auto', position: 'relative', background: '#111116',
          minHeight: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%' }} />
      </div>
      <div
        style={{
          padding: '4px 12px', fontSize: '11px', color: '#9a9ab0', background: '#2a2a38',
          borderTop: '1px solid #3a3a4a', display: 'flex', gap: '8px', alignItems: 'center',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
        {error ? (
          <span style={{ color: '#e57373', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {error}
          </span>
        ) : null}
      </div>
    </div>
  )
}
