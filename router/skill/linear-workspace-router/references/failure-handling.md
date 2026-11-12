# Failure handling

## OAuth succeeds but the wrong workspace appears

Stop. Do not authenticate another workspace and do not write data.

1. Confirm the user selected the intended Linear workspace.
2. Log out only the failed named server.
3. Authenticate it again.
4. Re-run checks for every named server.

## One login changes another connection

The client is collapsing credentials by endpoint. Stop direct setup.

Use Linear’s documented `mcp-remote` fallback with a unique `MCP_REMOTE_CONFIG_DIR` for each workspace. Do not reuse one directory. Re-run the complete isolation sequence before writes.

## A workspace uses another tracker

Do not add a Linear server. Record the correct route in global instructions, such as `Dock411 → Jira`.
