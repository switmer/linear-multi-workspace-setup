# Claude Code setup

Use Claude Code's native MCP commands. Check `claude mcp <command> --help` before relying on syntax if the installed version differs.

## Inspect

```bash
claude mcp list
claude mcp get linear-example
```

Inspect only servers relevant to the approved plan. Do not inspect OAuth storage.

## Add and authenticate

Use user scope so the connection works across local projects. For multiple workspaces, pin a tested `mcp-remote` version and give each named server its own credential directory:

```bash
claude mcp add --transport stdio --scope user linear-example \
  --env "MCP_REMOTE_CONFIG_DIR=$HOME/.mcp-auth/linear-example" \
  -- npx -y 'mcp-remote@<pinned-version>' https://mcp.linear.app/mcp \
  --authorize-param workspace=example
```

The `workspace=example` parameter labels the OAuth URL; the user still chooses the workspace in Linear. Start a fresh Claude Code process to trigger bridge OAuth. `claude mcp login` is for Claude's direct HTTP connection, not this stdio bridge.

If `linear-example` already exists as direct HTTP at user scope, confirm its intended route, run `claude mcp remove --scope user linear-example`, then add the bridge with the same name. The user must approve OAuth again. Do not inspect or move credentials.

Direct HTTP remains available when a separate URL label is unnecessary and each named connection passes the full isolation check:

```bash
claude mcp add --transport http --scope user \
  linear-example https://mcp.linear.app/mcp
claude mcp login linear-example
```

Tell the user which workspace to choose before running `login`. The browser approval belongs to the user. If `login` is unavailable in an older release, open Claude Code and use `/mcp` for that exact server.

## Protect writes

Do not add Linear write tools to automatic permission allowlists. Require human approval for creates, edits, comments, status changes, and deletes.

## Verify

Use the exact named server.

Call `get_workspace` when available and record its immutable workspace ID, name, and URL. If unavailable, record the complete team list, require user confirmation, and mark workspace identity and credential isolation as unverified. Never treat team names alone as proof.

When `get_workspace` succeeds, also call `list_teams` and record the returned teams.

When direct tool calls could reuse the current process, launch a fresh check and allow only those read tools:

```bash
claude -p --no-session-persistence --permission-mode dontAsk \
  --allowedTools mcp__linear-example__get_workspace,mcp__linear-example__list_teams \
  --output-format json \
  'Use only linear-example. Call get_workspace when available and list_teams. If get_workspace is unavailable, report identity and isolation as unverified. Return the available workspace identity and complete team names.'
```

After each later login, repeat the available fresh checks for all named Linear servers. Compare immutable workspace IDs with the first confirmed result when IDs are available.

## Routing

Add or update a clearly marked `Linear routing` section in `~/.claude/CLAUDE.md`. Preserve all other instructions. Prefer named servers over a bundled Linear plugin.

## Current documentation

- [Claude Code MCP](https://code.claude.com/docs/en/mcp)
- [Linear MCP](https://linear.app/docs/mcp)
