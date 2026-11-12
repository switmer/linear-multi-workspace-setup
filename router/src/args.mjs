export const HELP = `linear-workspace-router

Set up isolated Linear workspace connections for Codex and Claude Code.

Usage:
  linear-workspace-router [setup] [options]
  linear-workspace-router check [options]
  linear-workspace-router scope [options]
  linear-workspace-router install-skill [options]

Options:
  --client <name>       codex, claude, or both (default: detected clients)
  --workspace <value>   alias or alias=expected-workspace
                        Repeat once per workspace.
  --repo <path>         Repo to scope (default: current Git repo)
  --timeout <seconds>   Verification timeout (default: 120)
  --model <name>        Model for the verification run (default: the client's own setting).
                        Use when the default model is not allowed for your account.
  --dry-run             Show planned changes without making them
  --json                Print the final result as JSON
  --yes                 Skip CLI prompts; OAuth still requires user approval
  --no-install-skill    Do not install the bundled agent skill
  -h, --help            Show help
  -v, --version         Show version

Examples:
  npx linear-workspace-router
  npx linear-workspace-router --client both \\
    --workspace roster="Roster App" \\
    --workspace hopperx=HopperAI
  npx linear-workspace-router check --client codex \\
    --workspace personal="My Personal Workspace"
  npx linear-workspace-router scope --client codex \
    --workspace roster="Roster App"
`;

export function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} needs a value.`);
  }
  return value;
}

export function parseWorkspace(value) {
  const separator = value.indexOf("=");
  const rawAlias = (separator === -1 ? value : value.slice(0, separator)).trim();
  const workspaceName = separator === -1 ? null : value.slice(separator + 1).trim();
  const alias = slugify(rawAlias);
  if (!alias || separator === 0 || (separator !== -1 && !workspaceName)) {
    throw new Error(`Invalid workspace "${value}". Use alias=expected-workspace.`);
  }
  return { alias, workspaceName, workspaceId: null, workspaceUrl: null };
}

export function parseArgs(argv) {
  const args = {
    command: "setup",
    client: null,
    workspaces: [],
    dryRun: false,
    json: false,
    yes: false,
    installSkill: true,
    repo: null,
    timeout: 120,
    model: null,
    help: false,
    version: false
  };

  let index = 0;
  if (argv[0] && !argv[0].startsWith("-")) {
    args.command = argv[0];
    index = 1;
  }
  if (!["setup", "check", "scope", "install-skill"].includes(args.command)) {
    throw new Error(`Unknown command "${args.command}". Run with --help.`);
  }

  for (; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--client") {
      args.client = readValue(argv, index, token);
      index += 1;
    } else if (token === "--workspace") {
      args.workspaces.push(parseWorkspace(readValue(argv, index, token)));
      index += 1;
    } else if (token === "--timeout") {
      const value = Number(readValue(argv, index, token));
      if (!Number.isFinite(value) || value <= 0) throw new Error("--timeout must be a positive number.");
      args.timeout = value;
      index += 1;
    } else if (token === "--model") {
      args.model = readValue(argv, index, token);
      index += 1;
    } else if (token === "--repo") {
      args.repo = readValue(argv, index, token);
      index += 1;
    } else if (token === "--dry-run") {
      args.dryRun = true;
    } else if (token === "--json") {
      args.json = true;
    } else if (token === "--yes") {
      args.yes = true;
    } else if (token === "--no-install-skill") {
      args.installSkill = false;
    } else if (token === "--help" || token === "-h") {
      args.help = true;
    } else if (token === "--version" || token === "-v") {
      args.version = true;
    } else {
      throw new Error(`Unknown option "${token}". Run with --help.`);
    }
  }

  if (args.client && !["codex", "claude", "both"].includes(args.client)) {
    throw new Error(`Invalid client "${args.client}". Use codex, claude, or both.`);
  }

  const aliases = new Set();
  for (const workspace of args.workspaces) {
    if (aliases.has(workspace.alias)) {
      throw new Error(`Duplicate workspace alias "${workspace.alias}".`);
    }
    aliases.add(workspace.alias);
  }

  if (args.command === "scope" && args.workspaces.length !== 1) {
    throw new Error("scope requires exactly one --workspace alias=expected-workspace.");
  }

  return args;
}
