import { useEffect, useState, type ReactNode } from 'react'
import type {
  McpServerDraft, McpServerSnapshot, McpServerView,
} from '@deepseek-ai/dsh-api-remotes/client'
import {
  IconCloseOutline16, IconEditOutline16, IconPlusOutline16, IconRefreshOutline16, IconTrashOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { parseMcpJson } from './json-import.ts'
import type { McpSettingsKey } from './locales.ts'
import css from './McpSettingsSection.module.css'

/** Remote operations supplied by the registration. */
export interface McpSettingsInjected {
  readonly list: () => Promise<McpServerSnapshot>
  readonly save: (draft: McpServerDraft) => Promise<McpServerSnapshot>
  readonly setEnabled: (serverName: string, enabled: boolean) => Promise<McpServerSnapshot>
  readonly remove: (serverName: string) => Promise<McpServerSnapshot>
  readonly restart: (serverName: string) => Promise<McpServerSnapshot>
  /** Open the host-resolved `mcp.json` document on the desktop. */
  readonly openDocument: () => void
}

export type McpSettingsProps = PropsRuntime<'settings.section'>
  & PropsLocale<'settings.mcp'>
  & InjectFace<McpSettingsInjected>

type ViewState =
  | { readonly status: 'loading' | 'error' }
  | { readonly status: 'ready'; readonly snapshot: McpServerSnapshot }

interface EditorState {
  readonly originalName?: string
  transport: 'stdio' | 'streamable-http'
  serverName: string
  enabled: boolean
  command: string
  args: string
  cwd: string
  url: string
  secrets: string
  clearSecrets: boolean
  timeout: string
}

const SERVER_NAME = /^[A-Za-z0-9_-]{1,32}$/

function emptyEditor(): EditorState {
  return {
    transport: 'stdio', serverName: '', enabled: true, command: '', args: '', cwd: '', url: '',
    secrets: '', clearSecrets: false, timeout: '60000',
  }
}

function editServer(server: McpServerView): EditorState {
  return {
    originalName: server.serverName,
    transport: server.transport,
    serverName: server.serverName,
    enabled: server.enabled,
    command: server.transport === 'stdio' ? server.command : '',
    args: server.transport === 'stdio' ? server.args.join('\n') : '',
    cwd: server.transport === 'stdio' ? server.cwd : '',
    url: server.transport === 'streamable-http' ? server.url : '',
    secrets: '',
    clearSecrets: false,
    timeout: String(server.toolCallTimeoutMs),
  }
}

function parsePairs(value: string, separator: '=' | ':'): Record<string, string> | undefined {
  const result: Record<string, string> = {}
  for (const raw of value.split('\n')) {
    const line = raw.trim()
    if (line === '') continue
    const at = line.indexOf(separator)
    if (at <= 0) return undefined
    const key = line.slice(0, at).trim()
    if (key === '') return undefined
    result[key] = line.slice(at + 1).trim()
  }
  return result
}

function phaseKey(phase: McpServerView['phase']): McpSettingsKey {
  return phase
}

/** MCP server directory and editor. */
export function McpSettingsSection(props: McpSettingsProps): ReactNode {
  const { list, save, setEnabled, remove, restart, openDocument, t } = props
  const [request, setRequest] = useState(0)
  const [state, setState] = useState<ViewState>({ status: 'loading' })
  const [editor, setEditor] = useState<EditorState | undefined>()
  const [busy, setBusy] = useState<string | undefined>()
  const [confirming, setConfirming] = useState<string | undefined>()
  const [failure, setFailure] = useState<string | undefined>()
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteError, setPasteError] = useState<string | undefined>()

  useEffect(() => {
    let current = true
    setState({ status: 'loading' })
    void list().then(
      (snapshot) => { if (current) setState({ status: 'ready', snapshot }) },
      () => { if (current) setState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [list, request])

  const run = (key: string, action: () => Promise<McpServerSnapshot>): void => {
    setBusy(key)
    setFailure(undefined)
    void action().then(
      (snapshot) => { setState({ status: 'ready', snapshot }) },
      () => { setFailure(t('operationFailed')) },
    ).finally(() => { setBusy(undefined) })
  }

  const submit = (): void => {
    if (editor === undefined) return
    if (!SERVER_NAME.test(editor.serverName)) {
      setFailure(t('invalidName'))
      return
    }
    const timeout = Number(editor.timeout)
    const requiredMissing = editor.transport === 'stdio' ? editor.command.trim() === '' : editor.url.trim() === ''
    if (requiredMissing || !Number.isFinite(timeout) || timeout <= 0) {
      setFailure(t('required'))
      return
    }
    const secrets = parsePairs(editor.secrets, editor.transport === 'stdio' ? '=' : ':')
    if (secrets === undefined) {
      setFailure(t('invalidPairs'))
      return
    }
    const common = {
      serverName: editor.serverName,
      enabled: editor.enabled,
      toolCallTimeoutMs: timeout,
      ...(editor.clearSecrets ? { clearSecrets: true } : {}),
    }
    const draft: McpServerDraft = editor.transport === 'stdio'
      ? {
        ...common,
        transport: 'stdio',
        command: editor.command.trim(),
        args: editor.args.split('\n').map(value => value.trim()).filter(Boolean),
        cwd: editor.cwd.trim(),
        ...(editor.secrets.trim() === '' ? {} : { env: secrets }),
      }
      : {
        ...common,
        transport: 'streamable-http',
        url: editor.url.trim(),
        ...(editor.secrets.trim() === '' ? {} : { headers: secrets }),
      }
    setBusy(`save:${editor.serverName}`)
    setFailure(undefined)
    void save(draft).then(
      (snapshot) => {
        setState({ status: 'ready', snapshot })
        setEditor(undefined)
      },
      () => { setFailure(t('operationFailed')) },
    ).finally(() => { setBusy(undefined) })
  }

  /** Parse the pasted standard JSON and save every server it names. */
  const importPasted = (): void => {
    const drafts = parseMcpJson(pasteText)
    if (drafts === undefined || drafts.length === 0) {
      setPasteError(t('pasteInvalid'))
      return
    }
    setPasteError(undefined)
    setBusy('import')
    setFailure(undefined)
    void (async () => {
      let latest: McpServerSnapshot | undefined
      for (const draft of drafts) latest = await save(draft)
      if (latest !== undefined) setState({ status: 'ready', snapshot: latest })
      setPasteOpen(false)
      setPasteText('')
    })().catch(() => {
      setPasteError(t('operationFailed'))
    }).finally(() => { setBusy(undefined) })
  }

  const snapshot = state.status === 'ready' ? state.snapshot : undefined
  return (
    <section className={css.section} aria-busy={state.status === 'loading'}>
      <div className={css.heading}>
        <div>
          <h2>{t('title')}</h2>
          <p>{t('intro')}</p>
        </div>
        <div className={css.headingActions}>
          <button type="button" className={css.secondary} onClick={() => { openDocument() }}>
            {t('openDocument')}
          </button>
          <button type="button" className={css.secondary} onClick={() => { setRequest(value => value + 1) }}>
            <IconRefreshOutline16 size={15} />{t('refresh')}
          </button>
          <button type="button" className={css.secondary} disabled={snapshot?.writable !== true} onClick={() => { setPasteOpen(true) }}>
            <IconPlusOutline16 size={15} />{t('importJson')}
          </button>
          <button type="button" className={css.primary} disabled={snapshot?.writable !== true} onClick={() => { setEditor(emptyEditor()) }}>
            <IconPlusOutline16 size={15} />{t('add')}
          </button>
        </div>
      </div>
      {pasteOpen ? (
        <div className={css.editor}>
          <div className={css.editorHeading}>
            <h3>{t('importJsonTitle')}</h3>
            <button type="button" className={css.iconButton} title={t('cancel')} aria-label={t('cancel')} onClick={() => { setPasteOpen(false); setPasteText(''); setPasteError(undefined) }}>
              <IconCloseOutline16 size={16} />
            </button>
          </div>
          <label className={css.field}><span>{t('importJsonLabel')}</span>
            <textarea aria-label={t('importJsonLabel')} value={pasteText} rows={10} placeholder={'{\n  "tapd_mcp_http": {\n    "url": "https://…",\n    "timeout": 20000,\n    "headers": { "X-Tapd-Access-Token": "…" },\n    "transportType": "streamable-http"\n  }\n}'} onChange={(event) => { setPasteText(event.currentTarget.value); setPasteError(undefined) }} />
          </label>
          {pasteError !== undefined ? <p className={css.failure} role="alert">{pasteError}</p> : null}
          <div className={css.editorActions}>
            <button type="button" className={css.secondary} onClick={() => { setPasteOpen(false); setPasteText(''); setPasteError(undefined) }}>{t('cancel')}</button>
            <button type="button" className={css.primary} disabled={busy !== undefined} onClick={importPasted}>{busy === 'import' ? t('importing') : t('importJsonApply')}</button>
          </div>
        </div>
      ) : null}
      {snapshot?.writable === false ? <p className={css.notice}>{t('readOnly')}</p> : null}
      {failure !== undefined ? <p className={css.failure} role="alert">{failure}</p> : null}
      {state.status === 'loading' ? <p className={css.status}>{t('loading')}</p> : null}
      {state.status === 'error' ? (
        <div className={css.failure} role="alert">{t('error')} <button type="button" onClick={() => { setRequest(value => value + 1) }}>{t('retry')}</button></div>
      ) : null}
      {editor !== undefined ? (
        <div className={css.editor}>
          <div className={css.editorHeading}>
            <h3>{editor.originalName === undefined ? t('editorAdd') : t('editorEdit').replace('{name}', editor.originalName)}</h3>
            <button type="button" className={css.iconButton} title={t('cancel')} aria-label={t('cancel')} onClick={() => { setEditor(undefined) }}>
              <IconCloseOutline16 size={16} />
            </button>
          </div>
          <label className={css.field}><span>{t('transport')}</span>
            <span className={css.segmented}>
              <button type="button" data-active={editor.transport === 'stdio'} onClick={() => { setEditor({ ...editor, transport: 'stdio' }) }}>{t('stdio')}</button>
              <button type="button" data-active={editor.transport === 'streamable-http'} onClick={() => { setEditor({ ...editor, transport: 'streamable-http' }) }}>{t('http')}</button>
            </span>
          </label>
          <label className={css.field}><span>{t('serverName')}</span><input aria-label={t('serverName')} value={editor.serverName} disabled={editor.originalName !== undefined} onChange={(event) => { setEditor({ ...editor, serverName: event.currentTarget.value }) }} /><small>{t('serverNameHint')}</small></label>
          {editor.transport === 'stdio' ? (
            <>
              <label className={css.field}><span>{t('command')}</span><input aria-label={t('command')} value={editor.command} onChange={(event) => { setEditor({ ...editor, command: event.currentTarget.value }) }} /></label>
              <label className={css.field}><span>{t('args')}</span><textarea aria-label={t('args')} value={editor.args} rows={3} onChange={(event) => { setEditor({ ...editor, args: event.currentTarget.value }) }} /><small>{t('argsHint')}</small></label>
              <label className={css.field}><span>{t('cwd')}</span><input aria-label={t('cwd')} value={editor.cwd} onChange={(event) => { setEditor({ ...editor, cwd: event.currentTarget.value }) }} /></label>
              <label className={css.field}><span>{t('env')}</span><textarea aria-label={t('env')} value={editor.secrets} rows={3} onChange={(event) => { setEditor({ ...editor, secrets: event.currentTarget.value }) }} /><small>{t('envHint')}</small></label>
            </>
          ) : (
            <>
              <label className={css.field}><span>{t('url')}</span><input aria-label={t('url')} type="url" value={editor.url} onChange={(event) => { setEditor({ ...editor, url: event.currentTarget.value }) }} /></label>
              <label className={css.field}><span>{t('headers')}</span><textarea aria-label={t('headers')} value={editor.secrets} rows={3} onChange={(event) => { setEditor({ ...editor, secrets: event.currentTarget.value }) }} /><small>{t('headersHint')}</small></label>
            </>
          )}
          <label className={css.field}><span>{t('timeout')}</span><input aria-label={t('timeout')} type="number" min="1" step="1000" value={editor.timeout} onChange={(event) => { setEditor({ ...editor, timeout: event.currentTarget.value }) }} /></label>
          {editor.originalName !== undefined ? <label className={css.check}><input type="checkbox" checked={editor.clearSecrets} onChange={(event) => { setEditor({ ...editor, clearSecrets: event.currentTarget.checked }) }} />{t('clearSecrets')}</label> : null}
          <div className={css.editorActions}>
            <button type="button" className={css.secondary} onClick={() => { setEditor(undefined) }}>{t('cancel')}</button>
            <button type="button" className={css.primary} disabled={busy !== undefined} onClick={submit}>{busy?.startsWith('save:') ? t('saving') : t('save')}</button>
          </div>
        </div>
      ) : null}
      {snapshot?.servers.length === 0 && editor === undefined ? <p className={css.status}>{t('empty')}</p> : null}
      {snapshot !== undefined && snapshot.servers.length > 0 ? (
        <ul className={css.list}>
          {snapshot.servers.map(server => (
            <li className={css.row} key={server.serverName}>
              <div className={css.identity}>
                <span className={css.dot} data-phase={server.phase} aria-hidden="true" />
                <div><strong>{server.serverName}</strong><span>{server.transport === 'stdio' ? t('stdio') : t('http')}</span></div>
              </div>
              <div className={css.runtime}>
                <span>{t(phaseKey(server.phase))}</span>
                {server.phase === 'connected' ? <span>{t('tools').replace('{count}', String(server.toolCount))}</span> : null}
                {server.hasSecrets ? <span>{t('secretsStored')}</span> : null}
              </div>
              {confirming === server.serverName ? (
                <div className={css.confirm}>
                  <span>{t('confirmRemove').replace('{name}', server.serverName)}</span>
                  <button type="button" onClick={() => { setConfirming(undefined) }}>{t('cancel')}</button>
                  <button type="button" className={css.danger} onClick={() => { run(`remove:${server.serverName}`, () => remove(server.serverName)); setConfirming(undefined) }}>{t('confirm')}</button>
                </div>
              ) : (
                <div className={css.actions}>
                  <label className={css.switch}><input type="checkbox" checked={server.enabled} disabled={!snapshot.writable || busy !== undefined} onChange={(event) => { run(`toggle:${server.serverName}`, () => setEnabled(server.serverName, event.currentTarget.checked)) }} /><span>{server.enabled ? t('enabled') : t('disabled')}</span></label>
                  <button type="button" className={css.iconButton} title={t('reconnect').replace('{name}', server.serverName)} aria-label={t('reconnect').replace('{name}', server.serverName)} disabled={!server.enabled || busy !== undefined} onClick={() => { run(`restart:${server.serverName}`, () => restart(server.serverName)) }}><IconRefreshOutline16 size={16} /></button>
                  <button type="button" className={css.iconButton} title={t('edit').replace('{name}', server.serverName)} aria-label={t('edit').replace('{name}', server.serverName)} disabled={!snapshot.writable || busy !== undefined} onClick={() => { setEditor(editServer(server)) }}><IconEditOutline16 size={16} /></button>
                  <button type="button" className={`${css.iconButton} ${css.dangerIcon}`} title={t('remove').replace('{name}', server.serverName)} aria-label={t('remove').replace('{name}', server.serverName)} disabled={!snapshot.writable || busy !== undefined} onClick={() => { setConfirming(server.serverName) }}><IconTrashOutline16 size={16} /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
