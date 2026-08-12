# Codex setup

Use Codex's native MCP commands. Check `codex mcp <command> --help` before relying on syntax if the installed version differs.

## Inspect

```bash
codex mcp list --json
codex mcp get linear-example
```

Inspect only servers relevant to the approved plan. Do not inspect OAuth storage.

## Add and authenticate

```bash
codex mcp add linear-example --url https://mcp.linear.app/mcp
codex mcp login linear-example
```

Tell the user which workspace to choose before running `login`. The browser approval belongs to the user.

## Require approval for writes

In `~/.codex/config.toml`, change only the matching server block:

```toml
[mcp_servers.linear-example]
url = "https://mcp.linear.app/mcp"
default_tools_approval_mode = "writes"
```

Preserve every unrelated block and setting. Re-read the named block after editing it.

## Verify

Use the exact named server. Call both read-only tools:

- `get_workspace`
- `list_teams`

When direct tool calls could reuse the current process, launch a fresh read-only check:

```bash
codex exec --ephemeral --skip-git-repo-check --sandbox read-only --json \
  'Use only linear-example. Call get_workspace and list_teams. Do not call write tools. Return JSON with the server name, workspace ID, workspace name, workspace URL, and team names.'
```

After each later login, repeat the fresh check for all named Linear servers. Compare immutable workspace IDs with the first confirmed result.

## Routing

Add or update a clearly marked `Linear routing` section in `~/.codex/AGENTS.md`. Preserve all other instructions. Prefer named servers over a bundled Linear plugin.

## Current documentation

- [Codex MCP](https://developers.openai.com/codex/mcp)
- [Codex configuration reference](https://developers.openai.com/codex/config-reference)
- [Linear MCP](https://linear.app/docs/mcp)
