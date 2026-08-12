# Manual OAuth acceptance

Run this test separately from automated evals. It requires a person to approve real OAuth screens.

Tested release scope: macOS with current Codex and Claude Code. Other MCP clients may work but are unverified.

## Test map

Prepare at least two Linear workspaces with known workspace names and IDs. Add any non-Linear work area to confirm tracker exclusion.

## Acceptance sequence

- [ ] Inspect only active MCP configuration through native client commands.
- [ ] Show and confirm the proposed workspace and tracker map.
- [ ] Add the first named Linear connection.
- [ ] Tell the tester which workspace to choose.
- [ ] Let the tester complete OAuth in the browser.
- [ ] Verify the first connection with `get_workspace` and `list_teams` in a fresh process.
- [ ] Record the immutable workspace ID without recording credentials.
- [ ] Add and authorize the second named connection.
- [ ] Re-test both connections in a fresh process.
- [ ] Confirm the first workspace ID did not change.
- [ ] Confirm the two server names return distinct expected workspace IDs.
- [ ] Confirm writes require approval where supported.
- [ ] Confirm durable routing guidance names every Linear and non-Linear route.
- [ ] Restart the client and repeat the read-only checks.

## Failure conditions

Fail acceptance if any OAuth token or credential content appears, a write occurs, a non-Linear work area receives a Linear connection, a workspace ID changes, two intended connections share one ID, or the report claims proof when only team names are available.

Do not tag a release based only on this machine's previous authentication. Run the sequence with a clean client profile or a disposable operating-system user.
