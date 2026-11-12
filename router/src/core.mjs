import { cp, mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const PINS_PATH = join(PACKAGE_ROOT, "pins.json");
export const NAMES_PATH = join(PACKAGE_ROOT, "names.json");
export const LINEAR_URL = "https://mcp.linear.app/mcp";
export const MCP_REMOTE_VERSION = "mcp-remote@0.15.1";
export const ROUTE_START = "<!-- linear-workspace-router:start -->";
export const ROUTE_END = "<!-- linear-workspace-router:end -->";

// The wrapper runs the pinned mcp-remote and shows a labeled sign-in page. It lives in this package.
export const WRAPPER_PATH = join(PACKAGE_ROOT, "bin", "linear-bridge-label.mjs");

// The login folder always follows the alias. The server name usually does too,
// but a client may already hold the same login under another name (for example linear-onroster).
export function folderName(workspace) {
  return `linear-${workspace.alias}`;
}

// Roster's server is named linear-onroster in every client; its login folder stays linear-roster.
// Other aliases are linear-<alias>. An optional local names.json can override or add a name for any alias.
const DEFAULT_SERVER_NAMES = { roster: "linear-onroster" };

export function serverName(workspace) {
  return workspace.serverName || DEFAULT_SERVER_NAMES[workspace.alias] || folderName(workspace);
}

export function authDir(workspace) {
  return join(homedir(), ".mcp-auth", folderName(workspace));
}

// One bridge definition for every client.
export function bridgeCommand(workspace) {
  return ["node", WRAPPER_PATH, LINEAR_URL, "--authorize-param", `workspace=${workspace.alias}`];
}

export function isCurrentBridge(definition, workspace) {
  const [command, ...args] = bridgeCommand(workspace);
  return Boolean(definition)
    && definition.command === command
    && JSON.stringify(definition.args) === JSON.stringify(args)
    && definition.env?.MCP_REMOTE_CONFIG_DIR === authDir(workspace);
}

export async function readClaudeServers(options = {}) {
  const path = options.claudeConfig || join(homedir(), ".claude.json");
  try {
    return JSON.parse(await readFile(path, "utf8")).mcpServers || {};
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

// Reads command, args, env and enabled for each [mcp_servers.<name>] table.
export function parseCodexServers(text) {
  const servers = {};
  let current = null;
  for (const line of text.split("\n")) {
    const header = line.trim().match(/^\[mcp_servers\.("?[A-Za-z0-9_-]+"?)(\.env)?\]$/);
    if (header) {
      const name = header[1].replace(/"/g, "");
      servers[name] ||= { env: {} };
      current = header[2] ? servers[name].env : servers[name];
      continue;
    }
    if (/^\s*\[/.test(line)) { current = null; continue; }
    const pair = current && line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (!pair) continue;
    try { current[pair[1]] = JSON.parse(pair[2]); } catch { /* not a plain value */ }
  }
  return servers;
}

// Reuse the name a client already uses for this workspace's login folder, so we never add a second entry.
export async function withExistingNames(client, workspaces, options = {}) {
  let servers;
  if (client === "claude") servers = await readClaudeServers(options);
  else {
    const home = options.codexHome || process.env.CODEX_HOME || join(homedir(), ".codex");
    servers = parseCodexServers(await readOptional(join(home, "config.toml")));
  }
  return workspaces.map((workspace) => {
    const found = Object.entries(servers).find(([, server]) => server.env?.MCP_REMOTE_CONFIG_DIR === authDir(workspace));
    return found ? { ...workspace, serverName: found[0] } : workspace;
  });
}

// Claude Code's add-json cannot overwrite an existing name, and removing first would leave the client without
// the server. So a replacement edits only that one mcpServers entry in the user config file, in one atomic
// rename, after a real backup and a check that nothing else changed the file in between.
// Messages never include a server definition: its env can hold credentials.
export async function ensureClaudeServer(workspace, options = {}) {
  const name = serverName(workspace);
  const path = options.claudeConfig || join(homedir(), ".claude.json");
  const raw = await readOptional(path);
  const config = raw ? JSON.parse(raw) : {};
  const current = config.mcpServers?.[name];
  if (isCurrentBridge(current, workspace)) return "unchanged";
  if (options.dryRun) return current ? "would replace" : "would add";
  const [command, ...args] = bridgeCommand(workspace);
  const wanted = { type: "stdio", command, args, env: { MCP_REMOTE_CONFIG_DIR: authDir(workspace) } };
  if (!current) {
    const run = options.run || ((cmd, cmdArgs) => spawnSync(cmd, cmdArgs, { stdio: "inherit" }));
    if (run("claude", ["mcp", "add-json", "--scope", "user", name, JSON.stringify(wanted)]).status !== 0) {
      throw new Error(`Could not add ${name} to Claude Code. Nothing was changed.`);
    }
    return "added";
  }
  const backup = `${path}.router-backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  await writeFile(backup, raw, { encoding: "utf8", mode: 0o600 });
  if (await readFile(backup, "utf8") !== raw) throw new Error(`Could not back up ${path}. Nothing was changed.`);
  const updated = `${JSON.stringify({ ...config, mcpServers: { ...config.mcpServers, [name]: wanted } }, null, 2)}\n`;
  try {
    await options.beforeWrite?.();
    if (await readOptional(path) !== raw) {
      throw new Error(`${path} changed while ${name} was being updated. Nothing was written; retry.`);
    }
    await (options.atomicWrite || atomicWrite)(path, updated);
  } catch (error) {
    throw new Error(`Could not replace ${name}; the existing entry was left in place. ${error.message}`);
  }
  return "replaced";
}

export function commandExists(command) {
  const result = spawnSync(command, ["--version"], { stdio: "ignore" });
  return !result.error && result.status === 0;
}

export function selectedClients(value, exists = commandExists) {
  const detected = ["codex", "claude"].filter(exists);
  if (!value) return detected;
  const requested = value === "both" ? ["codex", "claude"] : [value];
  const missing = requested.filter((client) => !exists(client));
  if (missing.length) {
    throw new Error(`Missing required client: ${missing.join(", ")}. Install it and retry.`);
  }
  return requested;
}

export function runInherited(command, args, options = {}) {
  const { dryRun = false, cwd = process.cwd(), json = false } = options;
  if (dryRun) return { status: 0, planned: [command, ...args] };
  const result = spawnSync(command, args, {
    cwd,
    stdio: json ? ["inherit", process.stderr, process.stderr] : "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(`${command} exited with status ${result.status}.`);
    error.exitCode = result.status || 1;
    throw error;
  }
  return result;
}

export function runCaptured(command, args, options = {}) {
  const { cwd = process.cwd(), timeout = 120 } = options;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeout * 1000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr, timedOut });
    });
  });
}

export function hasServer(client, name) {
  const result = spawnSync(client, ["mcp", "get", name], { stdio: "ignore" });
  return !result.error && result.status === 0;
}

export async function ensureCodexServerSettings(name, options = {}) {
  const home = options.codexHome || process.env.CODEX_HOME || join(homedir(), ".codex");
  const configPath = join(home, "config.toml");
  const text = await readFile(configPath, "utf8");
  const updated = setTomlServerSettings(text, name);
  if (updated === text || options.dryRun) return configPath;
  await atomicWrite(configPath, updated);
  return configPath;
}

export function setTomlServerApproval(text, name) {
  return setTomlTableValue(text, `[mcp_servers.${name}]`, "default_tools_approval_mode", '"writes"');
}

export function setTomlServerSettings(text, name) {
  return setTomlTableValue(setTomlServerApproval(text, name), `[mcp_servers.${name}]`, "startup_timeout_sec", "120");
}

export function setTomlTableValue(text, header, key, value) {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.trim() === header);
  if (start === -1) {
    while (lines.length && lines.at(-1).trim() === "") lines.pop();
    if (lines.length) lines.push("");
    lines.push(header, `${key} = ${value}`, "");
    return lines.join("\n");
  }
  let end = lines.findIndex((line, index) => index > start && /^\s*\[/.test(line));
  if (end === -1) end = lines.length;
  const setting = lines.findIndex(
    (line, index) => index > start && index < end && (
      line.trimStart().startsWith(`${key} =`) || line.trimStart().startsWith(`${key}=`)
    )
  );
  if (setting !== -1) {
    lines[setting] = `${key} = ${value}`;
  } else {
    let insertAt = end;
    while (insertAt > start + 1 && lines[insertAt - 1].trim() === "") insertAt -= 1;
    lines.splice(insertAt, 0, `${key} = ${value}`);
  }
  return lines.join("\n");
}

async function atomicWrite(path, content) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.linear-workspace-router.tmp`;
  await writeFile(temporary, content, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
}

async function readOptional(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

export function configuredLinearServers(text) {
  const names = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("[mcp_servers.") || !trimmed.endsWith("]")) continue;
    const raw = trimmed.slice("[mcp_servers.".length, -1);
    let name = raw;
    if (raw.startsWith('"') && raw.endsWith('"')) {
      try { name = JSON.parse(raw); } catch { continue; }
    } else if (!/^[a-zA-Z0-9_-]+$/.test(raw)) {
      continue;
    }
    if (name === "linear" || name.startsWith("linear-")) names.push(name);
  }
  return [...new Set(names)];
}

export function setBundledLinearPluginEnabled(text, enabled) {
  let updated = text;
  for (const id of ["linear@openai-curated", "linear@openai-curated-remote"]) {
    updated = setTomlTableValue(updated, `[plugins."${id}"]`, "enabled", String(enabled));
  }
  return updated;
}

export function buildCodexProjectScope(text, names, selectedName) {
  let updated = text;
  for (const name of [...new Set(names)].sort()) {
    updated = setTomlTableValue(
      updated,
      `[mcp_servers.${name}]`,
      "enabled",
      String(name === selectedName)
    );
  }
  updated = setTomlTableValue(updated, `[mcp_servers.${selectedName}]`, "required", "true");
  updated = setTomlTableValue(updated, `[mcp_servers.${selectedName}]`, "startup_timeout_sec", "120");
  return updated;
}

export function verifyCodexScopeTransports(names, servers) {
  for (const name of names) {
    const transport = servers.find((server) => server.name === name)?.transport;
    const valid = transport?.type === "stdio"
      ? typeof transport.command === "string" && transport.command.trim()
      : transport?.type === "streamable_http"
        && typeof transport.url === "string" && transport.url.trim();
    if (!valid) {
      throw new Error(`${name} has no valid command or URL. Repair its named connection before scoping. No config was written.`);
    }
  }
}

export function pauseCodexProjectScope(text, selectedName) {
  const header = `[mcp_servers.${selectedName}]`;
  return setTomlTableValue(
    setTomlTableValue(text, header, "enabled", "false"),
    header,
    "required",
    "false"
  );
}

export function parseCodexMcpList(text) {
  const servers = [];
  for (const line of text.split("\n")) {
    const columns = line.trim().split(/\s+/);
    const name = columns[0] || "";
    if (name !== "linear" && !name.startsWith("linear-")) continue;
    const status = columns.includes("disabled")
      ? "disabled"
      : columns.includes("enabled") ? "enabled" : "unknown";
    servers.push({ name, status });
  }
  return servers;
}

export function parseBundledLinearPlugin(text) {
  const result = JSON.parse(text);
  if (!Array.isArray(result.installed)) {
    throw new Error("Cannot read installed plugins. Stop before Linear work.");
  }
  const plugins = result.installed.filter(
    (item) => /^linear@/.test(item.pluginId || "")
  );
  return { installed: plugins.length > 0, enabled: plugins.some((plugin) => plugin.enabled !== false) };
}

export function verifyCodexRepoScope(servers, selectedName, plugin) {
  const selected = servers.find((server) => server.name === selectedName);
  const exposed = servers.filter(
    (server) => server.name !== selectedName && server.status !== "disabled"
  );
  if (!selected || selected.status !== "enabled") {
    throw new Error(
      `${selectedName} is not enabled in this repo. Trust the project and retry.`
    );
  }
  if (exposed.length) {
    throw new Error(
      `Other Linear servers are still exposed: ${exposed.map((item) => item.name).join(", ")}. ` +
      "Trust the project and retry."
    );
  }
  if (plugin.installed && plugin.enabled) {
    throw new Error("The bundled Linear plugin is still enabled. Stop before Linear work.");
  }
  return true;
}

function capture(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with status ${result.status}.`);
  }
  return result.stdout;
}

export function findGitRepoRoot(cwd = process.cwd()) {
  const target = resolve(cwd);
  const result = spawnSync("git", ["-C", target, "rev-parse", "--show-toplevel"], {
    cwd: target,
    encoding: "utf8"
  });
  if (result.error || result.status !== 0 || !result.stdout.trim()) {
    throw new Error("Could not find a Git repo. Pass --repo with the repo root.");
  }
  return result.stdout.trim();
}

export async function prepareCodexRepoScope(workspace, options = {}) {
  const repoRoot = options.repo ? resolve(options.repo) : findGitRepoRoot(options.cwd);
  const codexHome = options.codexHome || process.env.CODEX_HOME || join(homedir(), ".codex");
  const userConfigPath = join(codexHome, "config.toml");
  const projectConfigPath = join(repoRoot, ".codex", "config.toml");
  const userConfig = await readFile(userConfigPath, "utf8");
  const projectConfig = await readOptional(projectConfigPath);
  const currentServers = parseCodexMcpList(capture("codex", ["mcp", "list"], repoRoot));
  const names = [...new Set([
    ...configuredLinearServers(userConfig),
    ...configuredLinearServers(projectConfig),
    ...currentServers.map((server) => server.name)
  ])];
  const selectedName = serverName(workspace);
  if (!names.includes(selectedName)) {
    throw new Error(`${selectedName} is not configured. Run setup before scoping this repo.`);
  }
  const transports = names.map((name) => JSON.parse(
    capture("codex", ["mcp", "get", name, "--json"], repoRoot)
  ));
  verifyCodexScopeTransports(names, transports);
  return {
    repoRoot,
    selectedName,
    disabledNames: names.filter((name) => name !== selectedName).sort(),
    userConfigPath,
    projectConfigPath,
    userConfig: setBundledLinearPluginEnabled(userConfig, false),
    projectConfig: buildCodexProjectScope(projectConfig, names, selectedName)
  };
}

export async function applyCodexRepoScope(plan, options = {}) {
  if (options.dryRun) return;
  await atomicWrite(plan.userConfigPath, plan.userConfig);
  await atomicWrite(plan.projectConfigPath, plan.projectConfig);
  const servers = parseCodexMcpList(capture("codex", ["mcp", "list"], plan.repoRoot));
  const plugin = parseBundledLinearPlugin(
    capture("codex", ["plugin", "list", "--json"], plan.repoRoot)
  );
  verifyCodexRepoScope(servers, plan.selectedName, plugin);
}

export async function pauseCodexRepoScope(plan) {
  const current = await readOptional(plan.projectConfigPath);
  await atomicWrite(plan.projectConfigPath, pauseCodexProjectScope(current, plan.selectedName));
}

export function buildRoutingBlock(workspaces, client) {
  const lines = [
    ROUTE_START,
    "## Linear workspace routing",
    "",
    "When named Linear servers are available, never use a bundled or hosted Linear connector.",
    ""
  ];
  for (const workspace of workspaces) {
    lines.push(`- ${workspace.workspaceName || workspace.alias} → \`${serverName(workspace)}\``);
  }
  lines.push(
    "",
    "For reads, search more than one named server when the workspace is unclear.",
    "For creates, edits, comments, or status changes, never guess the workspace. Confirm it before writing.",
    client === "codex"
      ? "Codex MCP write tools must keep `default_tools_approval_mode = \"writes\"`."
      : "Keep Linear write tools outside the automatic permission allowlist.",
    ROUTE_END
  );
  return `${lines.join("\n")}\n`;
}

export function upsertMarkedBlock(text, block) {
  const start = text.indexOf(ROUTE_START);
  const end = text.indexOf(ROUTE_END);
  if ((start === -1) !== (end === -1)) {
    throw new Error("Found an incomplete Linear routing block. Repair it before retrying.");
  }
  if (start !== -1) {
    const after = end + ROUTE_END.length;
    return `${text.slice(0, start)}${block.trimEnd()}${text.slice(after)}`;
  }
  const prefix = text && !text.endsWith("\n") ? `${text}\n` : text;
  return `${prefix}${prefix ? "\n" : ""}${block}`;
}

export async function installRouting(workspaces, client, options = {}) {
  const home = options.home || homedir();
  const path = client === "codex"
    ? join(options.codexHome || process.env.CODEX_HOME || join(home, ".codex"), "AGENTS.md")
    : join(home, ".claude", "CLAUDE.md");
  let current = "";
  try { current = await readFile(path, "utf8"); } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const updated = upsertMarkedBlock(current, buildRoutingBlock(workspaces, client));
  if (!options.dryRun) await atomicWrite(path, updated);
  return path;
}

export async function installSkill(packageRoot, client, options = {}) {
  const home = options.home || homedir();
  const source = join(packageRoot, "skill", "linear-workspace-router");
  const target = client === "codex"
    ? join(options.codexHome || process.env.CODEX_HOME || join(home, ".codex"), "skills", "linear-workspace-router")
    : join(home, ".claude", "skills", "linear-workspace-router");
  if (!options.dryRun) {
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target, { recursive: true, force: true });
    // Point the skill at this package's real CLI path, wherever it was installed.
    const skillFile = join(target, "SKILL.md");
    const bin = join(packageRoot, "bin", "linear-workspace-router.mjs");
    await writeFile(skillFile, (await readFile(skillFile, "utf8")).replaceAll("{{ROUTER_BIN}}", bin));
  }
  return target;
}

function extractJson(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text].filter(Boolean);
  for (const candidate of candidates) {
    try { return JSON.parse(candidate.trim()); } catch {}
    const starts = [...candidate.matchAll(/\{/g)].map((match) => match.index);
    for (const start of starts) {
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let index = start; index < candidate.length; index += 1) {
        const char = candidate[index];
        if (inString) {
          if (escaped) escaped = false;
          else if (char === "\\") escaped = true;
          else if (char === '"') inString = false;
        } else if (char === '"') inString = true;
        else if (char === "{") depth += 1;
        else if (char === "}" && --depth === 0) {
          try { return JSON.parse(candidate.slice(start, index + 1)); } catch { break; }
        }
      }
    }
  }
  throw new Error("The client did not return parseable verification JSON.");
}

export function parseCodexVerification(stdout) {
  let finalText = "";
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === "item.completed" && event.item?.type === "agent_message") {
        finalText = event.item.text;
      }
    } catch {}
  }
  return extractJson(finalText || stdout);
}

