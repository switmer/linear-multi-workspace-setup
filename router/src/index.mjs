import { createInterface } from "node:readline/promises";
import { stdin as input, stdout, stderr } from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { HELP, parseArgs, parseWorkspace } from "./args.mjs";
import {
  applyCodexRepoScope,
  replaceCodexConnection,
  applyNames,
  applyPins,
  ensureClaudeServer,
  pinsFromResult,
  readNames,
  readPins,
  savePins,
  withExistingNames,
  installRouting,
  installSkill,
  pauseCodexRepoScope,
  prepareCodexRepoScope,
  runInherited,
  selectedClients,
  serverName,
  verifyClient
} from "./core.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function packageVersion() {
  const json = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));
  return json.version;
}

async function promptWorkspaces(rl, human) {
  const workspaces = [];
  human.write("\nAdd each Linear workspace. Leave the alias blank when finished.\n\n");
  while (true) {
    const alias = (await rl.question("Workspace alias (example: roster): ")).trim();
    if (!alias) break;
    const workspaceName = (await rl.question("Expected workspace name (optional; press Enter to discover): ")).trim();
    workspaces.push(parseWorkspace(workspaceName ? `${alias}=${workspaceName}` : alias));
  }
  return workspaces;
}

function printPlan(clients, workspaces, human) {
  human.write("\nPlan\n");
  human.write(`  Clients: ${clients.join(", ")}\n`);
  for (const workspace of workspaces) {
    human.write(`  ${workspace.workspaceName || `${workspace.alias} (confirm after OAuth)`} → ${serverName(workspace)}\n`);
  }
  human.write("\nEach login is followed by a read-only check of every connection added so far.\n");
}

function printScopePlan(plan, workspace, human) {
  human.write("\nRepo scope plan\n");
  human.write(`  Repo: ${plan.repoRoot}\n`);
  human.write(`  Enable: ${plan.selectedName} (${workspace.workspaceName})\n`);
  human.write(`  Disable: ${plan.disabledNames.join(", ") || "no other named Linear servers"}\n`);
  human.write("  Disable bundled Linear plugin in the user config\n");
  human.write(`  Write: ${plan.projectConfigPath}\n`);
  human.write("\nA fresh Codex process will check the loaded MCP, plugin, and workspace identity.\n");
}

async function confirm(rl, message, yes) {
  if (yes) return true;
  const answer = (await rl.question(`${message} [y/N] `)).trim().toLowerCase();
  return answer === "y" || answer === "yes";
}

async function pauseForWorkspace(rl, workspace, client, yes) {
  if (yes) return;
  const target = workspace.workspaceName || workspace.alias;
  await rl.question(`\nSwitch Linear to "${target}" for ${client}, then press Enter to open OAuth. `);
}

async function setupClient(client, requested, options, rl, report) {
  const human = options.human;
  const verified = [];
  const workspaces = await withExistingNames(client, requested, options);
  for (const workspace of workspaces) {
    const name = serverName(workspace);
    await pauseForWorkspace(rl, workspace, client, options.yes);
    const checkConnection = async () => {
      if (client === "claude") {
        const change = await ensureClaudeServer(workspace, options);
        report.claude = { ...report.claude, [name]: change };
        human.write(`Claude ${name}: ${change}\n`);
      }
      verified.push(workspace);
      human.write(`\nChecking ${client}: ${verified.map(serverName).join(", ")}…\n`);
      const result = await verifyClient(client, verified, options);
      if (options.dryRun) {
        report.verification[client] = result;
        human.write(`Would verify ${name} after OAuth.\n`);
        return;
      }
      const actual = result[name];
      if (!workspace.workspaceName) {
        human.write(`Found workspace: ${actual.name}${actual.url ? ` (${actual.url})` : ""}\n`);
        if (!(await confirm(rl, "Is this the intended workspace?", false))) {
          const error = new Error(`Workspace ${actual.name} was not confirmed. Setup stopped.`);
          error.exitCode = 3;
          throw error;
        }
        workspace.workspaceName = actual.name;
      }
      workspace.workspaceId = actual.id;
      workspace.workspaceUrl = actual.url || null;
      await savePins(pinsFromResult(result, [workspace]));
      report.verification[client] = result;
      human.write(`Verified ${name} → ${workspace.workspaceName}\n`);
    };
    if (client === "codex") {
      await replaceCodexConnection(workspace, options, checkConnection);
    } else {
      await checkConnection();
    }
  }
  report.routingFiles[client] = await installRouting(workspaces, client, options);
  if (options.installSkill) {
    report.skillPaths[client] = await installSkill(packageRoot, client, options);
  }
}

