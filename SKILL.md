---
name: linear-multi-workspace-setup
description: Configure, authenticate, verify, troubleshoot, and safely route multiple Linear workspaces in Codex or Claude Code using separately named MCP connections. Use when a user needs AI agents to access more than one Linear workspace, reports that Linear keeps switching workspaces, wants separate Linear connections for different companies or projects, or needs to audit existing multi-workspace Linear MCP authentication. Do not use for normal issue work in one already-verified workspace.
---

# Linear Multi-Workspace Setup

Set up one named MCP connection per Linear workspace. Treat the verification protocol as the core result. A list of server names is not proof of isolated authentication.

Never read, print, copy, move, or edit OAuth credentials.

## 1. Discover

1. Identify whether the user is configuring Codex, Claude Code, or both.
2. Detect local clients with `command -v codex` and `command -v claude` when needed.
3. Inspect only active MCP configuration through each client's native MCP commands. Do not search credential stores or unrelated config files.
4. Ask the user to map each work area to its tracker and expected Linear workspace or team.
5. Keep non-Linear systems in the map. Do not create a Linear connection for them.
6. Detect hosted ChatGPT when the user has no local client or says they are using ChatGPT web. Explain the hosted limitation from [troubleshooting](references/troubleshooting.md). Do not claim local named servers affect ChatGPT web.

Read [Codex setup](references/codex.md) for Codex. Read [Claude Code setup](references/claude-code.md) for Claude Code. Read both only when configuring both clients.

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

1. Call `get_workspace` on the new server and record its immutable workspace ID, name, and URL.
2. Call `list_teams` on the same server and record the returned teams.
3. Compare the actual workspace and teams with the plan. A team name alone is not a workspace identity.
4. Re-run both read-only checks on every server already connected in this client.
5. Confirm every server still returns its original workspace ID.
6. Confirm no two intended workspace connections return the same workspace ID.
7. Stop before writes if any result changed, is missing, or does not match the plan. Follow [troubleshooting](references/troubleshooting.md).

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

## Examples

- Use this skill: “Set up three separate Linear companies in Codex and Claude.”
- Use this skill: “Both Linear MCP names now open the same workspace.” Audit before changing anything.
- Do not use this skill: “Create an issue in our only Linear workspace.” Use the normal Linear workflow.
- Do not overbuild: “Dock411 uses Jira, but add it to Linear too.” Keep Dock411 routed to Jira.
