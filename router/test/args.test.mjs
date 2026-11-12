import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs, parseWorkspace, slugify } from "../src/args.mjs";

test("slugify creates safe server suffixes", () => {
  assert.equal(slugify("SWD Projects"), "swd-projects");
});

test("parseWorkspace keeps the expected workspace name", () => {
  assert.deepEqual(parseWorkspace("roster=Roster App"), {
    alias: "roster",
    workspaceName: "Roster App",
    workspaceId: null,
    workspaceUrl: null
  });
});

test("parseWorkspace allows interactive discovery", () => {
  assert.deepEqual(parseWorkspace("hopperx"), {
    alias: "hopperx",
    workspaceName: null,
    workspaceId: null,
    workspaceUrl: null
  });
});

test("parseArgs accepts repeated workspaces", () => {
  const args = parseArgs(["check", "--client", "both", "--workspace", "a=Team A", "--workspace", "b=Team B"]);
  assert.equal(args.command, "check");
  assert.equal(args.workspaces.length, 2);
});

test("parseArgs rejects duplicate aliases", () => {
  assert.throws(
    () => parseArgs(["--workspace", "a=Team A", "--workspace", "A=Team B"]),
    /Duplicate workspace alias/
  );
});

test("parseArgs accepts one repo scope", () => {
  const args = parseArgs([
    "scope",
    "--client", "codex",
    "--repo", "/tmp/example",
    "--workspace", "roster=Roster App"
  ]);
  assert.equal(args.command, "scope");
  assert.equal(args.repo, "/tmp/example");
  assert.equal(args.workspaces[0].alias, "roster");
});

test("parseArgs requires exactly one workspace for scope", () => {
  assert.throws(() => parseArgs(["scope"]), /exactly one --workspace/);
  assert.throws(
    () => parseArgs(["scope", "--workspace", "a=A", "--workspace", "b=B"]),
    /exactly one --workspace/
  );
});

test("--model is read for verification", () => {
  assert.equal(parseArgs(["check", "--workspace", "roster", "--model", "m1"]).model, "m1");
  assert.equal(parseArgs(["check", "--workspace", "roster"]).model, null);
});
