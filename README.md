# Linear Multi-Workspace Setup

[![skills.sh](https://skills.sh/b/switmer/linear-multi-workspace-setup)](https://skills.sh/switmer/linear-multi-workspace-setup)

Stop switching Linear logins when your agents move between workspaces.

This open Agent Skill helps Codex and Claude Code connect to several Linear workspaces without silently sharing or replacing authentication.

It guides Codex or Claude Code through a safe setup:

1. Map each work area to Linear, Jira, or another tracker.
2. Create one named MCP connection per Linear workspace.
3. Pause for user-controlled OAuth.
4. Verify each connection through its exact namespace.
5. Recheck earlier connections after every new login.
6. Require approval before Linear writes.
7. Scope each Codex repo to only its intended Linear connection.
8. Install clear workspace-routing guidance.

Each sign-in request carries a `workspace=<alias>` marker through `mcp-remote`, and the router opens a page that names the workspace before Linear's own page. The marker and the page help you match a sign-in to its connection; you still select the workspace on Linear's page.

## Install

[View the skill on skills.sh](https://www.skills.sh/switmer/linear-multi-workspace-setup/linear-multi-workspace-setup)

```bash
npx skills add switmer/linear-multi-workspace-setup \
  --skill linear-multi-workspace-setup
```

This copies the whole repository into your agent's skills folder, including the [`router/`](router/README.md) command-line tool. It needs Node.js 20 or newer to run. Find it next to the installed `SKILL.md`, at `router/bin/linear-workspace-router.mjs`. The skill tells your agent where to look, so you do not need the path yourself.

## Recommended setup path: the bundled router

The agent uses the `router/` tool for setup, checks, and repo scoping. It is not published to npm; it ships inside this repository. It:

- runs every server through a wrapper that opens one labeled sign-in page, showing the workspace name, instead of a raw Linear tab;
- leaves a working connection alone, and never removes a Claude Code server before replacing it;
- reuses an existing server name for the same login folder, so a re-run adds no duplicate;
- saves each confirmed workspace ID in a local file (`pins.json`, no tokens, ignored by Git) and compares IDs on later checks, so a changed display name passes and a different workspace fails;
- avoids unneeded sign-ins: a healthy saved login reconnects without a browser.

Naming: a server is named `linear-<alias>`, except the alias `roster`, which is named `linear-onroster` in both clients. Its saved login stays in `~/.mcp-auth/linear-roster`. The server name is only a label; the login folder holds the login.

The manual steps in the skill and in the [Codex](references/codex.md) and [Claude Code](references/claude-code.md) guides are a fallback for when Node.js is unavailable or you use another client.

If you know which workspaces you want, ask:

> Set up my Roster, HopperX, and personal Linear workspaces. Dock411 uses Jira.

If you are unsure, ask:

> Help me set up the Linear workspaces I want to use in Codex. I do not know the full list, so help me discover them one at a time.

The agent will show a proposed map before changing anything. It will then guide you through each OAuth screen and report which connections are verified, failed, or still unverified.

## How workspace discovery works

The skill does not claim it can list every Linear workspace your account can access before OAuth. It discovers which workspaces you want the agent to use.

- If you know the list, name each work area, tracker, and Linear workspace.
- If you are unsure, the skill asks you to check Linear's workspace switcher and choose only the workspaces you want connected.
- If you still do not have a full list, the skill plans, authenticates, and verifies one workspace at a time. After each one, it asks whether you want to add another.

Existing MCP connections and team names never decide the workspace count. You confirm each planned connection and the final routing map.

## Why verification matters

Different MCP server names do not prove separate authentication. After each login, the skill rechecks every previous connection.

When Linear exposes `get_workspace`, the skill records its immutable workspace ID. If only team names are available, it requires user confirmation and marks workspace identity and credential isolation as unverified.

## Repo-level guards

Global named connections make each workspace available to Codex, but most repos need only one. For a confirmed repo-to-workspace route, the skill can add a small `.codex/config.toml` override that enables the intended Linear server and disables the others.

Before writing overrides, it requires complete server definitions for every referenced connection, including disabled ones. For Codex, replacement must keep config valid throughout and restore the prior config after failure. It checks all installed `linear@…` plugin IDs, including the remote variant, rather than trusting config flags alone.

It then checks the loaded MCP and plugin state from that repo and verifies the workspace identity in a fresh process. The check fails if the project is untrusted, another Linear connection remains exposed, or the workspace does not match. Existing panes must be restarted after the config changes.

## Safety

- OAuth consent stays with the user.
- The skill never inspects, copies, prints, or modifies credential storage.
- Setup uses read-only checks and stops before writes on an identity mismatch.
- Work areas using Jira or another tracker do not receive Linear connections.
- A bundled Linear connector is changed only with user approval and must be checked from a fresh process.

## Known limitations

- The sign-in page can keep a working button for a request whose process has exited, when a new process takes over the same local port within a fraction of a second. Use the newest page. Not fixed yet; see the [router README](router/README.md#known-limitation-a-page-can-look-live-after-a-quick-takeover).
- Linear's own consent page does not show the workspace. Pick it by name there.
- Claude Code has no overwrite command. If verification fails after the router writes a Claude entry, the new entry stays and a timestamped backup of `~/.claude.json` holds the previous config. Codex configs are restored automatically.
- Config recovery never undoes a sign-in or a workspace choice made in the browser.
- The router is not on npm, so there is no `npx linear-workspace-router`. Run it with `node` from the installed skill folder or a clone.

## Support

macOS tested. Codex and Claude Code supported. Other MCP clients may work but are unverified.

Local named MCP connections do not change the hosted ChatGPT Linear plugin.

[Report a bug or confusing behavior](https://github.com/switmer/linear-multi-workspace-setup/issues/new).

## Documentation

- [Canonical Agent Skill](SKILL.md)
- [Router CLI](router/README.md)
- [Codex setup](references/codex.md)
- [Claude Code setup](references/claude-code.md)
- [Generic MCP guidance](references/generic-mcp.md)
- [Troubleshooting](references/troubleshooting.md)
- [Initial eval suite](evals/evals.json)
- [Manual OAuth acceptance](evals/manual-acceptance.md)

## License

[MIT](LICENSE)
