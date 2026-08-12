# Generic MCP guidance

Use this reference only for a local MCP client other than Codex or Claude Code.

Compatibility is unverified. Do not claim support merely because the client can add an MCP URL.

## Required client capabilities

Confirm that the client can:

- Create several named connections to the same Streamable HTTP endpoint.
- Keep a separate OAuth context for each connection.
- Address tools through an exact server namespace.
- Require approval for write tools or disable them during setup.
- Start a fresh process or session for verification.
- Store durable routing guidance.

If any capability is missing, explain the limitation before changing configuration.

## Procedure

1. Read the client's current official MCP documentation.
2. Inspect active MCP connections through the client's supported interface. Do not inspect credentials or backups.
3. Add one named connection to `https://mcp.linear.app/mcp`.
4. Tell the user which workspace to authorize and pause for consent.
5. Call `get_workspace` when available and record its stable workspace ID.
6. If only `list_teams` is available, record the complete list, require user confirmation, and mark identity and isolation as unverified.
7. After each later login, re-test every earlier connection through its exact namespace.
8. Stop before writes on a mismatch, duplicate ID, or changed identity.

If the client collapses credentials by endpoint, use Linear's documented `mcp-remote` approach with one unique `MCP_REMOTE_CONFIG_DIR` per workspace when the client supports stdio servers and per-server environment variables.

Report the client as “other MCP client — unverified,” even when the setup appears to work.
