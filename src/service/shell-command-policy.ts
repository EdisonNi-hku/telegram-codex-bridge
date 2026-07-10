export interface ShellRiskDecision {
  decision: "direct" | "confirm";
  reason: string;
}

const DIRECT_INSPECTION_COMMANDS = new Set([
  "cat",
  "df",
  "du",
  "file",
  "grep",
  "head",
  "ls",
  "pwd",
  "rg",
  "stat",
  "tail",
  "type",
  "which"
]);

const DIRECT_GIT_SUBCOMMANDS = new Set(["diff", "log", "show", "status"]);
const GIT_UNSAFE_INSPECTION_FLAGS = ["--ext-diff", "--output", "--textconv"];
const FIND_MUTATING_ACTIONS = new Set([
  "-delete",
  "-exec",
  "-execdir",
  "-fls",
  "-fprint",
  "-fprint0",
  "-fprintf",
  "-ok",
  "-okdir"
]);
const GIT_BRANCH_MUTATING_FLAGS = new Set([
  "--copy",
  "--delete",
  "--edit-description",
  "--move",
  "--set-upstream-to",
  "--unset-upstream",
  "-C",
  "-D",
  "-M",
  "-c",
  "-d",
  "-m"
]);

export function parseBangShellCommand(text: string): string | null {
  if (!text.startsWith("!")) {
    return null;
  }

  return text.slice(1).trim();
}

export function classifyShellCommand(command: string): ShellRiskDecision {
  if (hasAmbiguousShellSyntax(command)) {
    return {
      decision: "confirm",
      reason: "命令包含 shell 组合、替换或重定向"
    };
  }

  const tokens = tokenizeSimpleCommand(command);
  if (!tokens || tokens.length === 0) {
    return {
      decision: "confirm",
      reason: "命令语法无法安全识别"
    };
  }

  const [program, ...args] = tokens;
  if (DIRECT_INSPECTION_COMMANDS.has(program ?? "")) {
    return { decision: "direct", reason: "只读命令" };
  }

  if (program === "find" && args.every((arg) => !FIND_MUTATING_ACTIONS.has(arg))) {
    return { decision: "direct", reason: "只读查找" };
  }

  if (program === "mkdir" && isSafeMkdirInvocation(args)) {
    return { decision: "direct", reason: "项目内目录创建" };
  }

  if (program === "git" && isDirectGitInspection(args)) {
    return { decision: "direct", reason: "只读 Git 命令" };
  }

  return {
    decision: "confirm",
    reason: "命令不在直接执行集合中"
  };
}

function hasAmbiguousShellSyntax(command: string): boolean {
  return /[;&|><`\r\n$]/u.test(command);
}

function tokenizeSimpleCommand(command: string): string[] | null {
  const tokens: string[] = [];
  let token = "";
  let quote: "'" | "\"" | null = null;
  let escaping = false;
  let tokenStarted = false;

  for (const character of command) {
    if (escaping) {
      token += character;
      tokenStarted = true;
      escaping = false;
      continue;
    }

    if (character === "\\" && quote !== "'") {
      escaping = true;
      tokenStarted = true;
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = null;
      } else {
        token += character;
      }
      tokenStarted = true;
      continue;
    }

    if (character === "'" || character === "\"") {
      quote = character;
      tokenStarted = true;
      continue;
    }

    if (/\s/u.test(character)) {
      if (tokenStarted) {
        tokens.push(token);
        token = "";
        tokenStarted = false;
      }
      continue;
    }

    token += character;
    tokenStarted = true;
  }

  if (quote || escaping) {
    return null;
  }

  if (tokenStarted) {
    tokens.push(token);
  }

  return tokens;
}

function isSafeMkdirInvocation(args: string[]): boolean {
  const paths = args.filter((arg) => !isAllowedMkdirOption(arg));
  return paths.length > 0 && paths.every(isSafeRelativePath);
}

function isAllowedMkdirOption(arg: string): boolean {
  return arg === "--" || arg === "--parents" || arg === "--verbose" || arg === "-p" || arg === "-v";
}

function isSafeRelativePath(path: string): boolean {
  if (!path || path.startsWith("/") || path.startsWith("~") || /^[A-Za-z]:[\\/]/u.test(path)) {
    return false;
  }

  const components = path.replaceAll("\\", "/").split("/");
  return components.every((component) => component !== ".." && component !== "");
}

function isDirectGitInspection(args: string[]): boolean {
  const [subcommand, ...subcommandArgs] = args;
  if (!subcommand) {
    return false;
  }

  if (DIRECT_GIT_SUBCOMMANDS.has(subcommand)) {
    return subcommandArgs.every((arg) => !GIT_UNSAFE_INSPECTION_FLAGS.some((flag) => arg === flag || arg.startsWith(`${flag}=`)));
  }

  if (subcommand !== "branch") {
    return false;
  }

  return subcommandArgs.every((arg) => arg.startsWith("-") && !GIT_BRANCH_MUTATING_FLAGS.has(arg));
}
