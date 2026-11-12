import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, writeFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
  replaceCodexConnection,
  buildCodexProjectScope,
  buildRoutingBlock,
  configuredLinearServers,
  parseBundledLinearPlugin,
  parseCodexMcpList,
  pauseCodexProjectScope,
  parseClaudeVerification,
  parseCodexVerification,
  setTomlServerApproval,
  setTomlServerSettings,
  WRAPPER_PATH,
  bridgeCommand,
  authDir,
  ensureClaudeServer,
  withExistingNames,
  parseCodexServers,
  installSkill,
  applyNames,
  codexVerifyArgs,
  claudeVerifyArgs,
  serverName,
  applyPins,
  savePins,
  readPins,
  pinsFromResult,
  setBundledLinearPluginEnabled,
  upsertMarkedBlock,
  verifyCodexRepoScope,
  verifyCodexScopeTransports,
  verifyExpected
} from "../src/core.mjs";

const roster = { alias: "roster", workspaceName: "Roster App", workspaceId: null, workspaceUrl: null };

test("setTomlServerApproval adds writes guard inside the named block", () => {
  const input = '[mcp_servers.linear-onroster]\nurl = "https://mcp.linear.app/mcp"\n\n[features]\nx = true\n';
  const output = setTomlServerApproval(input, "linear-onroster");
  assert.match(output, /default_tools_approval_mode = "writes"/);
  assert.match(output, /\[features\]\nx = true/);
});

test("Codex server settings allow a slow OAuth handshake", () => {
  const output = setTomlServerSettings('[mcp_servers.linear-onroster]\ncommand = "npx"\n', "linear-onroster");
  assert.match(output, /default_tools_approval_mode = "writes"/);
  assert.match(output, /startup_timeout_sec = 120/);
});

test("routing block replaces only its marked section", () => {
  const first = upsertMarkedBlock("# Existing\n", buildRoutingBlock([roster], "codex"));
  const second = upsertMarkedBlock(first, buildRoutingBlock([{
    alias: "personal",
    workspaceName: "My Personal Workspace",
    workspaceId: null,
    workspaceUrl: null
  }], "codex"));
  assert.match(second, /# Existing/);
  assert.doesNotMatch(second, /Roster App/);
  assert.match(second, /My Personal Workspace/);
});

test("Codex verification parser reads the final agent message", () => {
  const stdout = [
    JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: '{"linear-onroster":{"id":"r1","name":"Roster App","url":"https://linear.app/example"}}' } }),
    JSON.stringify({ type: "turn.completed" })
  ].join("\n");
  assert.equal(parseCodexVerification(stdout)["linear-onroster"].id, "r1");
});

test("Claude verification parser reads fenced result JSON", () => {
  const stdout = JSON.stringify({ is_error: false, result: '```json\n{"linear-onroster":{"id":"r1","name":"Roster App"}}\n```' });
  assert.equal(parseClaudeVerification(stdout)["linear-onroster"].name, "Roster App");
});

test("verification rejects cross-workspace results", () => {
  assert.throws(
    () => verifyExpected({ "linear-onroster": { id: "h1", name: "HopperAI" } }, [roster]),
    /credentials may not be isolated/
  );
});

test("verification rejects two names resolving to one workspace ID", () => {
  const workspaces = [
    roster,
    { alias: "other", workspaceName: "Other", workspaceId: null, workspaceUrl: null }
  ];
  assert.throws(
    () => verifyExpected({
      "linear-onroster": { id: "same", name: "Roster App" },
      "linear-other": { id: "same", name: "Other" }
    }, workspaces),
    /both resolve to workspace ID/
  );
});

