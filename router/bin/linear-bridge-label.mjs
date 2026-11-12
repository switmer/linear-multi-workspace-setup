#!/usr/bin/env node
// Runs the pinned mcp-remote bridge exactly as before, with one change: a small
// `open` shim is put first on PATH for this process only. When mcp-remote opens
// the Linear sign-in URL, the shim opens a labeled launcher page instead.
// Usage (same args as mcp-remote): node linear-bridge-label.mjs <url> [--authorize-param workspace=NAME ...]
// stdin/stdout/stderr are inherited untouched (MCP stdio).
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MCP_REMOTE_VERSION, displayNameFor, readPins } from "../src/core.mjs";

const args = process.argv.slice(2);
const workspaceArg = args.find((a, i) => args[i - 1] === "--authorize-param" && a.startsWith("workspace="));
const alias = workspaceArg ? workspaceArg.slice("workspace=".length) : "unknown";
// Show the confirmed workspace name when one is saved. A missing or unreadable pins file just means no name.
const displayName = displayNameFor(alias, await readPins().catch(() => ({})));
const shimDir = join(dirname(fileURLToPath(import.meta.url)), "shim");

const child = spawn("npx", ["-y", MCP_REMOTE_VERSION, ...args], {
  stdio: "inherit",
  env: { ...process.env, PATH: `${shimDir}:${process.env.PATH ?? ""}`, LINEAR_BRIDGE_ALIAS: alias, LINEAR_BRIDGE_DISPLAY: displayName ?? "" },
});

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
child.on("error", (err) => {
  process.stderr.write(`linear-bridge-label: could not start npx: ${err.message}\n`);
  process.exit(1);
});
