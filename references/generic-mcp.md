# Generic MCP guidance

Use this reference only for a local MCP client other than Codex or Claude Code. Other clients may work but are unverified.

- Create one named connection per Linear workspace.
- Give each connection a separate authentication context.
- Authenticate connections sequentially with user-controlled OAuth.
- Call `get_workspace` when available and record its immutable workspace ID, name, and URL. If unavailable, record the complete team list, require user confirmation, and mark workspace identity and credential isolation as unverified. Never treat team names alone as proof.
- Recheck every connection after each later login.
- Require approval before writes or disable write tools during setup.
- If credentials collapse, use Linear's documented `mcp-remote` fallback with a separate `MCP_REMOTE_CONFIG_DIR` path for each connection.
- Read the client's current documentation for configuration commands and durable instruction-file locations.

Report the client as unverified even when the setup appears to work.