test("a new Claude entry is added with the labeled wrapper and the saved-login folder", async () => {
  const { root, claudeConfig } = await claudeFixture({});
  const calls = [];
  try {
    assert.equal(await ensureClaudeServer(roster, { claudeConfig, run: (c, args) => { calls.push(args); return { status: 0 }; } }), "added");
    assert.deepEqual(calls[0].slice(0, 5), ["mcp", "add-json", "--scope", "user", "linear-onroster"]);
    assert.deepEqual(JSON.parse(calls[0][5]), good());
    assert.ok(!calls[0][5].includes("npx"));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("repo scope enables one named server and disables the others", () => {
  const input = "model = \"gpt-test\"\n\n[mcp_servers.linear-onroster]\nenabled = false\n";
  const output = buildCodexProjectScope(
    input,
    ["linear-onroster", "linear-hopperx", "linear-personal"],
    "linear-onroster"
  );
  assert.match(output, /model = "gpt-test"/);
  assert.match(output, /\[mcp_servers\.linear-onroster\]\nenabled = true/);
  assert.match(output, /\[mcp_servers\.linear-onroster\][\s\S]*?required = true/);
  assert.match(output, /\[mcp_servers\.linear-onroster\][\s\S]*?startup_timeout_sec = 120/);
  assert.match(output, /\[mcp_servers\.linear-hopperx\]\nenabled = false/);
  assert.match(output, /\[mcp_servers\.linear-personal\]\nenabled = false/);
});

test("failed repo verification pauses the selected server", () => {
  const scoped = buildCodexProjectScope("", ["linear-onroster", "linear-hopperx"], "linear-onroster");
  const paused = pauseCodexProjectScope(scoped, "linear-onroster");
  assert.match(paused, /\[mcp_servers\.linear-onroster\][\s\S]*?enabled = false/);
  assert.match(paused, /\[mcp_servers\.linear-onroster\][\s\S]*?required = false/);
  assert.match(paused, /\[mcp_servers\.linear-hopperx\][\s\S]*?enabled = false/);
});

test("repo scope disables the bundled Linear plugin without changing other plugin settings", () => {
  const input = '[plugins."linear@openai-curated"]\nenabled=true\n\n[plugins."github@openai-curated"]\nenabled = true\n';
  const output = setBundledLinearPluginEnabled(input, false);
  assert.match(output, /\[plugins\."linear@openai-curated"\]\nenabled = false/);
  assert.match(output, /\[plugins\."github@openai-curated"\]\nenabled = true/);
});

test("configuredLinearServers reads quoted and plain table names", () => {
  const input = '[mcp_servers.linear-onroster]\nurl = "x"\n\n[mcp_servers.linear-onroster.env]\nX = "x"\n\n[mcp_servers."linear-personal"]\nurl = "x"\n';
  assert.deepEqual(configuredLinearServers(input), ["linear-onroster", "linear-personal"]);
});

test("repo scope verification rejects an extra exposed Linear server", () => {
  const servers = parseCodexMcpList([
    "Name             Url  Status   Auth",
    "linear-onroster    x    enabled  OAuth",
    "linear-personal  x    enabled  OAuth"
  ].join("\n"));
  assert.throws(
    () => verifyCodexRepoScope(servers, "linear-onroster", { installed: false, enabled: false }),
    /still exposed/
  );
});

test("repo scope verification rejects an enabled bundled Linear plugin", () => {
  const plugin = parseBundledLinearPlugin(JSON.stringify({
    installed: [{ pluginId: "linear@openai-curated", enabled: true }]
  }));
  assert.throws(
    () => verifyCodexRepoScope(
      [{ name: "linear-onroster", status: "enabled" }],
      "linear-onroster",
      plugin
    ),
    /bundled Linear plugin is still enabled/
  );
});


test("scope rejects missing transports even for disabled, unselected servers", () => {
  const valid = { name: "linear-onroster", transport: { type: "stdio", command: "npx" } };
  for (const transport of [undefined, {}, { type: "stdio", command: " " }, { type: "streamable_http", url: "" }]) {
    assert.throws(() => verifyCodexScopeTransports(
      ["linear-onroster", "linear-hopperx"],
      [valid, { name: "linear-hopperx", enabled: false, transport }]
    ), /linear-hopperx has no valid command or URL/);
  }
  assert.throws(() => verifyCodexScopeTransports(["linear-missing"], [valid]), /linear-missing/);
});

test("scope accepts complete stdio and HTTP transports", () => {
  assert.doesNotThrow(() => verifyCodexScopeTransports(
    ["linear-onroster", "linear-personal"],
    [
      { name: "linear-onroster", transport: { type: "stdio", command: "npx" } },
      { name: "linear-personal", transport: { type: "streamable_http", url: "https://mcp.linear.app/mcp" } }
    ]
  ));
});


test("plugin guard checks every installed Linear plugin including remote", () => {
  for (const installed of [
    [{ pluginId: "linear@openai-curated-remote", enabled: true }],
    [{ pluginId: "linear@openai-curated", enabled: false }, { pluginId: "linear@openai-curated-remote", enabled: true }],
    [{ pluginId: "linear@future-marketplace" }]
  ]) {
    assert.deepEqual(parseBundledLinearPlugin(JSON.stringify({ installed })), { installed: true, enabled: true });
  }
  assert.throws(() => parseBundledLinearPlugin('{}'), /Cannot read installed plugins/);
});

test("plugin config disables both shipped Linear IDs", () => {
  const output = setBundledLinearPluginEnabled('[plugins."linear@openai-curated-remote"]\nenabled = true\n', false);
  assert.match(output, /linear@openai-curated-remote"\]\nenabled = false/);
});

test("replacement stays parseable with a project override and rolls back on failure", async (t) => {
  if (spawnSync("codex", ["--version"]).status !== 0) return t.skip("Codex unavailable");
  const root = await mkdtemp(join(tmpdir(), "router-replacement-"));
  const path = join(root, "config.toml");
  const previous = '[mcp_servers.linear-onroster]\ncommand = "old"\nenabled = false\ndefault_tools_approval_mode = "writes"\n';
  try {
    await writeFile(path, previous);
    await assert.rejects(replaceCodexConnection(roster, { codexHome: root }, async () => {
      const current = await readFile(path, "utf8");
      assert.match(current, /command = "node"/);
      assert.match(current, /enabled = false/);
      assert.match(current, /default_tools_approval_mode = "writes"/);
      const result = spawnSync("codex", ["-c", "mcp_servers.linear-onroster.enabled=true", "mcp", "list"], {
        env: { ...process.env, CODEX_HOME: root }, encoding: "utf8"
      });
      assert.equal(result.status, 0, result.stderr);
      throw new Error("simulated verification failure");
    }), /simulated verification failure/);
    assert.equal(await readFile(path, "utf8"), previous);
    await replaceCodexConnection(roster, { codexHome: root }, async () => {});
    assert.match(await readFile(path, "utf8"), /command = "node"/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("dry-run replacement makes no config changes", async () => {
  const root = await mkdtemp(join(tmpdir(), "router-dry-run-"));
  try {
    await replaceCodexConnection(roster, { codexHome: root, dryRun: true }, async () => {});
    await assert.rejects(readFile(join(root, "config.toml")), { code: "ENOENT" });
  } finally { await rm(root, { recursive: true, force: true }); }
});

const good = (name = "linear-onroster") => ({ type: "stdio", command: "node", args: bridgeCommand(roster).slice(1), env: { MCP_REMOTE_CONFIG_DIR: authDir(roster) } });

async function claudeFixture(servers) {
  const root = await mkdtemp(join(tmpdir(), "router-claude-"));
  const claudeConfig = join(root, "claude.json");
  await writeFile(claudeConfig, JSON.stringify({ mcpServers: servers }));
  return { root, claudeConfig };
}

test("Codex re-run keeps the wrapper and the enabled setting", async () => {
  const root = await mkdtemp(join(tmpdir(), "router-wrapper-"));
  const path = join(root, "config.toml");
  try {
    await replaceCodexConnection(roster, { codexHome: root }, async () => {});
    const first = await readFile(path, "utf8");
    assert.match(first, /command = "node"/);
    assert.ok(first.includes(WRAPPER_PATH));
    assert.doesNotMatch(first, /npx/);
    await writeFile(path, first.replace("enabled = false", "enabled = true"));
    await replaceCodexConnection(roster, { codexHome: root }, async () => {});
    const second = await readFile(path, "utf8");
    assert.match(second, /enabled = true/);
    assert.equal(second.match(/\[mcp_servers\.linear-onroster\]/g).length, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("an old plain-npx Codex entry is moved to the wrapper without losing enabled", async () => {
  const root = await mkdtemp(join(tmpdir(), "router-upgrade-"));
  const path = join(root, "config.toml");
  try {
    await writeFile(path, '[mcp_servers.linear-onroster]\ncommand = "npx"\nargs = ["-y","mcp-remote@0.15.1"]\nenabled = true\n');
    await replaceCodexConnection(roster, { codexHome: root }, async () => {});
    const text = await readFile(path, "utf8");
    assert.match(text, /command = "node"/);
    assert.match(text, /enabled = true/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("an existing good Claude entry is left alone", async () => {
  const { root, claudeConfig } = await claudeFixture({ "linear-onroster": good() });
  const calls = [];
  try {
    const result = await ensureClaudeServer(roster, { claudeConfig, run: (...call) => { calls.push(call); return { status: 0 }; } });
    assert.equal(result, "unchanged");
    assert.deepEqual(calls, []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

const oldEntry = () => ({ type: "stdio", command: "npx", args: ["-y", "mcp-remote@0.15.1"], env: { MCP_REMOTE_CONFIG_DIR: authDir(roster), SECRET_TOKEN: "do-not-print-me" } });
const otherServers = { pencil: { type: "stdio", command: "pencil" }, "linear-hopperx": { type: "stdio", command: "keep-me" } };

async function replaceFixture() {
  const fixture = await claudeFixture({ ...otherServers, "linear-onroster": oldEntry() });
  const text = JSON.stringify({ topLevel: "kept", mcpServers: { ...otherServers, "linear-onroster": oldEntry() } }, null, 2);
  await writeFile(fixture.claudeConfig, text);
  return { ...fixture, text };
}

test("replacing a Claude entry never runs remove and keeps every other entry", async () => {
  const { root, claudeConfig } = await replaceFixture();
  const calls = [];
  try {
    const result = await ensureClaudeServer(roster, { claudeConfig, run: (...call) => { calls.push(call); return { status: 0 }; } });
    assert.equal(result, "replaced");
    assert.deepEqual(calls, []);
    const written = JSON.parse(await readFile(claudeConfig, "utf8"));
    assert.equal(written.topLevel, "kept");
    assert.deepEqual(written.mcpServers.pencil, otherServers.pencil);
    assert.deepEqual(written.mcpServers["linear-hopperx"], otherServers["linear-hopperx"]);
    assert.equal(written.mcpServers["linear-onroster"].command, "node");
    const backups = (await readdir(root)).filter((n) => n.includes(".router-backup-"));
    assert.equal(backups.length, 1);
    assert.equal(JSON.parse(await readFile(join(root, backups[0]), "utf8")).mcpServers["linear-onroster"].command, "npx");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a failed Claude write leaves the old entry and file untouched and prints no credentials", async () => {
  const { root, claudeConfig, text } = await replaceFixture();
  try {
    await assert.rejects(
      ensureClaudeServer(roster, { claudeConfig, atomicWrite: async () => { throw new Error("disk full"); } }),
      (error) => /existing entry was left in place/.test(error.message) && !/do-not-print-me|SECRET_TOKEN/.test(error.message)
    );
    assert.equal(await readFile(claudeConfig, "utf8"), text);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a Claude config that changes during the update is not overwritten", async () => {
  const { root, claudeConfig } = await replaceFixture();
  try {
    let changed;
    await assert.rejects(
      ensureClaudeServer(roster, { claudeConfig, beforeWrite: async () => { changed = JSON.stringify({ mcpServers: { late: { command: "x" } } }); await writeFile(claudeConfig, changed); } }),
      /changed while linear-onroster was being updated/
    );
    assert.equal(await readFile(claudeConfig, "utf8"), changed);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a failed add of a new Claude entry changes nothing and says so", async () => {
  const { root, claudeConfig } = await claudeFixture({ pencil: otherServers.pencil });
  try {
    await assert.rejects(ensureClaudeServer(roster, { claudeConfig, run: () => ({ status: 1 }) }), /Nothing was changed/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a different server name can use the same login folder without a second entry", async () => {
  const { root, claudeConfig } = await claudeFixture({ "linear-onroster": good() });
  const calls = [];
  try {
    const [named] = await withExistingNames("claude", [roster], { claudeConfig });
    assert.equal(named.serverName, "linear-onroster");
    assert.equal(authDir(named), authDir(roster));
    assert.equal(await ensureClaudeServer(named, { claudeConfig, run: (...call) => { calls.push(call); return { status: 0 }; } }), "unchanged");
    assert.deepEqual(calls, []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Codex keeps its own name for the same login folder", async () => {
  const root = await mkdtemp(join(tmpdir(), "router-codex-name-"));
  try {
    await writeFile(join(root, "config.toml"), `[mcp_servers.linear-onroster]\ncommand = "node"\n[mcp_servers.linear-onroster.env]\nMCP_REMOTE_CONFIG_DIR = ${JSON.stringify(authDir(roster))}\n`);
    const [named] = await withExistingNames("codex", [roster], { codexHome: root });
    assert.equal(named.serverName, "linear-onroster");
    assert.equal(parseCodexServers(await readFile(join(root, "config.toml"), "utf8"))["linear-onroster"].command, "node");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("repo scope never writes a command or args into a project config", () => {
  const output = buildCodexProjectScope("", ["linear-onroster", "linear-hopperx"], "linear-hopperx");
  assert.doesNotMatch(output, /command\s*=|args\s*=|MCP_REMOTE_CONFIG_DIR/);
});

const pin = { roster: { name: "Roster App", id: "id-1", url: "https://linear.app/example" } };

test("a saved pin supplies the name and id when none is typed", () => {
  const [filled] = applyPins([{ alias: "roster", workspaceName: null, workspaceId: null, workspaceUrl: null }], pin);
  assert.deepEqual([filled.workspaceName, filled.workspaceId], ["Roster App", "id-1"]);
});

test("a display-name change keeps the saved id and does not ask to delete the pin", () => {
  const [filled] = applyPins([{ alias: "roster", workspaceName: "Roster Renamed", workspaceId: null, workspaceUrl: null }], pin);
  assert.equal(filled.workspaceId, "id-1");
  assert.equal(filled.workspaceName, "Roster Renamed");
  assert.doesNotThrow(() => verifyExpected({ "linear-onroster": { id: "id-1", name: "Roster Renamed Again" } }, [filled]));
});

test("a live workspace id that differs from the saved id fails the check", () => {
  const [filled] = applyPins([{ alias: "roster", workspaceName: null, workspaceId: null, workspaceUrl: null }], pin);
  assert.throws(() => verifyExpected({ "linear-onroster": { id: "id-2", name: "Roster App" } }, [filled]), /changed from workspace ID id-1 to id-2/);
  assert.doesNotThrow(() => verifyExpected({ "linear-onroster": { id: "id-1", name: "Roster App" } }, [filled]));
});

test("no pin and no name stays unnamed so the clear error fires", () => {
  const [same] = applyPins([{ alias: "hopperx", workspaceName: null, workspaceId: null, workspaceUrl: null }], pin);
  assert.equal(same.workspaceName, null);
});

test("pins are saved without tokens and read back", async () => {
  const root = await mkdtemp(join(tmpdir(), "router-pins-"));
  const pinsFile = join(root, "pins.json");
  try {
    const [saved] = pinsFromResult({ "linear-onroster": { id: "id-1", name: "Roster App", url: "u", access_token: "x" } }, [roster]);
    await savePins([saved], { pinsFile });
    assert.deepEqual(await readPins({ pinsFile }), { roster: { name: "Roster App", id: "id-1", url: "u" } });
    assert.doesNotMatch(await readFile(pinsFile, "utf8"), /token/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a mismatched live id names both ids and leaves the saved pin untouched", async () => {
  const root = await mkdtemp(join(tmpdir(), "router-pin-mismatch-"));
  const pinsFile = join(root, "pins.json");
  try {
    await savePins([{ alias: "roster", workspaceName: "Roster App", workspaceId: "id-1", workspaceUrl: "u" }], { pinsFile });
    const before = await readFile(pinsFile, "utf8");
    const [filled] = applyPins([{ alias: "roster", workspaceName: null, workspaceId: null, workspaceUrl: null }], await readPins({ pinsFile }));
    assert.throws(() => verifyExpected({ "linear-onroster": { id: "id-9", name: "Elsewhere" } }, [filled]), /id-1 to id-9/);
    await assert.rejects(savePins([{ alias: "roster", workspaceName: "Elsewhere", workspaceId: "id-9", workspaceUrl: "x" }], { pinsFile }), /pinned to workspace ID id-1.*id-9/);
    assert.equal(await readFile(pinsFile, "utf8"), before);
    await savePins([{ alias: "roster", workspaceName: "Roster New Name", workspaceId: "id-1", workspaceUrl: "u" }], { pinsFile });
    assert.equal((await readPins({ pinsFile })).roster.name, "Roster New Name");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("clean install with no local files: roster is linear-onroster in both clients, login folder stays linear-roster", async () => {
  assert.equal(serverName(roster), "linear-onroster");
  assert.equal(serverName({ alias: "hopperx" }), "linear-hopperx");
  assert.equal(serverName({ alias: "personal" }), "linear-personal");
  assert.equal(authDir(roster), join(homedir(), ".mcp-auth", "linear-roster"));
  const { root, claudeConfig } = await claudeFixture({});
  const calls = [];
  try {
    await ensureClaudeServer(roster, { claudeConfig, run: (c, args) => { calls.push(args); return { status: 0 }; } });
    assert.equal(calls[0][4], "linear-onroster");
    const definition = JSON.parse(calls[0][5]);
    assert.equal(definition.env.MCP_REMOTE_CONFIG_DIR, join(homedir(), ".mcp-auth", "linear-roster"));
    assert.ok(definition.args.includes("workspace=roster"));
    await replaceCodexConnection(roster, { codexHome: root }, async () => {});
    const text = await readFile(join(root, "config.toml"), "utf8");
    assert.match(text, /\[mcp_servers\.linear-onroster\]/);
    assert.doesNotMatch(text, /mcp_servers\.linear-roster/);
    assert.ok(text.includes(`MCP_REMOTE_CONFIG_DIR = ${JSON.stringify(join(homedir(), ".mcp-auth", "linear-roster"))}`));
    assert.ok(text.includes("workspace=roster"));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("an optional names.json overrides the default name and adds names for other aliases", () => {
  const [roster2, hopperx] = applyNames([{ alias: "roster" }, { alias: "hopperx" }], { roster: "linear-custom", hopperx: "linear-hx" });
  assert.deepEqual([serverName(roster2), serverName(hopperx)], ["linear-custom", "linear-hx"]);
  assert.equal(serverName(applyNames([{ alias: "roster" }], {})[0]), "linear-onroster");
});

test("rerunning setup for roster adds no second entry in either client", async () => {
  const roster = applyNames([{ alias: "roster", workspaceName: "Roster App", workspaceId: null, workspaceUrl: null }], { roster: "linear-onroster" })[0];
  const { root, claudeConfig } = await claudeFixture({ "linear-onroster": good() });
  try {
    await replaceCodexConnection(roster, { codexHome: root }, async () => {});
    await replaceCodexConnection(roster, { codexHome: root }, async () => {});
    const text = await readFile(join(root, "config.toml"), "utf8");
    assert.equal(text.match(/^\[mcp_servers\.[^.\]]+\]/gm).length, 1);
    const [named] = await withExistingNames("claude", [roster], { claudeConfig });
    const calls = [];
    assert.equal(await ensureClaudeServer(named, { claudeConfig, run: (...c) => { calls.push(c); return { status: 0 }; } }), "unchanged");
    assert.deepEqual(calls, []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("verification adds a model only when one is given", () => {
  assert.ok(!codexVerifyArgs(["a"], "p").includes("-m"));
  assert.deepEqual(codexVerifyArgs(["a"], "p", "m1").slice(3, 5), ["-m", "m1"]);
  assert.ok(!claudeVerifyArgs("t", "p").includes("--model"));
  assert.ok(claudeVerifyArgs("t", "p", "m2").join(" ").includes("--model m2"));
});

test("installing the skill points it at this package's real CLI path", async () => {
  const home = await mkdtemp(join(tmpdir(), "router-skill-"));
  try {
    const packageRoot = join(import.meta.dirname, "..");
    const target = await installSkill(packageRoot, "claude", { home });
    const text = await readFile(join(target, "SKILL.md"), "utf8");
    assert.ok(text.includes(join(packageRoot, "bin", "linear-workspace-router.mjs")));
    assert.ok(!text.includes("{{ROUTER_BIN}}"));
  } finally { await rm(home, { recursive: true, force: true }); }
});

test("the package ships everything the wrapper and the installed skill need, with no personal paths", async () => {
  const root = join(import.meta.dirname, "..");
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  for (const entry of ["bin", "src", "skill"]) assert.ok(pkg.files.includes(entry), `${entry} must be packaged`);
  for (const file of ["bin/linear-bridge-label.mjs", "bin/shim/open", "bin/shim/launcher-page.mjs", "src/core.mjs"]) {
    assert.ok((await readFile(join(root, file), "utf8")).length > 0, `${file} must exist`);
  }
  const skill = await readFile(join(root, "skill", "linear-workspace-router", "SKILL.md"), "utf8");
  assert.ok(skill.includes("{{ROUTER_BIN}}"));
  assert.doesNotMatch(skill, /\/Users\//);
});
