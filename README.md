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
7. Install clear workspace-routing guidance.

## Install

[View the skill on skills.sh](https://www.skills.sh/switmer/linear-multi-workspace-setup/linear-multi-workspace-setup)

```bash
npx skills add switmer/linear-multi-workspace-setup \
  --skill linear-multi-workspace-setup
```

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

## Safety

- OAuth consent stays with the user.
- The skill never inspects, copies, prints, or modifies credential storage.
- Setup uses read-only checks and stops before writes on an identity mismatch.
- Work areas using Jira or another tracker do not receive Linear connections.
- A bundled Linear connector is not changed unless the user asks.

## Support

macOS tested. Codex and Claude Code supported. Other MCP clients may work but are unverified.

Local named MCP connections do not change the hosted ChatGPT Linear plugin.

[Report a bug or confusing behavior](https://github.com/switmer/linear-multi-workspace-setup/issues/new).

## Documentation

- [Canonical Agent Skill](SKILL.md)
- [Codex setup](references/codex.md)
- [Claude Code setup](references/claude-code.md)
- [Generic MCP guidance](references/generic-mcp.md)
- [Troubleshooting](references/troubleshooting.md)
- [Initial eval suite](evals/evals.json)
- [Manual OAuth acceptance](evals/manual-acceptance.md)

## License

[MIT](LICENSE)