export function parseClaudeVerification(stdout) {
  const outer = JSON.parse(stdout.trim());
  if (outer.is_error) throw new Error("Claude reported a verification error.");
  return extractJson(outer.result || "");
}

export function verifyExpected(result, workspaces) {
  const errors = [];
  const ids = new Map();
  for (const workspace of workspaces) {
    const name = serverName(workspace);
    const actual = result[name];
    if (!actual || typeof actual !== "object" || !actual.id || !actual.name) {
      errors.push(`${name} returned no valid workspace identity.`);
      continue;
    }
    if (workspace.workspaceId && actual.id !== workspace.workspaceId) {
      errors.push(`${name} changed from workspace ID ${workspace.workspaceId} to ${actual.id}.`);
    } else if (!workspace.workspaceId && workspace.workspaceName && actual.name !== workspace.workspaceName) {
      errors.push(`${name} expected "${workspace.workspaceName}" but returned "${actual.name}".`);
    }
    const prior = ids.get(actual.id);
    if (prior && prior !== name) {
      errors.push(`${name} and ${prior} both resolve to workspace ID ${actual.id}.`);
    } else {
      ids.set(actual.id, name);
    }
  }
  if (errors.length) {
    const error = new Error(`${errors.join(" ")} Stop: credentials may not be isolated.`);
    error.exitCode = 3;
    throw error;
  }
  return result;
}

