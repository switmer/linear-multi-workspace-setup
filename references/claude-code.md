# Claude Code setup

Use Claude Code's native MCP commands. Check `claude mcp <command> --help` before relying on syntax if the installed version differs.

## Inspect

```bash
claude mcp list
claude mcp get linear-example
```

Inspect only servers relevant to the approved plan. Do not inspect OAuth storage.

## Add and authenticate

Use user scope so the connection works across local projects:

```bash
claude mcp add --transport http --scope user \
  linear-example https://mcp.linear.app/mcp
claude mcp login linear-example
```

Tell the user which workspace to choose before running `login`. The browser approval belongs to the user. If `login` is unavailable in an older release, open Claude Code and use `/mcp` for that exact server.

## Protect writes

Do not add Linear write tools to automatic permission allowlists. Require human approval for creates, edits, comments, status changes, and deletes.

## Verify

Use the exact named server. Call both read-only tools:

- `get_workspace`
- `list_teams`

When direct tool calls could reuse the current process, launch a fresh check and allow only those read tools:

```bash
claude -p --no-session-persistence --permission-mode dontAsk \
  --allowedTools mcp__linear-example__get_workspace,mcp__linear-example__list_teams \
  --output-format json \
  'Use only linear-example. Call get_workspace and list_teams. Return the workspace ID, workspace name, workspace URL, and team names.'
```

After each later login, repeat the fresh check for all named Linear servers. Compare immutable workspace IDs with the first confirmed result.

## Routing

Add or update a clearly marked `Linear routing` section in `~/.claude/CLAUDE.md`. Preserve all other instructions. Prefer named servers over a bundled Linear plugin.

## Current documentation

- [Claude Code MCP](https://code.claude.com/docs/en/mcp)
- [Linear MCP](https://linear.app/docs/mcp)
