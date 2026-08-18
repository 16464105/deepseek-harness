# Agent Note: Settings-managed Skills and MCP servers

Status: implemented

English | [中文](2026-08-16-settings-managed-skills-and-mcp-servers.zh.md)

## Problem

The Web settings page exposed model and general configuration but offered no way to inspect the workspace Skill catalog or manage MCP servers without editing Host configuration. MCP credentials also needed a write-only path so a browser directory could show connection state without returning environment variables or HTTP headers.

## Decision

`ui-skill` registers a top-level settings section that reads the current session workspace through `skill.list(sessionId, refresh)`. It shows source/provider metadata and stores only chat-picker visibility in `localStorage` under `dsh.skill-picker.hidden.v1`; the map does not alter `SKILL.md`, model invocation, or Host authorization. The refresh action calls the Host `SkillRegistry.refresh()` and then rereads the workspace catalog.

`mcp-manager` owns its dedicated `mcp.json` as the standard MCP server shape — a flat map of server name → definition (`url`/`command`, `headers`/`env`, `timeout` in seconds below 1000 and milliseconds above, `enabled`) — self-managed with atomic writes and a hot-reload watcher, exposes the host-resolved path through `list`, and mounts one `mcp-client` runtime for each enabled definition. The settings-page editor adds a paste-JSON import that parses that shape into one save draft per server. Its Remote exposes list, save, setEnabled, remove, and restart operations. The list projection omits `env` and `headers`, returning only `hasSecrets`. An edit that omits a secret map retains the stored values; `clearSecrets` explicitly removes it. Connection phases and tool counts come from the `mcp/status` event emitted by `mcp-client`, not from plugin activation.

The MCP settings client owns the directory and editor for stdio and Streamable HTTP servers. It keeps secret inputs empty during edits, applies writes immediately, disables mutations for read-only settings, and leaves the server name fixed while editing because it prefixes every published tool name.

## Alternatives considered

**Return redacted values from the settings document and rebuild the whole section in the browser.** Rejected because a redacted replacement would silently erase credentials; the manager's write-only draft and explicit clear operation retain ownership of secret fields on the Host.

**Represent MCP connection state as an active manager plugin flag.** Rejected because the manager can be active while a child server is unreachable. The client-owned status event reports the actual transport lifecycle and discovered tool generation.

**Use client storage as the Skill catalog source.** Rejected because the catalog belongs to the current Host workspace and can change after a refresh. Client storage is limited to the presentation choice of hiding entries from the chat picker.

## Consequences

Settings can manage the complete lifecycle of configured MCP servers without editing `cordis.yml`, while secrets remain on the Host side and live child fibers reconcile after every committed settings change. The Web UI exposes two top-level management sections with localized states, validation, and read-only behavior. Skill visibility follows the browser profile and affects only picker results; an existing or directly typed Skill remains valid for Host and model execution.

Focused Host, client, and MCP-client tests cover persistence, dynamic mount/dispose/restart, secret retention and clearing, status projection, UI mutations, validation, failure states, and read-only behavior. A real Web snapshot and local UI recording remain the product-surface verification for the assembled client.