// An explicit model is only added when asked for; otherwise the client uses its own setting.
export function codexVerifyArgs(names, prompt, model) {
  return [
    "exec", ...names.flatMap((name) => ["-c", `mcp_servers.${name}.enabled=true`]),
    ...(model ? ["-m", model] : []),
    "--ephemeral", "--skip-git-repo-check", "--sandbox", "read-only", "--json", prompt
  ];
}

export function claudeVerifyArgs(allowed, prompt, model) {
  return [
    "-p", "--no-session-persistence", "--permission-mode", "dontAsk",
    ...(model ? ["--model", model] : []),
    "--allowedTools", allowed, "--output-format", "json", prompt
  ];
}

export async function verifyClient(client, workspaces, options = {}) {
  if (options.dryRun) {
    return Object.fromEntries(workspaces.map((workspace) => [serverName(workspace), {
      status: "planned",
      expectedName: workspace.workspaceName || null
    }]));
  }
  const names = workspaces.map(serverName);
  const prompt = [
    "Credential-isolation verification only.",
    `Use only these named MCP servers: ${names.join(", ")}.`,
    "Call get_workspace on each server.",
    "Do not use a bundled or hosted Linear connector. Do not call write tools.",
    "Return only a JSON object mapping each server name to the get_workspace object with id, name, and url."
  ].join(" ");
  let result;
  if (client === "codex") {
    const plugin = parseBundledLinearPlugin(capture("codex", ["plugin", "list", "--json"], options.cwd));
    if (plugin.enabled) throw new Error("The bundled Linear plugin is still enabled. Stop before Linear work.");
    result = await runCaptured("codex", codexVerifyArgs(names, prompt, options.model), options);
    if (result.timedOut) throw new Error(`Codex verification timed out after ${options.timeout} seconds.`);
    if (result.status !== 0) throw new Error("Codex verification failed. Check MCP authentication and retry.");
    return verifyExpected(parseCodexVerification(result.stdout), workspaces);
  }
  const allowed = names.map((name) => `mcp__${name}__get_workspace`).join(",");
  result = await runCaptured("claude", claudeVerifyArgs(allowed, prompt, options.model), options);
  if (result.timedOut) throw new Error(`Claude verification timed out after ${options.timeout} seconds.`);
  if (result.status !== 0) throw new Error("Claude verification failed. Check MCP authentication and retry.");
  return verifyExpected(parseClaudeVerification(result.stdout), workspaces);
}

