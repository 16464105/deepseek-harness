# @deepseek-ai/dsh-client-ui-settings-mcp

English | [中文](README.zh.md)

MCP settings section for the Web client. It registers the top-level `MCP` settings entry and uses the `mcp-manager` Remote to manage local-process and Streamable HTTP servers.

## Behavior

The page lists each stored server with its transport, enabled state, connection phase, discovered tool count, and a `hasSecrets` marker. Users can add, edit, enable, disable, reconnect, and remove servers. The form parses one argument per line, `KEY=VALUE` environment entries, and `Name: Value` headers; all writes apply immediately through the Host Remote.

Secret fields are deliberately blank when editing. Leaving them blank retains the stored environment or headers, while the explicit clear checkbox removes them. The browser never receives their values. A read-only settings document leaves the directory visible and disables every mutation control.

## Model Experience

None, as this package renders settings UI; the managed child MCP clients own model-visible tools.

#### KV Cache effect

None; the settings UI never assembles or sends provider requests.

## Known Limitations and Deferred Work

- The form exposes stdio and Streamable HTTP fields, timeout, and secret maps. Reconnect policy remains at its composed default and is not edited in this page.
- The server name is immutable while editing because it is part of every published tool name.
