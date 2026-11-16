# Linear Workspace Router

Set up several Linear workspaces for Codex and Claude Code without one sign-in replacing another.

This is the recommended setup path for the `linear-multi-workspace-setup` skill. It is a small Node.js command-line tool with no dependencies. It is not published to npm; it ships inside this repository.

## Where the command lives

- In a clone of this repository: `router/bin/linear-workspace-router.mjs`.
- After `npx skills add`: the whole repository is copied into the installed skill, so it is `<installed skill folder>/router/bin/linear-workspace-router.mjs`.

The examples below write `router/bin/...`. Run them from the repository root, or replace that prefix with the installed skill folder. Node.js 20 or newer is required.

```bash
node router/bin/linear-workspace-router.mjs --dry-run --client both \
  --workspace roster="Roster App" \
  --workspace hopperx=HopperAI
```

A dry run changes nothing and signs in nowhere. The CLI adds one named MCP server per workspace. After every login, it opens a fresh agent process and reads the workspace identity through every connection configured so far. Setup stops if one login changes another connection.

## What it changes

- Adds named Linear servers to Codex, Claude Code, or both. Each one runs the pinned `mcp-remote` through a small wrapper (see [Sign-in page](#sign-in-page)).
- Gives each workspace its own login folder and a `workspace=<alias>` marker on the sign-in request.
- Sets Codex MCP write tools to require approval.
- Adds a marked workspace-routing block to global agent instructions.
- Installs the short `linear-workspace-router` skill when you run `install-skill` (see [Install the short skill](#install-the-short-skill)).
- Adds a repo-local Codex guard that enables one named Linear server and disables the others.
- Lets `mcp-remote` store each workspace's login in its own folder.

It does not read, copy, store, or print login tokens.

## Server names and login folders

The server name is the label the client shows. The login folder is where `mcp-remote` keeps that workspace's saved login.

- The login folder is always `~/.mcp-auth/linear-<alias>`.
- The server name is `linear-<alias>`, with one built-in exception: the alias `roster` is named `linear-onroster` in both clients. Its login folder is still `~/.mcp-auth/linear-roster`, and its marker is still `workspace=roster`.
- An optional `names.json` next to the CLI changes a name or names another alias, for example `{ "hopperx": "linear-hx" }`.
- If a client already has an entry that uses a workspace's login folder, the CLI reuses that entry's name. It never adds a second entry for the same login.

Renaming a server does not move its login. Keep the same `MCP_REMOTE_CONFIG_DIR` and the same `mcp-remote` arguments, and no new sign-in is needed.

## Saved workspace IDs

After a check or setup confirms a workspace through its named server, the CLI saves the alias, name, ID, and URL in `pins.json` next to the CLI. It holds no tokens, and Git ignores it.

- Later `check` and `scope` runs read the saved ID, so `--workspace roster` works without typing the name.
- The ID is what counts. If Linear shows a new display name for the same ID, the check passes and the saved name updates.
- If the live ID differs from the saved one, the check fails and shows both IDs. The saved pin is never overwritten by a different ID.
- With no saved pin and no name on the command line, the CLI stops and asks for `alias=expected-workspace`.
- Edit `pins.json` by hand only if you really mean to point an alias at a different workspace.

## Commands

Interactive setup, or non-interactive with names:

```bash
node router/bin/linear-workspace-router.mjs --client both \
  --workspace roster="Roster App" \
  --workspace hopperx=HopperAI \
  --workspace personal="My Personal Workspace"
```

`check` is a real, read-only isolation test. A dry run never claims credentials were verified.

```bash
node router/bin/linear-workspace-router.mjs check --client codex \
  --workspace roster --workspace hopperx
```

Scope a Codex repo. Run this from the repo, or pass `--repo /path/to/repo`, once per repo with that repo's intended workspace:

```bash
node router/bin/linear-workspace-router.mjs scope --client codex \
  --workspace roster
```

`scope` preserves unrelated project config and writes `.codex/config.toml`, where each Linear server is only turned on or off. It does not copy server commands into the project. It disables the other named Linear servers there. The selected server is required and gets 120 seconds to start. A fresh Codex process then checks the loaded MCP and plugin state and verifies the workspace identity. The repo must be trusted or the check fails.

`--model <name>` picks the model for the verification run (`codex exec -m` or `claude --model`). Use it when the client's default model is not allowed for your account. Without it, the client's own setting is used.

### Install the short skill

`install-skill` copies the short `linear-workspace-router` skill into the client's skill folder, with this CLI's real path filled in. It writes into `~/.claude/skills` and/or `~/.codex/skills`, so run it only when you want that.

```bash
node router/bin/linear-workspace-router.mjs install-skill --client both
```

## Keeping working connections

- A server that already uses the wrapper and the right login folder is left alone and only verified. The CLI never rewrites it with a plain `npx` command and keeps its `enabled` setting.
- An older plain-`npx` Codex entry for the same workspace moves to the wrapper. Its arguments and login folder stay the same, so it signs in again only if its saved login is missing or cannot refresh.
- Changing a direct HTTP connection to a bridge is a different login and needs one new sign-in. Adding `--authorize-param` to an existing bridge also counts as a new sign-in identity.
- Re-running setup adds no second entry in either client.

## Safe replacement and recovery

- **Codex.** The CLI writes the complete replacement connection through a temporary file and an atomic rename, with write approval settings, disabled globally by default. It enables the named connections only in the verification process. If verification or workspace confirmation fails, it restores the previous config, unless another process changed it.
- **Claude Code.** It never runs `claude mcp remove`. A new server is added with `claude mcp add-json`. Claude Code has no overwrite command, so an existing entry is replaced by editing only that one entry in `~/.claude.json`: a timestamped backup (`~/.claude.json.router-backup-*`), a check that the file did not change meanwhile, then one atomic rename. A failed write leaves the old entry and the file unchanged. Error messages never print a server definition, because its environment can hold credentials.
- **Limits.**
  - Claude Code can write that file at any time. The changed-file check catches most races but is not a lock.
  - If verification fails after a successful Claude write, the new entry stays and the backup holds the previous config. Restore it yourself if you want the old entry back.
  - Config rollback never undoes a sign-in or a workspace choice made in the browser.
- Do not repeat login or setup to repair a config parse error. Inspect the config and use read-only checks first.

## Sign-in page

Every named server runs `bin/linear-bridge-label.mjs`. It starts the pinned `mcp-remote` and puts a small `open` shim first on that process's PATH. When Linear needs a sign-in, the shim opens one static page instead of Linear's raw address.

- The page shows the workspace name saved in `pins.json` and tells you to pick it on Linear's page. With no saved name, it asks you to choose the workspace you intended for the alias. The heading names no client.
- The button "Continue to Linear for <workspace>" goes to that request's exact address, in the same tab.
- The page shows when it was opened and turns grey with "This request has ended" when the process that asked for it stops.
- Linear's own consent page does not show the workspace, so you still pick it there by name.

The login folder is the same as for the plain `mcp-remote` command, so existing logins keep working.

### Known limitation: a page can look live after a quick takeover

The page checks every 3 seconds whether anything answers on the request's local port. `mcp-remote` lets one process own a sign-in at a time; when that process exits, a waiting process takes over the same port within a fraction of a second. If that happens between two checks, the old page never sees a gap and keeps its working button, even though its request belonged to the process that exited.

- Tested with stand-in servers, not real bridges. With a gap of several seconds, the page ended and stayed ended after a new server took the port (one trial). With a gap of about 0.3 second, the page stayed live in two of three trials.
- Whether approving such an old page still completes the sign-in is not tested. `mcp-remote` stores each request's verifier by its own state value and says a takeover process can redeem it, but that is unverified here.
- Use the page with the newest "Opened" time and close older ones. Sign in once from one process that stays running until the saved login appears.
- This is not fixed in this release.

## Permission, sign-in, and config problems are different

- **Permission.** A tool call is refused or waits for approval. Codex write tools ask for approval by design (`default_tools_approval_mode = "writes"`). Claude Code in `-p` mode with `--permission-mode dontAsk` refuses any tool not in `--allowedTools`. Fix the allow list or approve the call. Do not sign in again.
- **Sign-in.** The server reports it needs authentication, or opens the sign-in page. Sign in once, from one process.
- **Config.** The client cannot parse its config, or a server has no command. Repair the definition without changing arguments or login folders. No sign-in is needed.
- **Verification model.** The client rejects its default model for your account. Pass `--model`. This is not a sign-in or config problem.

A server only opens a sign-in page when its saved login is missing or cannot refresh. In testing, an expired access token with a refresh token reconnected without any browser tab. A dry run and `check` on healthy servers did not open one.

## Requirements

- Node.js 20 or newer.
- Codex and/or Claude Code installed and signed in, plus `node` and `npx` (the wrapper runs the pinned `mcp-remote`).
- Access to each Linear workspace.

Interactive setup can discover the workspace name and URL after the first sign-in, then asks you to confirm them. Non-interactive setup requires the expected workspace name unless a saved pin exists. The verification process uses each installed agent client, so it may count against that client's normal model usage.

## Safety model

The CLI uses Linear sign-in through `mcp-remote`. It adds and verifies workspaces in sequence. If a connection returns the wrong workspace, setup exits with code `3` and does not continue.

Repo scoping also stops if another Linear server or the bundled Linear plugin remains exposed. Restart existing Codex panes after scoping because they keep their startup tool list.

Codex servers receive `default_tools_approval_mode = "writes"`. Claude routing guidance tells agents to keep Linear write tools outside automatic permission allowlists.

The plugin guard checks every installed `linear@…` plugin. An enabled plugin or unreadable plugin state fails verification, including the standalone `check` command. Account-managed remote plugins ignore `config.toml`. If one still reports enabled, remove it with `codex plugin remove linear@openai-curated-remote` (or turn it off in `/plugins`) before Linear writes.

## Development

```bash
npm test
npm run check
npm pack --dry-run
```
