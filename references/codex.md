# Codex setup

Use Codex's native MCP commands. Check `codex mcp <command> --help` before relying on syntax if the installed version differs.

## Inspect

```bash
codex mcp list
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

Use the exact named server.

Call `get_workspace` when available and record its immutable workspace ID, name, and URL. If unavailable, record the complete team list, require user confirmation, and mark workspace identity and credential isolation as unverified. Never treat team names alone as proof.

When `get_workspace` succeeds, also call `list_teams` and record the returned teams.

When direct tool calls could reuse the current process, launch a fresh read-only check:

```bash
codex exec --ephemeral --skip-git-repo-check --sandbox read-only --json \
  'Use only linear-example. Call get_workspace when available and list_teams. If get_workspace is unavailable, report identity and isolation as unverified. Do not call write tools. Return JSON with the server name, available workspace identity, and complete team names.'
```

After each later login, repeat the available fresh checks for all named Linear servers. Compare immutable workspace IDs with the first confirmed result when IDs are available.

## Routing

Add or update a clearly marked `Linear routing` section in `~/.codex/AGENTS.md`. Preserve all other instructions. Prefer named servers over a bundled Linear plugin.

## Scope a repo to one workspace

Use this only after the user confirms the repo-to-workspace route. Project config has higher priority than user config when Codex trusts the project.

In the repo's `.codex/config.toml`, enable the intended named server and disable every other known Linear server:

```toml
[mcp_servers.linear-roster]
enabled = true

[mcp_servers.linear-hopperx]
enabled = false

[mcp_servers.linear-personal]
enabled = false
```

Do not copy OAuth data or duplicate full server blocks when an `enabled` override is enough. Preserve unrelated project settings.

When the user has chosen named direct Linear servers instead of the bundled plugin, ask before disabling the plugin in `~/.codex/config.toml`:

```toml
[plugins."linear@openai-curated"]
enabled = false
```

Use user scope for this plugin setting. Do not assume the same setting works from project config. Check the loaded state from the target repo:

```bash
codex mcp list
codex plugin list --json
```

Pass the connector check only when the intended named server is enabled, every other Linear MCP server is disabled, and `linear@openai-curated` is disabled or absent. If the project is untrusted, Codex skips `.codex/config.toml`; stop and ask the user to trust it before retrying.

Then launch a fresh read-only identity check from that repo using only the intended named server. Confirm its workspace ID and name match the approved route. Restart every existing Codex pane after success.

## Current documentation

- [Codex MCP](https://developers.openai.com/codex/mcp)
- [Codex configuration reference](https://developers.openai.com/codex/config-reference)
- [Linear MCP](https://linear.app/docs/mcp)
