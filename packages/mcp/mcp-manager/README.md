---
description: "Persistent MCP server management for a Host application: a standard MCP JSON document and a secret-redacted Remote directory."
kind: "package-reference"
---

# @deepseek-ai/dsh-mcp-manager

English | [中文](README.zh.md)

## Summary

Persistent MCP server management for a Host application. The plugin owns a standard MCP JSON document, exposes a secret-redacted Remote directory, and mounts one [`@deepseek-ai/dsh-mcp-client`](../mcp-client/README.md) fiber for each enabled server.

## Table of Contents

- [Configuration](#configuration)
- [Runtime](#runtime)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

## Configuration

The manager owns a dedicated JSON document at `<harness home>/mcp.json`, isolated from the deployment's main `settings.yaml`. The document is the standard MCP server shape — a flat map of server name → definition — so a person pastes what other MCP clients already use:

```json
{
  "tapd_mcp_http": {
    "url": "https://mcpgw.knot.woa.com/tapd/",
    "timeout": 20000,
    "headers": { "X-Tapd-Access-Token": "…" },
    "transportType": "streamable-http"
  },
  "local-files": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"],
    "cwd": "/workspace",
    "env": { "MCP_TOKEN": "…" }
  }
}
```

Each entry names either a `url` (streamable HTTP) or a `command` (stdio); `headers`/`env` hold the secrets, `timeout` reads as seconds below 1000 and milliseconds above (the conventional split: `60` is one minute, `20000` is twenty seconds), and `enabled: false` disables a server without deleting it. The document materializes at mount, external edits hot-publish through a watcher, and the settings-page open action hands it to the native editor.

`headers` and `env` are write-only on the Remote directory: `list` reports only `hasSecrets`, and a UI edit that omits those fields retains the stored values. A draft must set `clearSecrets: true` to remove them.

## Runtime

Saving, enabling, disabling, removing, or restarting a server reconciles live fibers without restarting the Host. The manager reports `connecting`, `connected`, `reconnecting`, `failed`, and `disabled` from the MCP client's status event and includes the discovered tool count. A failed connection does not make the plugin itself appear connected; the server row remains available for retry or editing.

The Remote write methods reject unknown server names and restart requests for disabled servers. Disposing the manager waits for queued reconciliation and releases every child MCP fiber.

-----

<a id="dev-note"></a>
## Dev Note

The document lives at `<harness home>/mcp.json`; the manager materializes it on first open, and writes are serialized and atomic. Each enabled server mounts one `mcp-client` fiber; disabling removes the fiber and its server definition.

## Model Experience

Indirectly, through enabled child `mcp-client` fibers that register their discovered MCP tools; this package owns only persisted definitions and management controls.

#### KV Cache effect

None from management state. Each enabled child client's discovered tool set has the cache behavior documented by `mcp-client`.

## Known Limitations and Deferred Work

- The manager edits one `serverName` at a time; changing a namespace requires removing the old entry and adding a new one so existing tool names remain stable.
- Secrets are never returned to a client UI or Remote caller. The manager's document permissions (`0600`) and the redacted projection remain responsible for protecting the stored values.