export async function replaceCodexConnection(workspace, options, verify) {
  const home = options.codexHome || process.env.CODEX_HOME || join(homedir(), ".codex");
  const path = join(home, "config.toml");
  const existed = await stat(path).then(() => true, (error) => {
    if (error.code === "ENOENT") return false;
    throw error;
  });
  const previous = await readOptional(path);
  const name = serverName(workspace);
  const header = `[mcp_servers.${name}]`;
  // Router connections use stdio. Do not silently mix an existing HTTP transport with it.
  const block = previous.split(header)[1]?.split(/\n\s*\[/)[0] || "";
  if (/^\s*url\s*=/m.test(block)) {
    throw new Error(`${name} uses HTTP. Stop and review its transport before replacing it.`);
  }
  if (/^\s*env\s*=/m.test(block) || previous.includes(`[mcp_servers."${name}"]`)) {
    throw new Error(`${name} uses a config form requiring manual transport review. No config was written.`);
  }
  const [command, ...bridgeArgs] = bridgeCommand(workspace);
  const known = parseCodexServers(previous)[name];
  if (isCurrentBridge(known, workspace)) return verify();
  let updated = setTomlServerSettings(previous, name);
  updated = setTomlTableValue(updated, header, "command", JSON.stringify(command));
  updated = setTomlTableValue(updated, header, "args", JSON.stringify(bridgeArgs));
  if (known?.enabled === undefined) updated = setTomlTableValue(updated, header, "enabled", "false");
  updated = setTomlTableValue(updated, `[mcp_servers.${name}.env]`, "MCP_REMOTE_CONFIG_DIR", JSON.stringify(authDir(workspace)));
  if (options.dryRun) return verify();
  await atomicWrite(path, updated);
  try {
    return await verify();
  } catch (error) {
    if (await readFile(path, "utf8") !== updated) {
      throw new Error("Setup failed and config changed elsewhere. Left those changes intact; review config before retrying.", { cause: error });
    }
    if (existed) await atomicWrite(path, previous);
    else await unlink(path);
    throw error;
  }
}

// Saved workspace identity per alias (name, id, url). No tokens. Written after a check or setup verifies a workspace.
export async function readPins(options = {}) {
  return JSON.parse(await readOptional(options.pinsFile || PINS_PATH) || "{}");
}

export async function savePins(workspaces, options = {}) {
  const pins = await readPins(options);
  for (const { alias, workspaceName, workspaceId, workspaceUrl } of workspaces) {
    if (!workspaceName || !workspaceId) continue;
    // The saved ID is the trusted one. A different ID is never written over it.
    if (pins[alias] && pins[alias].id !== workspaceId) {
      throw new Error(`${alias} is pinned to workspace ID ${pins[alias].id}, but this run saw ${workspaceId}. The saved pin was not changed.`);
    }
    pins[alias] = { name: workspaceName, id: workspaceId, url: workspaceUrl || null };
  }
  await atomicWrite(options.pinsFile || PINS_PATH, `${JSON.stringify(pins, null, 2)}\n`);
}

// Fill the saved ID (and name, URL) for each alias. The ID is what the check compares; a typed name is only a label.
export function applyPins(workspaces, pins) {
  return workspaces.map((workspace) => {
    const pin = pins[workspace.alias];
    if (!pin) return workspace;
    return { ...workspace, workspaceName: workspace.workspaceName || pin.name, workspaceId: pin.id, workspaceUrl: pin.url };
  });
}

// After a verified check, remember each workspace's real identity.
export function pinsFromResult(result, workspaces) {
  return workspaces.map((workspace) => {
    const actual = result[serverName(workspace)];
    return { ...workspace, workspaceName: actual.name, workspaceId: actual.id, workspaceUrl: actual.url || null };
  });
}

export async function readNames(options = {}) {
  return JSON.parse(await readOptional(options.namesFile || NAMES_PATH) || "{}");
}

export function applyNames(workspaces, names) {
  return workspaces.map((workspace) => names[workspace.alias] ? { ...workspace, serverName: names[workspace.alias] } : workspace);
}

// The workspace name the user should look for on Linear's page: the confirmed saved name, or null when none is saved.
export function displayNameFor(alias, pins) {
  return pins?.[alias]?.name || null;
}
