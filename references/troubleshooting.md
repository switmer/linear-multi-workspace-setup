# Troubleshooting

## Wrong workspace after OAuth

Stop before writes.

1. Record the expected and actual workspace names without recording tokens.
2. Log out only the failed server: `codex mcp logout <name>` or `claude mcp logout <name>`.
3. Start that server's login again.
4. Ask the user to select the intended workspace.
5. Re-run the complete isolation check for every named server.

## One login replaces another workspace

The client is likely sharing one authentication context for the endpoint. Stop direct HTTP setup.

Linear documents a fallback through `mcp-remote`: give each named server a separate `MCP_REMOTE_CONFIG_DIR`. Use an explicit absolute directory per workspace, such as:

```text
~/.mcp-auth/linear-roster
~/.mcp-auth/linear-hopperx
```

Resolve and pin a current `mcp-remote` version before adding the stdio servers. Pass the unique directory as an environment variable to each server. Never reuse a directory. Authenticate one at a time, then repeat the full fresh-process verification sequence.

Do not delete a shared `~/.mcp-auth` tree. If cleanup is needed, confirm and remove only the exact failed workspace directory.

## A bundled plugin duplicates a named server

Do not remove or modify the plugin unless the user asks. Add routing guidance that always prefers the correct named server. Require explicit workspace confirmation before writes.

## Hosted ChatGPT

Local Codex MCP configuration is not loaded by ChatGPT web. The hosted Linear plugin may expose only one installed authorization. Explain that this skill must run in local Codex or Claude Code for multiple named local connections. Do not claim the skill changes the hosted plugin.

## A work area uses Jira or another tracker

Do not create a Linear server. Keep the work area in the routing map with its real tracker, such as `Dock411 → Jira, never Linear`.

## Verification cannot identify the workspace

Do not accept connection health or OAuth success as proof. Require `get_workspace` when available. If the server exposes only teams, ask the user to confirm the complete team list and mark workspace identity as unverified.

## Current documentation

- [Linear MCP multi-workspace FAQ](https://linear.app/docs/mcp)
- [Codex MCP and hosted ChatGPT behavior](https://developers.openai.com/codex/mcp)
- [Claude Code MCP authentication](https://code.claude.com/docs/en/mcp)
