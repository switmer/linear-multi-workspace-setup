# Linear Workspace Router

Set up multiple isolated Linear workspaces for Codex and Claude Code.

```bash
node router/bin/linear-workspace-router.mjs
```

This package is local. It has not been published to npm or skills.sh.

The CLI adds one named MCP server per workspace. After every OAuth login, it opens a fresh agent process and reads the workspace identity through every connection configured so far. Setup stops if one login changes another connection.

It can also scope a Codex repo so workers see only the Linear workspace that belongs to that repo.

## What it changes

- Adds named `mcp-remote` Linear servers to Codex, Claude Code, or both.
- Gives each workspace a separate credential folder and a visible `workspace=<alias>` OAuth URL marker. The marker helps identify the browser window; Linear still asks you to select the workspace.
- Sets Codex MCP write tools to require approval.
- Adds a marked workspace-routing block to global agent instructions.
- Installs the bundled `linear-workspace-router` skill.
- Adds a repo-local Codex guard that enables one named Linear server and disables the others.
- Disables the bundled Linear plugin when direct named servers are in use.
- Lets `mcp-remote` store each workspace's OAuth credentials in its own folder.

It does not read, copy, store, or print OAuth tokens.

## Non-interactive setup

```bash
node router/bin/linear-workspace-router.mjs --client both \
  --workspace roster="Roster App" \
  --workspace hopperx=HopperAI \
  --workspace personal="My Personal Workspace"
```

Use `--dry-run` to preview commands and file targets. A dry run never claims that credentials were verified. Use `check` for a real, read-only isolation test:

```bash
node router/bin/linear-workspace-router.mjs check --client codex \
  --workspace roster="Roster App" \
  --workspace hopperx=HopperX
```

## Scope a Codex repo

Run this from the repo, or pass `--repo /path/to/repo`:

```bash
node router/bin/linear-workspace-router.mjs scope --client codex \
  --workspace roster="Roster App"
```

Run it once per repo with that repo's intended workspace. The command preserves unrelated project config, writes `.codex/config.toml`, disables other named Linear servers there, and disables both `linear@openai-curated` and `linear@openai-curated-remote` in the user config. The selected server is required and gets 120 seconds to start. A fresh Codex process then checks the loaded MCP and plugin state and verifies the workspace identity. The repo must be trusted or the check fails.

## Requirements

- Node.js 20 or newer.
- Codex and/or Claude Code installed and signed in, plus `node` and `npx` (the labeled wrapper runs the pinned `mcp-remote`).
- Access to each Linear workspace.

Interactive setup can discover the workspace name and URL after OAuth, then asks you to confirm them. Non-interactive setup requires the expected workspace name. The verification process uses each installed agent client, so it may count against that client’s normal model usage.

## Safety model

The CLI uses Linear OAuth through `mcp-remote`. It adds and verifies workspaces in sequence. Changing an existing direct connection to the labeled bridge requires one new OAuth login. If a connection returns the wrong workspace, setup exits with code `3` and does not continue.

Repo scoping also stops if another Linear server or the bundled Linear plugin remains exposed. Restart existing Codex panes after scoping because they keep their startup tool list.

Codex servers receive `default_tools_approval_mode = "writes"`. Claude routing guidance tells agents to keep Linear write tools outside automatic permission allowlists.

## Development

```bash
npm test
npm run check
npm pack --dry-run
```

Codex setup writes the complete replacement connection atomically, with write approval settings and disabled globally by default. It enables the named connections only in the verification process. Failed verification restores the previous config unless another process changed it. This does not restore credentials changed by OAuth. Do not repeat login/setup to repair config parsing. Use read-only checks first.

The plugin guard checks every installed `linear@…` plugin. An enabled plugin or unreadable plugin state fails verification, including the standalone `check` command. If a plugin remains enabled despite config overrides, remove it with `codex plugin remove linear@openai-curated-remote` (or turn it off in `/plugins`) before Linear writes. Account-managed remote plugins ignore `config.toml`, so removal is the reliable fix.

## Sign-in page

Every named server runs `bin/linear-bridge-label.mjs`, which starts the pinned `mcp-remote` and puts a small `open` shim first on its PATH. When Linear needs a sign-in, the shim opens one static page named for the workspace, with a "Continue to Linear for <WORKSPACE>" button, instead of Linear's raw URL. The page turns grey and says the request has ended when the process that asked for it stops. Linear's own consent page does not show the workspace, so you still pick it there by name.

The saved login folder is `~/.mcp-auth/linear-<alias>`, the same as the plain `mcp-remote` command, so existing logins keep working.

## Local state (never committed)

Two optional files sit next to the CLI and are ignored by Git:

- `pins.json`: written after a check or setup confirms a workspace (alias, name, ID, URL; no tokens). Later runs compare the saved ID, so a display-name change passes and a different ID fails with both IDs shown. The saved pin is never overwritten by a different ID.
- `names.json`: optional, to override a server name or name another alias, for example `{ "hopperx": "linear-hx" }`. Without it the name is `linear-<alias>`, except `roster`, which defaults to `linear-onroster` in every client. The login folder always stays `linear-<alias>`. If a client already holds that login folder under another name, the CLI reuses that name rather than adding a second entry.

## Verification model

`--model <name>` picks the model for the verification run (`codex exec -m` or `claude --model`). Use it when the client's default model is not allowed for your account. Without it the client's own setting is used.

## Plugin guard

If the bundled `linear@…` plugin still reports enabled, remove it with `codex plugin remove linear@openai-curated-remote`. Account-managed remote plugins ignore `config.toml`.
