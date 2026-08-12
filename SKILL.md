---
name: linear-multi-workspace-setup
description: Use this skill when a user wants to connect, configure, audit, troubleshoot, or safely route an AI agent across multiple Linear workspaces, including when OAuth keeps switching workspaces, one connector sees only one team, or separate companies need isolated Linear access. Configure named per-workspace MCP connections, require approval for writes, verify every workspace through its own connection, and prove credentials remain isolated. Do not use for routine Linear issue or project management within one already-connected workspace.
---

# Linear Multi-Workspace Setup

Set up one named MCP connection per Linear workspace. Treat the verification protocol as the core result. A list of server names is not proof of isolated authentication.

Never read, print, copy, move, or edit OAuth credentials.

Compatibility: macOS tested. Codex and Claude Code supported. Other MCP clients may work but are unverified.

## 1. Discover

1. Identify whether the user is configuring Codex, Claude Code, or both.
2. Detect local clients with `command -v codex` and `command -v claude` when needed.
3. Inspect only active MCP configuration through each client's native MCP commands. Do not search credential stores or unrelated config files.
4. Ask the user to map each work area to its tracker and expected Linear workspace or team.
5. Keep non-Linear systems in the map. Do not create a Linear connection for them.
6. Detect hosted ChatGPT when the user has no local client or says they are using ChatGPT web. Explain the hosted limitation from [troubleshooting](references/troubleshooting.md). Do not claim local named servers affect ChatGPT web.

Read [Codex setup](references/codex.md) for Codex. Read [Claude Code setup](references/claude-code.md) for Claude Code. Read both only when configuring both clients. For another local MCP client, read [generic MCP guidance](references/generic-mcp.md) and describe the result as unverified compatibility.

## 2. Plan

Show the full plan before making changes:

| Work area | System | MCP name | Expected workspace/team |
| --- | --- | --- | --- |
| Example area | Linear | `linear-example` | Example Workspace |
| Other area | Jira | None | None |

Use lowercase `linear-<alias>` names. Resolve duplicate or unclear aliases before continuing. Ask for confirmation of the plan.

## 3. Configure and authenticate

Work on one client and one workspace at a time.

1. Add only the planned named server.
2. For Codex, set `default_tools_approval_mode = "writes"` only in that named server's config block.
3. Tell the user which Linear workspace to select.
4. Start that server's OAuth flow separately and pause for human consent.
5. If the selected workspace is wrong, cancel or log out only that named server. Do not continue.
6. Do not alter unrelated MCP servers or bundled plugins.

OAuth cannot be completed silently. The user must approve each workspace in the browser.

## 4. Verify after every login

Use a fresh agent process when possible. Address each named server through its exact namespace.

1. Call `get_workspace` when available. Record its immutable workspace ID, name, and URL.
2. If `get_workspace` is unavailable, call `list_teams`, record the complete team list, require user confirmation, and mark workspace identity and credential isolation as unverified. Never treat team names alone as proof.
3. When `get_workspace` succeeds, also call `list_teams` and record the returned teams.
4. Compare the actual workspace and teams with the plan.
5. Re-run the available read-only checks on every server already connected in this client.
6. When stable IDs are available, confirm every server still returns its original workspace ID and no two intended connections return the same ID.
7. Stop before writes if any identity changed, is duplicated, is missing, or does not match the plan. Follow [troubleshooting](references/troubleshooting.md).

Repeat the complete sequence for the second client when configuring both. Authentication in one client does not prove authentication in the other.

## 5. Install routing guidance

Add a small marked section to the client's durable user instructions. Preserve all existing content.

```text
Linear routing:

- <work area> → <named Linear server>
- <non-Linear work area> → <correct tracker>, never Linear

For reads, use the mapped workspace.
For writes, never infer across ambiguous work areas.
Never use the bundled Linear plugin when an appropriate named Linear server is available.
```

Use `~/.codex/AGENTS.md` for Codex and `~/.claude/CLAUDE.md` for Claude Code unless the user has a different active instruction file. Do not replace either file.

## 6. Report

Return one row per client and server:

| Client | Server name | Actual workspace | Teams | Auth status | Write approval | Isolation | Routing installed |
| --- | --- | --- | --- | --- | --- | --- | --- |

List non-Linear routes below the table. State any limitation or unverified item clearly. Never report setup as complete until the fresh-process isolation check passes.

## Gotchas

- One browser account may see many Linear workspaces while one MCP OAuth context represents only one.
- Different server names do not prove separate credentials. Re-test every earlier connection after each new login.
- Team names are mutable and may not be unique. Only a stable workspace ID can prove workspace identity.
- A bundled Linear connector may conflict with named direct connections. Prefer the mapped named server without changing the bundle unless asked.
- ChatGPT web does not load local Codex MCP configuration.
- OAuth consent belongs to the user. Never automate, inspect, or copy it.
- Not every business uses Linear. Keep Jira and other trackers out of the Linear connection list.
- `MCP_REMOTE_CONFIG_DIR` is Linear's documented fallback for separate authentication contexts. This skill may instruct the client setup; it does not implement or own that fallback.
- When a user authorizes the wrong workspace or two names resolve to one ID, stop before writes. Do not continue and repair later.

## Examples

- Use this skill: “Set up three separate Linear companies in Codex and Claude.”
- Use this skill: “Both Linear MCP names now open the same workspace.” Audit before changing anything.
- Do not use this skill: “Create an issue in our only Linear workspace.” Use the normal Linear workflow.
- Do not overbuild: “Dock411 uses Jira, but add it to Linear too.” Keep Dock411 routed to Jira.
