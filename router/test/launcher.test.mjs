import test from "node:test";
import assert from "node:assert/strict";
import { launcherPage } from "../bin/shim/launcher-page.mjs";
import { displayNameFor } from "../src/core.mjs";

const base = { url: "#placeholder", port: "", opened: "10:00 AM" };

test("a saved display name is what the page tells you to pick", () => {
  const html = launcherPage({ ...base, alias: "hopperx", displayName: "HopperAI" });
  assert.match(html, /<title>HopperAI · Linear sign-in<\/title>/);
  assert.match(html, /Continue to Linear for HopperAI/);
  assert.match(html, /pick <b>HopperAI<\/b>/);
  assert.match(html, /Connection <b>hopperx<\/b>/);
  assert.doesNotMatch(html, /pick <b>HOPPERX/);
});

test("with no saved name the page does not claim the alias is Linear's workspace name", () => {
  const html = launcherPage({ ...base, alias: "personal" });
  assert.match(html, /choose the workspace you intended for <b>personal<\/b>/);
  assert.doesNotMatch(html, /pick <b>/);
  assert.match(html, /Continue to Linear for personal/);
});

test("the heading names no specific client", () => {
  assert.doesNotMatch(launcherPage({ ...base, alias: "roster", displayName: "Roster App" }), /Codex|Claude/);
});

test("names and aliases are escaped in the page, title and script", () => {
  const html = launcherPage({ ...base, alias: 'x"><img src=x>', displayName: "</script><script>alert(1)</script>" });
  assert.doesNotMatch(html, /<script>alert\(1\)/);
  assert.doesNotMatch(html, /<img src=x>/);
  assert.equal(html.split("</script>").length - 1, 1);
  assert.match(html, /&lt;\/script&gt;/);
});

test("an expired page has a muted message, no link, and the display name in the title", () => {
  const html = launcherPage({ ...base, alias: "hopperx", displayName: "HopperAI", url: "https://mcp.linear.app/authorize?secret=1", expired: true });
  assert.match(html, /<title>Expired · HopperAI · Linear sign-in<\/title>/);
  assert.match(html, /This request has ended/);
  assert.doesNotMatch(html, /href="https:/);
  assert.doesNotMatch(html, /authorize/);
});

test("displayNameFor returns the saved name or null", () => {
  assert.equal(displayNameFor("hopperx", { hopperx: { name: "HopperAI", id: "i" } }), "HopperAI");
  assert.equal(displayNameFor("personal", { hopperx: { name: "HopperAI" } }), null);
  assert.equal(displayNameFor("x", undefined), null);
});

test("only a plain numeric port reaches the script", () => {
  assert.match(launcherPage({ ...base, alias: "a", port: "6699" }), /const port="6699"/);
  const bad = launcherPage({ ...base, alias: "a", port: '1"</script><script>alert(1)' });
  assert.match(bad, /const port=""/);
  assert.doesNotMatch(bad, /<script>alert/);
  assert.match(launcherPage({ ...base, alias: "a", port: "66990000" }), /const port=""/);
});
