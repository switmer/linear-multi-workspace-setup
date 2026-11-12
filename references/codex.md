# Codex setup

Use Codex's native MCP commands. Check `codex mcp <command> --help` before relying on syntax if the installed version differs.

## Inspect

```bash
codex mcp list
codex mcp get linear-example
```

Inspect only servers relevant to the approved plan. Do not inspect OAuth storage.

## Add and authenticate

For multiple workspaces, use a separate `mcp-remote` bridge for each named server (optionally through the labeled wrapper in [`router/`](https://github.com/switmer/linear-multi-workspace-setup/tree/main/router), which keeps the same arguments and credential folder). Verification runs may need an explicit model the account allows; pass it with `--model` rather than changing the global model. Pin a tested `mcp-remote` version and give each server a separate credential directory. For example:

```bash
codex mcp add linear-example \
  --env "MCP_REMOTE_CONFIG_DIR=$HOME/.mcp-auth/linear-example" \
  -- npx -y 'mcp-remote@<pinned-version>' https://mcp.linear.app/mcp \
  --authorize-param workspace=example
```

The `workspace=example` parameter is a visible label in the OAuth URL. It does not preselect the Linear workspace. Tell the user to choose the planned workspace. Start a fresh Codex process to trigger bridge OAuth; `codex mcp login` does not support stdio servers. Do not set a fixed callback port unless the OAuth provider requires one.

### Replace an existing connection safely

Never remove a global Codex server before adding its replacement. A project may still reference it with only `enabled = true` or `enabled = false`. Either reference needs a complete transport after config merging; removing the global definition can prevent the next Codex command from loading config.

1. Confirm the existing server name and its intended workspace. Do not guess an alias or rename it to repair parsing.
2. Prepare the full replacement in memory: `command`, `args`, its own `MCP_REMOTE_CONFIG_DIR` path, `default_tools_approval_mode = "writes"`, `startup_timeout_sec = 120`, and `enabled = false`. For a planned HTTP-to-stdio change, remove the old HTTP transport fields from that server block in the prepared config. Preserve unrelated settings and servers.
3. Retain the prior config for rollback without printing it or inspecting credential storage. Check that the file has not changed since it was read. Write the complete replacement through a temporary file in the same directory, restrict it to the user, then rename it over the config. Do not write an intermediate state with no transport.
4. Confirm `codex mcp list` parses from an unscoped directory and every known affected repo before starting OAuth. Check each named definition with `codex mcp get <name> --json`; require a non-empty stdio command or HTTP URL, even for disabled servers. Do not print secrets returned by config commands.
5. Use a fresh read-only process to verify the workspace. Enable the disabled server only for that process with `-c 'mcp_servers.linear-example.enabled=true'`. After a later login, enable each server being rechecked in that process and confirm all earlier workspace IDs.
6. If replacement or verification fails, restore the previous config atomically, provided no other process changed it. If another process edited it, stop and report the conflict instead of overwriting those edits. Config rollback does not undo an OAuth workspace choice or credential changes.

Keep the same bridge arguments and credential-directory path when only repairing config. Changing the auth identity may require new user-controlled OAuth; a config parse error by itself is not a reason to sign in again. Do not inspect or move credentials.

Direct HTTP remains available when a separate URL label is unnecessary and each named connection passes the full isolation check:

```bash
codex mcp add linear-example --url https://mcp.linear.app/mcp
codex mcp login linear-example
```

Tell the user which workspace to choose before running `login`. The browser approval belongs to the user.

## Require approval for writes

In `~/.codex/config.toml`, change only the matching server block:

```toml
[mcp_servers.linear-example]
default_tools_approval_mode = "writes"
startup_timeout_sec = 120
```

Add these settings to the server block created above; keep its `command`, `args`, and `env` fields. The longer timeout gives a fresh OAuth handshake time to finish. Preserve every unrelated block and setting. Re-read the named block after editing it.

## Verify

Use the exact named server.

Call `get_workspace` when available and record its immutable workspace ID, name, and URL. If unavailable, record the complete team list, require user confirmation, and mark workspace identity and credential isolation as unverified. Never treat team names alone as proof.

When `get_workspace` succeeds, also call `list_teams` and record the returned teams.

When direct tool calls could reuse the current process, launch a fresh read-only check:

```bash
codex exec -c 'mcp_servers.linear-example.enabled=true' --ephemeral --skip-git-repo-check --sandbox read-only --json \
  'Use only linear-example. Call get_workspace when available and list_teams. If get_workspace is unavailable, report identity and isolation as unverified. Do not call write tools. Return JSON with the server name, available workspace identity, and complete team names.'
```

After each later login, repeat the available fresh checks for all named Linear servers. Compare immutable workspace IDs with the first confirmed result when IDs are available.

## Routing

Add or update a clearly marked `Linear routing` section in `~/.codex/AGENTS.md`. Preserve all other instructions. Prefer named servers over a bundled Linear plugin.

## Scope a repo to one workspace

Use this only after the user confirms the repo-to-workspace route. Project config has higher priority than user config when Codex trusts the project.

After the named servers pass their isolation checks, set `enabled = false` in each Linear server block in `~/.codex/config.toml`. Then an unscoped repo cannot start every Linear connection. A trusted repo can enable its chosen server below. Confirm the loaded result with `codex mcp list` from both an unscoped directory and the target repo.

Before writing any repo override, check every referenced server, including those being disabled. Its global definition must exist and the merged connection must have a non-empty stdio command or HTTP URL. A name appearing in either file is not enough. If config discovery fails, repair the missing transport first without OAuth. Do not add a flag-only entry for an undefined server. Before removing or renaming a global definition, check every known repo override that depends on it.

In the repo's `.codex/config.toml`, enable the intended named server and disable every other known Linear server:

```toml
[mcp_servers.linear-roster]
enabled = true
required = true
startup_timeout_sec = 120

[mcp_servers.linear-hopperx]
enabled = false

[mcp_servers.linear-personal]
enabled = false
```

Do not copy OAuth data or duplicate full server blocks when an `enabled` override is enough. Preserve unrelated project settings.

`required = true` makes Codex report a startup failure if the selected Linear server cannot initialize, instead of silently leaving its tools out of the session. Use it only for the repo's confirmed Linear server.

When the user has chosen named direct Linear servers instead of the bundled plugin, ask before disabling the plugin in `~/.codex/config.toml`:

```toml
[plugins."linear@openai-curated"]
enabled = false

[plugins."linear@openai-curated-remote"]
enabled = false
```

Use user scope for this plugin setting. Do not assume the same setting works from project config. Check the loaded state from the target repo:

```bash
codex mcp list
codex plugin list --json
```

Pass the connector check only when the intended named server is enabled, every other Linear MCP server is disabled, and every installed `linear@…` plugin is disabled or absent. Inspect all installed Linear plugin IDs, including `linear@openai-curated-remote`; do not look up only the old ID or stop at the first disabled match. Missing, unreadable, or unrecognized plugin state fails the check. A config value of `false` is not proof of the installed state. If the fresh listing still reports an enabled Linear plugin, have the user disable that plugin through `/plugins`, recheck, and keep Linear writes paused until it passes. Also confirm all named Linear servers are disabled outside scoped repos. If the project is untrusted, Codex skips `.codex/config.toml`; stop and ask the user to trust it before retrying.

Then launch a fresh read-only identity check from that repo using only the intended named server. Confirm its workspace ID and name match the approved route. Restart every existing Codex pane after success.

## Current documentation

- [Codex MCP](https://developers.openai.com/codex/mcp)
- [Codex configuration reference](https://developers.openai.com/codex/config-reference)
- [Linear MCP](https://linear.app/docs/mcp)