async function checkClients(clients, workspaces, options, report) {
  for (const client of clients) {
    options.human.write(`Checking ${client}…\n`);
    const named = await withExistingNames(client, workspaces, options);
    report.verification[client] = await verifyClient(client, named, options);
    if (!options.dryRun) await savePins(pinsFromResult(report.verification[client], named));
  }
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) { stdout.write(HELP); return; }
  if (args.version) { stdout.write(`${await packageVersion()}\n`); return; }

  const human = args.json ? stderr : stdout;
  args.human = human;
  const rl = createInterface({ input, output: human });
  try {
    const clients = selectedClients(args.command === "scope" ? (args.client || "codex") : args.client);
    if (!clients.length) throw new Error("No supported client found. Install Codex or Claude Code first.");
    if (args.command === "scope" && (clients.length !== 1 || clients[0] !== "codex")) {
      throw new Error("Repo scoping currently supports Codex only. Use --client codex.");
    }
    let workspaces = args.workspaces;
    if (!workspaces.length && args.command !== "install-skill") {
      if (!input.isTTY) throw new Error("Pass at least one --workspace alias=expected-workspace.");
      workspaces = await promptWorkspaces(rl, human);
    }
    if (!workspaces.length && args.command !== "install-skill") {
      throw new Error("Add at least one workspace.");
    }
    workspaces = applyNames(applyPins(workspaces, await readPins()), await readNames());
    const unnamed = workspaces.filter((workspace) => !workspace.workspaceName);
    if ((args.command === "check" || args.command === "scope" || args.yes || !input.isTTY) && unnamed.length) {
      throw new Error(`Expected workspace names are required here: ${unnamed.map((item) => item.alias).join(", ")}. Use alias=expected-workspace.`);
    }
    if (!input.isTTY && args.command === "setup" && !args.yes) {
      throw new Error("Non-interactive setup requires --yes.");
    }

    const report = {
      command: args.command,
      dryRun: args.dryRun,
      clients,
      workspaces,
      commands: [],
      verification: {},
      routingFiles: {},
      skillPaths: {},
      repoScope: null
    };

    if (args.command === "install-skill") {
      for (const client of clients) {
        report.skillPaths[client] = await installSkill(packageRoot, client, args);
      }
    } else if (args.command === "check") {
      await checkClients(clients, workspaces, args, report);
    } else if (args.command === "scope") {
      const [workspace] = await withExistingNames("codex", workspaces, args);
      const plan = await prepareCodexRepoScope(workspace, args);
      printScopePlan(plan, workspace, human);
      if (!(await confirm(rl, args.dryRun ? "Show this dry run?" : "Apply this repo scope?", args.yes))) {
        human.write("Canceled. No changes made.\n");
        return;
      }
      try {
        await applyCodexRepoScope(plan, args);
        if (!args.dryRun) {
          report.verification.codex = await verifyClient("codex", [workspace], {
            ...args,
            cwd: plan.repoRoot
          });
        }
      } catch (error) {
        await pauseCodexRepoScope(plan);
        human.write(`Verification failed. ${plan.selectedName} was disabled in this repo to stop repeat OAuth attempts.\n`);
        throw error;
      }
      report.repoScope = {
        repoRoot: plan.repoRoot,
        projectConfigPath: plan.projectConfigPath,
        selectedName: plan.selectedName,
        disabledNames: plan.disabledNames,
        bundledLinearPlugin: args.dryRun ? "planned" : "disabled"
      };
    } else {
      printPlan(clients, workspaces, human);
      if (!(await confirm(rl, args.dryRun ? "Show this dry run?" : "Continue?", args.yes))) {
        human.write("Canceled. No changes made.\n");
        return;
      }
      for (const client of clients) {
        await setupClient(client, workspaces, args, rl, report);
      }
    }

    if (args.json) stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else {
      if (args.dryRun) {
        human.write("\nDry run complete. No changes or verification were performed.\n");
      } else if (args.command === "install-skill") {
        human.write("\nSkill installed. No workspace connections were checked.\n");
      } else {
        human.write("\nDone. Workspace credentials passed isolation checks.\n");
        if (args.command === "setup" || args.command === "scope") {
          human.write("Restart each configured client or pane before normal use.\n");
        }
      }
    }
  } finally {
    rl.close();
  }
}
