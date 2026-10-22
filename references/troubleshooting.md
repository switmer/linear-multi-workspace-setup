# Troubleshooting

## Linear authorization tabs keep opening

Check which client owns the running `mcp-remote` processes and which named servers are enabled in fresh client config. Several agent panes can each start a bridge; if OAuth does not finish, later panes can open more tabs. A `workspace=<alias>` URL label identifies the bridge but does not prove login succeeded.

Pause automatic startup for the affected named servers before starting another OAuth attempt. In Codex, set `enabled = false` in user config and in any repo override that enables the server; confirm with `codex mcp list` from those repos. In Claude Code, remove an always-on user-scope server and add it back at the needed scope after the controlled login. Stop only the exact old Linear bridge processes or restart their panes. Do not clear or inspect credential stores as a first step.

Check the pinned `mcp-remote` release notes. Version 0.14.5 fixed OAuth retries after a follower timeout; do not leave a repeatedly retrying setup pinned to 0.14.3. Re-enable one server in one client process, complete its browser callback, and verify the workspace with a read-only call before re-enabling it in agent panes. If that fails, leave the server disabled and report the failure.

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

Add `--authorize-param workspace=<alias>` to each bridge's arguments. It makes the OAuth URL show which named connection opened the browser and gives each bridge a distinct auth coordination key. Linear still requires the user to select the correct workspace. If adding this parameter to an existing bridge, expect one fresh OAuth login because `mcp-remote` treats the changed arguments as a new auth identity. Use its automatic callback port selection; avoid a fixed port shared by multiple bridges.

Codex cannot run `codex mcp login` against a stdio bridge. Start a fresh Codex process and use the normal read-only workspace check to trigger OAuth and verify the result. For a repo that depends on one named server, set that project's server to `required = true` and allow a longer `startup_timeout_sec`, such as 120 seconds. A startup failure then appears directly instead of leaving the server out of the tool list.

When reporting this recommendation, state that it is Linear's documented fallback and that this skill only provides setup guidance; it does not implement or manage the fallback.

Do not delete a shared `~/.mcp-auth` tree. If cleanup is needed, confirm and remove only the exact failed workspace directory.

## A bundled plugin duplicates a named server

Stop before writes. If the user chose named direct servers, ask before disabling the bundled Linear plugin in the Codex user config. Do not rely on a repo-local plugin override unless `codex plugin list --json` from a fresh process reports the plugin disabled or absent.

After the change, recheck the named MCP servers, plugin state, and expected workspace identity from the target repo. Restart existing panes.

## A Codex repo still exposes every Linear server

Confirm the repo has a `.codex/config.toml` entry for every known Linear server, with only the intended one enabled. Run `codex mcp list` from the repo.

If the other servers remain enabled, check whether Codex trusts the project. Project config is skipped for untrusted repos. Do not report the guard as active until a fresh native command shows the intended loaded state.

## Hosted ChatGPT

Local Codex MCP configuration is not loaded by ChatGPT web. The hosted Linear plugin may expose only one installed authorization. Explain that this skill must run in local Codex or Claude Code for multiple named local connections. Do not claim the skill changes the hosted plugin.

## A work area uses Jira or another tracker

Do not create a Linear server. Keep the work area in the routing map with its real tracker, such as `Dock411 → Jira, never Linear`.

## Verification cannot identify the workspace

Do not accept connection health or OAuth success as proof.

Call `get_workspace` when available and record its immutable workspace ID, name, and URL. If unavailable, record the complete team list, require user confirmation, and mark workspace identity and credential isolation as unverified. Never treat team names alone as proof.

## Current documentation

- [Linear MCP multi-workspace FAQ](https://linear.app/docs/mcp)
- [Codex MCP and hosted ChatGPT behavior](https://developers.openai.com/codex/mcp)
- [Claude Code MCP authentication](https://code.claude.com/docs/en/mcp)
