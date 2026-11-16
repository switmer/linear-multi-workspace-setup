# Troubleshooting

## Codex reports invalid transport or cannot parse merged config

Check user config and each affected repo override. An entry containing only `enabled` still requires a command or URL from the merged definition, even if disabled. A failed replacement may have removed the global definition that project overrides depend on.

Stop setup and do not repeat login. Confirm the existing server name, expected workspace, and previously configured transport. Restore that complete definition without changing bridge arguments or credential-directory paths. Use the atomic replacement and rollback steps in [Codex setup](codex.md). Never invent a workspace alias or inspect credentials to repair parsing.

Run `codex mcp list` from both an unscoped directory and each affected repo. Then verify the exact expected workspace ID through the named server in a fresh read-only process. Report config parsing, workspace identity, and plugin state separately: one passing does not prove the others.

## Permission, sign-in, config, or model: which problem is it?

Fix only the one you have. A new sign-in repairs only the second.

| What you see | Problem | What to do |
| --- | --- | --- |
| A tool call is refused, or waits for approval (Codex write tools; Claude `-p` with `--permission-mode dontAsk` and a tool missing from `--allowedTools`) | Permission | Fix the allow list or approve the call. Do not sign in again. |
| A server reports it needs authentication, or a sign-in page opens | Sign-in | Sign in once, from one process that stays running. A saved login that can refresh reconnects without a browser. |
| The client cannot parse its config, or a server has no command or URL | Config | Repair the definition. Keep the same arguments and login folder. No sign-in. |
| `codex exec` says the default model is not allowed for your account | Verification model | Pass an allowed model (`-m`, or the router's `--model`). No sign-in. |
| The workspace ID differs from the saved one | Identity | Stop before writes. See Wrong workspace after OAuth. |

Report each separately. One passing does not prove the others.

## Linear authorization tabs keep opening

Check which client owns the running `mcp-remote` processes and which named servers are enabled in fresh client config. Several agent panes can each start a bridge; if OAuth does not finish, later panes can open more tabs. A `workspace=<alias>` URL label identifies the bridge but does not prove login succeeded, and Linear's consent page drops it. Only one process owns a sign-in at a time; when it exits (a startup timeout or a closed pane), the next waiting process takes over and opens a fresh tab. Do not rely on an old tab: its request belonged to a process that has exited. (`mcp-remote` 0.15.1's source says a takeover process can still redeem an earlier request's code, but that is untested here.) Sign in once, from one process that stays alive until the saved login appears, and leave named servers off in user config so only the repos that need them start them. The router's wrapper shows one labeled page that marks itself ended when its process stops; see the known issue below.

Pause automatic startup for the affected named servers before starting another OAuth attempt. In Codex, set `enabled = false` in user config and in any repo override that enables the server; confirm with `codex mcp list` from those repos. In Claude Code, pause an always-on user-scope server by removing it only after copying `~/.claude.json` to a timestamped backup, and add it back at the needed scope after the controlled login. The router never removes a Claude server for you. Stop only the exact old Linear bridge processes or restart their panes. Do not clear or inspect credential stores as a first step.

Check the pinned `mcp-remote` release notes. Version 0.14.5 fixed OAuth retries after a follower timeout; do not leave a repeatedly retrying setup pinned to 0.14.3. Re-enable one server in one client process, complete its browser callback, and verify the workspace with a read-only call before re-enabling it in agent panes. If that fails, leave the server disabled and report the failure.

## The sign-in page still shows a working button

The router's sign-in page checks every 3 seconds whether anything answers on its request's local port. When the process that owned a sign-in exits, a waiting process takes over the same port within a fraction of a second. If that lands between two checks, the old page never sees a gap and keeps a working button for a request whose process has exited.

Stand-in tests (not real bridges) showed a gap of several seconds ended the page, and a gap of about 0.3 second left it live in two of three trials. Whether approving such a page still completes the sign-in is untested. Use the page with the newest "Opened" time, close older ones, and confirm with a read-only `check`. Known issue, not fixed in this release.

## Roster has a different name in each client

The server name is only a label. The login lives in the folder named by `MCP_REMOTE_CONFIG_DIR` (for `roster`, `~/.mcp-auth/linear-roster`). The router names the `roster` alias `linear-onroster` in both clients and reuses whatever name a client already has for that folder, so it never adds a second entry. If two entries in one client point at the same folder, keep the one your routing guidance names, and remove the other only after confirming it is unused. Renaming a server does not need a new sign-in as long as its `MCP_REMOTE_CONFIG_DIR` and `mcp-remote` arguments stay the same.

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

Inspect every installed `linear@…` plugin, including `linear@openai-curated-remote`. A disabled old ID does not offset an enabled remote ID. Missing or unreadable installed state fails the check. If the fresh listing still reports enabled despite config `false`, remove it with `codex plugin remove <pluginId>` (for example `linear@openai-curated-remote`) or have the user turn it off in `/plugins`, then recheck. Account-managed remote plugins ignore `config.toml`, so removal is the reliable fix. Keep Linear writes paused; do not repeat OAuth for this plugin-state problem.

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
