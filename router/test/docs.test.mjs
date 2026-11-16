import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { installSkill } from "../src/core.mjs";

const routerRoot = join(import.meta.dirname, "..");
const repoRoot = join(routerRoot, "..");
// These tests read the public docs that sit next to router/. Skip if the router was copied out alone.
const hasDocs = existsSync(join(repoRoot, "SKILL.md")) && existsSync(join(repoRoot, "README.md"));

function markdownFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name === ".git") return [];
    return statSync(path).isDirectory() ? markdownFiles(path) : name.endsWith(".md") ? [path] : [];
  });
}

const docs = hasDocs ? markdownFiles(repoRoot) : [];
const text = (path) => readFileSync(path, "utf8");

test("every relative link in the docs points at a file that exists", { skip: !hasDocs }, () => {
  const dead = [];
  for (const file of docs) {
    for (const match of text(file).matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
      const target = match[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      if (!existsSync(normalize(join(dirname(file), target)))) dead.push(`${relative(repoRoot, file)} -> ${target}`);
    }
  }
  assert.deepEqual(dead, []);
});

test("the docs contain no personal paths and never tell anyone to run an unpublished command", { skip: !hasDocs }, () => {
  for (const file of docs) {
    const body = text(file);
    assert.doesNotMatch(body, /\/Users\/|\/home\/[a-z]/, `${relative(repoRoot, file)} has a personal path`);
    for (const block of body.matchAll(/```[a-z]*\n([\s\S]*?)```/g)) {
      assert.doesNotMatch(block[1], /npx linear-workspace-router/, `${relative(repoRoot, file)} runs an unpublished package`);
    }
  }
});

test("the top-level skill and README point at the router CLI and the router README", { skip: !hasDocs }, () => {
  assert.ok(existsSync(join(routerRoot, "bin", "linear-workspace-router.mjs")));
  const skill = text(join(repoRoot, "SKILL.md"));
  assert.match(skill, /router\/bin\/linear-workspace-router\.mjs/);
  assert.match(skill, /\(router\/README\.md\)/);
  assert.match(text(join(repoRoot, "README.md")), /router\/bin\/linear-workspace-router\.mjs/);
});

test("the guides name the router's default Roster server and never define the old one", { skip: !hasDocs }, () => {
  const codex = text(join(repoRoot, "references", "codex.md"));
  assert.match(codex, /\[mcp_servers\.linear-onroster\]/);
  for (const file of docs) {
    assert.doesNotMatch(text(file), /\[mcp_servers\.linear-roster\]/, `${relative(repoRoot, file)} defines the old server name`);
  }
});

test("the known launcher limitation is stated in the docs people read", { skip: !hasDocs }, () => {
  for (const file of ["README.md", "SKILL.md", join("router", "README.md"), join("references", "troubleshooting.md")]) {
    assert.match(text(join(repoRoot, file)), /takes? over the same (local )?port/i, `${file} should state the port-reuse limitation`);
  }
});

test("the plugin guidance names the supported removal command, not only /plugins", { skip: !hasDocs }, () => {
  for (const file of [join("references", "codex.md"), join("references", "troubleshooting.md"), join("router", "README.md")]) {
    assert.match(text(join(repoRoot, file)), /codex plugin remove/, `${file} should name codex plugin remove`);
  }
});

test("the bundled router skill has one placeholder and install-skill fills it with a real path", async () => {
  const template = readFileSync(join(routerRoot, "skill", "linear-workspace-router", "SKILL.md"), "utf8");
  assert.deepEqual([...new Set(template.match(/\{\{[A-Z_]+\}\}/g))], ["{{ROUTER_BIN}}"]);
  const home = await mkdtemp(join(tmpdir(), "router-docs-skill-"));
  try {
    const target = await installSkill(routerRoot, "claude", { home });
    const installed = await readFile(join(target, "SKILL.md"), "utf8");
    assert.doesNotMatch(installed, /\{\{/);
    const expected = join(routerRoot, "bin", "linear-workspace-router.mjs");
    const paths = [...installed.matchAll(/node (\S*linear-workspace-router\.mjs)/g)].map((m) => m[1]);
    assert.ok(paths.length >= 3);
    assert.deepEqual([...new Set(paths)], [expected], "every command uses this package's real CLI path");
    assert.ok(existsSync(expected));
  } finally { await rm(home, { recursive: true, force: true }); }
});
