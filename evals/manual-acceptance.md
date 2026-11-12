# Manual OAuth acceptance

Run this test separately from automated evals. It requires a person to approve real OAuth screens.

Tested release scope: macOS with current Codex and Claude Code. Other MCP clients may work but are unverified.

## Test map

Prepare at least two Linear workspaces with known workspace names and IDs. Add any non-Linear work area to confirm tracker exclusion.

## Acceptance sequence

- [ ] Inspect only active MCP configuration through native client commands.
- [ ] Show and confirm the proposed workspace and tracker map.
- [ ] Add the first named Linear connection.
- [ ] For an `mcp-remote` connection, confirm its OAuth URL contains the correct `workspace=<alias>` marker. Confirm the marker did not choose a workspace automatically.
- [ ] Tell the tester which workspace to choose.
- [ ] Let the tester complete OAuth in the browser.
- [ ] Verify the first connection with `get_workspace` and `list_teams` in a fresh process.
- [ ] Record the immutable workspace ID without recording credentials.
- [ ] Add and authorize the second named connection.
- [ ] Re-test both connections in a fresh process.
- [ ] Confirm the first workspace ID did not change.
- [ ] Confirm the two server names return distinct expected workspace IDs.
- [ ] Confirm the two bridges use separate credential directories and automatic callback ports. Do not inspect credential contents.
- [ ] From each Claude repo in scope, confirm no old local or project direct Linear server can open an unlabeled OAuth URL, and no stale Linear write-tool allowlist rule remains.
- [ ] Confirm writes require approval where supported.
- [ ] In a trusted Codex test repo, add project overrides that enable one intended named server and disable the others.
- [ ] Disable named Linear servers in the Codex user config and confirm an unscoped directory starts none of them.
- [ ] With approval, disable the bundled Linear plugin at user scope when named direct servers are the chosen route.
- [ ] From the repo, confirm `codex mcp list` exposes only the intended named Linear server.
- [ ] Confirm the selected repo server has `required = true` and a longer startup timeout, and that a failed handshake is shown as a startup failure.
- [ ] From the repo, confirm `codex plugin list --json` reports the bundled Linear plugin disabled or absent.
- [ ] From a fresh process in the repo, confirm the intended server still returns the expected workspace ID and name.
- [ ] Restart an existing pane and confirm it loads the scoped connector set.
- [ ] Confirm durable routing guidance names every Linear and non-Linear route.
- [ ] Restart the client and repeat the read-only checks.
- [ ] Start several fresh agent panes after verification and confirm they do not open new OAuth tabs.

## Failure conditions

Fail acceptance if any OAuth token or credential content appears, a write occurs, a non-Linear work area receives a Linear connection, a workspace ID changes, two intended connections share one ID, an extra Linear connection remains exposed in the scoped repo, or the report claims proof when only team names are available.

Do not tag a release based only on this machine's previous authentication. Run the sequence with a clean client profile or a disposable operating-system user.

## Config replacement and plugin checks

Use disposable Codex config directories and repos. Do not use real OAuth credentials for these config cases.

- Missing transport: give a repo an `enabled = false` override for a global server that does not exist. Confirm discovery fails and the procedure repairs the confirmed definition before writing new overrides. No login should run.
- Replacement: give a global stdio server a complete definition and write approval, with a project override that enables it. Replace the full definition atomically. Confirm both unscoped and repo commands always parse, global startup stays disabled, and a temporary process can enable it. Force verification to fail and confirm the prior config returns exactly. Repeat with a concurrent edit; confirm rollback leaves that edit intact and reports the conflict.
- Current plugin: supply an installed-state fixture with the old Linear ID disabled and the remote ID enabled. The result must fail the plugin check. Config flags and correct workspace identity must not override it.
- Unknown plugin state: supply a failed command or unknown JSON shape. Report plugin state as unverified and stop writes.

These cases test config and reporting only. They do not prove OAuth isolation or count as completed manual acceptance until run and recorded.

## Router CLI checks

- [ ] Re-running setup keeps the labeled wrapper command and adds no second entry for a login folder a client already uses.
- [ ] A failed Claude Code replace leaves the old entry in place.
- [ ] A saved workspace ID mismatch fails with both IDs and leaves the saved pin unchanged; a display-name change with the same ID passes.
- [ ] `check --model <name>` runs verification with that model; without it the client's own setting is used.
- [ ] `pins.json` and `names.json` are not tracked by Git.
