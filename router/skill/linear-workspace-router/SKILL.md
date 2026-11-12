---
name: linear-workspace-router
description: Use when one Linear account spans multiple workspaces and an agent risks reusing one OAuth context, exposing the wrong Linear connection in a repo, silently switching workspaces, or sending a write to the wrong company. Configure and verify named Linear MCP servers, and scope Codex repos to one intended workspace. Do not use for ordinary issue work after the repo and workspace are already verified.
---

# Linear Workspace Router

Use the packaged CLI for setup. Do not recreate the OAuth sequence by hand unless the CLI is unavailable.

## Setup workflow

1. Ask for a short alias. Accept an expected workspace name when known; otherwise let interactive setup discover it.
2. Run a dry run first:

   ```bash
   node {{ROUTER_BIN}} --dry-run --client both \
     --workspace alias="Expected Workspace"
   ```

3. Show the plan. Keep one named server per workspace.
4. Run setup without `--dry-run`.
5. Match the `workspace=<alias>` marker in each OAuth URL to the workspace being set up, then let the user choose that workspace in Linear. The marker does not select it.
6. Show the discovered workspace name and URL. Require the user to confirm them.
7. Pin the workspace ID and require the CLI’s read-only isolation check to pass after every login.
8. Stop immediately if an earlier connection changes workspaces.
9. Scope each Codex repo to its intended workspace.
10. Restart configured clients and panes after success.

## How the connections are built

- Every named server runs the labeled wrapper: `node <router>/bin/linear-bridge-label.mjs https://mcp.linear.app/mcp --authorize-param workspace=<alias>`. It runs the pinned `mcp-remote` and, when Linear needs a sign-in, opens one page titled with the workspace name and a "Continue to Linear for <WORKSPACE>" button. That page replaces the raw Linear tab. Its button turns off when the request ends. Linear's own consent page still does not show the workspace; pick it there by name.
- The saved login lives in `~/.mcp-auth/linear-<alias>`. The wrapper and the plain command hash to the same folder, so existing logins keep working.
- The server name can differ from the folder. If a client already holds that login folder under another name (for example Roster: server `linear-onroster` in both clients, login folder `linear-roster`), the router reuses that name and never adds a second entry.
- Saved workspace pins: after a check or setup confirms a workspace through its named server, the router saves its alias, name, ID and URL in `pins.json` next to the CLI (no tokens). Later `check` and `scope` runs read the saved ID, so `--workspace roster` works with no name typed. The ID is what counts: if Linear shows a new display name for the same ID, the check passes and the saved name updates. If the live ID differs, the check fails and shows both IDs, and the saved pin is never overwritten. Only edit `pins.json` by hand if you really mean to point an alias at a different workspace.
- A server that already uses the wrapper and the right folder is left alone and only verified. The router never rewrites it with a plain `npx` command, and keeps its `enabled` setting.
- Codex setup replaces the complete named connection atomically and rolls back if verification fails. New Codex connections start disabled; the router does not change `enabled` on existing ones.
- Claude Code setup never removes a server. A new server is added with `claude mcp add-json`. An existing one is replaced by editing only that one entry in `~/.claude.json` in a single atomic rename, after a timestamped backup and a check that the file did not change meanwhile. If anything fails, the old entry stays in place. Do not run `claude mcp remove` by hand for these servers.
- Verification enables the requested servers only in its fresh process. If verification or workspace confirmation fails, setup restores the prior config, unless another process has edited it. Config rollback does not roll back credentials or an OAuth workspace choice. Do not repeat login/setup to repair a config parse error; inspect config and use read-only checks first.

The plugin guard checks all installed `linear@…` IDs, including `linear@openai-curated-remote`. Missing or unreadable plugin state is a failed check. Scope config disables both shipped IDs, but the fresh plugin listing must confirm they are disabled. If it still reports enabled, stop Linear writes and remove it with `codex plugin remove <pluginId>` (account-managed remote plugins ignore `config.toml`); do not report routing as fully verified.

Never print, inspect, copy, or repurpose OAuth tokens.

## Repo guard

Before Linear work in a Codex repo, check the loaded state from that repo:

```bash
codex mcp list
codex plugin list --json
```

Proceed only when the repo exposes its intended named Linear server, every other named Linear server is disabled, and the bundled Linear plugin is disabled. Use an explicit repo instruction or a user-confirmed map to choose the workspace. Never choose from the repo name, team names, or the currently active browser workspace alone.

If the task includes setup or repo scoping, run a dry run, show the plan, then run:

```bash
node {{ROUTER_BIN}} scope --client codex \
  --workspace alias="Expected Workspace"
```

The command writes the smallest `.codex/config.toml` override, makes the selected server required with a 120-second startup window, disables the bundled Linear plugin in the user config, and checks the loaded MCP and plugin state in fresh Codex processes. It also verifies the expected workspace through the selected named server. If the current task did not authorize config changes, stop before Linear writes and ask the user to run or approve the scope command.

Before writing overrides, the command checks every named server with `codex mcp get <name> --json`. Every server being enabled **or disabled** must have a complete transport: a stdio command or an HTTP URL. A name or `enabled = false` alone is not enough. If config discovery or transport checks fail, stop without writing config. Repair the named connection first; do not guess a workspace alias, rename a server, or repeat OAuth to fix a config error.

Project overrides only turn servers on or off. They must not carry their own `command` or `args`; the global definition is the one source. Never add flag-only entries for missing servers. Before removing or renaming a global server, check project overrides that reference it. Keep the existing server names unless the user requested a rename.

Project config only loads for trusted repos. Treat a scope check failure as a blocker for Linear writes. Restart existing panes after a successful change because they keep the tools loaded at startup.

Repo scoping currently supports Codex only. For Claude Code, keep using the exact named server and the existing isolation check; do not claim that other user-scoped servers are hidden per repo.

## Routing rules

- Prefer named Linear servers over bundled or hosted Linear connectors.
- Search multiple named servers only for reads when the workspace is unclear.
- Confirm the workspace before every create, edit, comment, or status change.
- Keep Codex `default_tools_approval_mode = "writes"` enabled.
- Keep Claude Linear write tools outside automatic permission allowlists.

## Verification-only workflow

Run:

```bash
node {{ROUTER_BIN}} check --client both \
  --workspace alias="Expected Workspace"
```

Treat a successful OAuth message as incomplete evidence. Success requires a fresh-process `get_workspace` result for every named server.

## Boundaries

- Do not create a Linear connection for a company that uses Jira or another tracker.
- Do not merge separate companies into one Linear workspace to avoid connector limits.
- Do not continue setup after a mismatch. See [failure handling](references/failure-handling.md).

## Examples

- Positive: “Set up Roster, HopperX, and my personal Linear workspace in Codex and Claude.” Use this skill.
- Borderline: “My two Linear MCP names both show the same workspace.” Use this skill to diagnose isolation before changing data.
- Negative: “Create an issue in a repo that already exposes only its verified Linear workspace.” Use the normal Linear skill.
- Tempting but wrong: “Add Dock411 to Linear too.” First confirm its tracker. If it uses Jira, route it to Jira instead.
