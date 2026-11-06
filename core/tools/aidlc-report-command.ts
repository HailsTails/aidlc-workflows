import { resolve } from "node:path";
import { resolveAction, TOOLS, withoutProjectDirFlag } from "./aidlc.ts";
import { decodeOrchestratorRequest, type OrchestratorRequest } from "./aidlc-orchestrator-request.ts";
import { parseLiteralShellInvocation, shellCommandSegments } from "./aidlc-shell-invocation.ts";

export type ReportCommandContext = {
  cwd: string;
  sessionId?: string;
  environment?: Readonly<Record<string, string | undefined>>;
  sourceFile?: string;
  native?: boolean;
};
export type ObservedReportCommand = {
  command: string;
  context: ReportCommandContext;
  request: OrchestratorRequest;
};

const executableName = (word: string | undefined): string =>
  word?.replace(/\\/g, "/").split("/").at(-1)?.toLowerCase() ?? "";
const BUN_VALUE_OPTIONS = new Set(["--preload", "--require", "--import", "--title", "--cwd", "--define", "--env-file", "--conditions", "--tsconfig-override"]);
const BUN_SWITCHES = new Set(["--smol", "--watch", "--hot", "--no-clear-screen", "--no-macros", "--no-env-file", "--silent"]);

// Wrapper options are host syntax, not report syntax. In particular a preload
// value naming aidlc.ts is not the script Bun executes.
function scriptInvocation(words: readonly string[], context: ReportCommandContext): {
  source?: string; args: string[]; context: ReportCommandContext; runtimeMutation: boolean;
} | null {
  let at = 1;
  let cwd = context.cwd;
  let runtimeMutation = false;
  for (; at < words.length; at++) {
    const word = words[at];
    if (word === "run" || word === "--" || BUN_SWITCHES.has(word)) continue;
    const [option, inline] = word.split(/=(.*)/s);
    if (BUN_VALUE_OPTIONS.has(option)) {
      const value = inline ?? words[++at];
      if (value === undefined) return null;
      if (option === "--cwd") cwd = resolve(cwd, value);
      if (["--preload", "--require", "--import", "--env-file"].includes(option)) runtimeMutation = true;
      continue;
    }
    if (word.startsWith("-")) return null;
    const name = executableName(word);
    if (name !== "aidlc.ts" && name !== "aidlc-orchestrate.ts") return null;
    return { source: resolve(cwd, word), args: words.slice(at + 1), context: { ...context, cwd }, runtimeMutation };
  }
  return null;
}

function unwrap(words: readonly string[], context: ReportCommandContext): {
  words: string[]; context: ReportCommandContext; identityChanged: boolean;
} {
  let at = 0;
  const environment = { ...context.environment };
  let identityChanged = false;
  while (at < words.length) {
    const word = words[at];
    if (["env", "command", "exec", "--"].includes(word)) { at++; continue; }
    const assignment = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s.exec(word);
    if (!assignment) break;
    if (["AIDLC_SESSION_OVERRIDE", "AIDLC_SESSION_OVERRIDE_SOURCE", "CODEX_THREAD_ID", "CLAUDE_CODE_SESSION_ID", "CLAUDE_PID", "KIRO_SESSION_ID", "AIDLC_HARNESS_DIR"].includes(assignment[1]) && assignment[2] !== context.environment?.[assignment[1]]) identityChanged = true;
    environment[assignment[1]] = assignment[2];
    at++;
  }
  return { words: words.slice(at), context: { ...context, environment }, identityChanged };
}

function observeSegment(command: string, argv: readonly string[], invocationContext: ReportCommandContext): ObservedReportCommand | null {
  const unwrapped = unwrap(argv, invocationContext);
  const executable = executableName(unwrapped.words[0]);
  let args = unwrapped.words.slice(1);
  let context = unwrapped.context;
  let direct = false;
  let runtimeMutation = false;
  if (executable === "bun" || executable === "bun.exe") {
    const script = scriptInvocation(unwrapped.words, context);
    if (!script) return null;
    args = script.args;
    runtimeMutation = script.runtimeMutation;
    context = { ...script.context, sourceFile: script.source, native: false };
    direct = executableName(script.source) === "aidlc-orchestrate.ts";
  } else if (executable === "aidlc" || executable === "aidlc.exe") {
    context = { ...context, native: true };
  } else {
    return null;
  }
  if (!direct) {
    const action = resolveAction(args, context.native, context.cwd, context.environment);
    if (action.type === "error") {
      // A refused launcher still names its real route. Use the dispatcher's
      // existing option stripper only to classify it, never to execute it or
      // resolve a target with repaired arguments.
      const route = resolveAction(withoutProjectDirFlag(args).filter((word) => !word.startsWith("--project-dir=")), context.native, context.cwd, context.environment);
      if (route.type !== "delegate" || route.tool !== TOOLS.orchestrate || decodeOrchestratorRequest({ argv: route.args }).kind === "other") return null;
      return { command, context, request: { kind: "invalid", launcher: { args, taken: [], verbAt: 0, conflictingAttemptId: false }, diagnostic: action.message } };
    }
    if (action.type !== "delegate" || action.tool !== TOOLS.orchestrate) return null;
    args = action.args;
  }
  const request = decodeOrchestratorRequest({ argv: args });
  if (request.kind === "other") return null;
  return { command, context, request: runtimeMutation ? { kind: "invalid", launcher: request.launcher, diagnostic: "The Bun launcher loads code or an environment file before this report, so its execution context is unresolved. Run the report directly without that loader." } : unwrapped.identityChanged ? { kind: "invalid", launcher: request.launcher, diagnostic: "The report changes its session identity in the shell prefix; select the work in this conversation and run the report directly." } : request };
}

/** Capture literal operations separately; never combine selectors from two commands. */
export function observeReportCommands(input: { command: string; context: ReportCommandContext }): ObservedReportCommand[] {
  const operations: ObservedReportCommand[] = [];
  let context = { ...input.context, environment: input.context.environment ?? process.env };
  let directoryUnresolved = false;
  // The established literal parser handles the supported cd ... && command form.
  const whole = parseLiteralShellInvocation(input.command.replace(/^\s*&\s*/, ""), true);
  if (whole?.directory) {
    const observed = observeSegment(whole.command, whole.argv, { ...context, cwd: whole.directory });
    return observed ? [observed] : [];
  }
  for (const segment of shellCommandSegments(input.command, true)) {
    const text = segment.replace(/^\s*&\s*/, "");
    if (/^\s*\$env:[A-Za-z_][A-Za-z0-9_]*\s*=/.test(text)) directoryUnresolved = true;
    const literal = parseLiteralShellInvocation(text, true);
    if (!literal) {
      // Only inspect a literal executable/route prefix. Never search a quoted
      // script or echo argument for report-shaped words.
      for (let end = text.length - 1; end > 0; end--) {
        if (text[end] !== " " && text[end] !== "\t") continue;
        const prefix = parseLiteralShellInvocation(text.slice(0, end), true);
        if (!prefix) continue;
        if (["cd", "pushd", "Set-Location", "sl", "source", ".", "eval"].includes(prefix.argv[0])) directoryUnresolved = true;
        const partial = observeSegment(text, prefix.argv, context);
        if (partial) operations.push({ ...partial, request: { kind: "invalid", launcher: partial.request.launcher, diagnostic: "The report uses dynamic or unsupported shell syntax; run its literal command directly so the completion target can be checked." } });
        break;
      }
      continue;
    }
    if (literal.argv[0] === "cd" && literal.argv.length === 2 && !literal.argv[1].startsWith("-")) {
      context = { ...context, cwd: resolve(context.cwd, literal.argv[1]) };
      continue;
    }
    if (["cd", "pushd", "popd", "Set-Location", "Push-Location", "Pop-Location", "sl", "source", ".", "eval", "export", "set", "unset"].includes(literal.argv[0]) || (literal.argv.length === 1 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(literal.argv[0]))) directoryUnresolved = true;
    const observed = observeSegment(text, literal.argv, context);
    if (observed) operations.push(directoryUnresolved ? { ...observed, request: { kind: "invalid", launcher: observed.request.launcher, diagnostic: "A preceding shell operation changes the report context in a way this guard cannot resolve. Run the report directly in its project." } } : observed);
  }
  return operations;
}

export function completionCommands(input: { command: string; context: ReportCommandContext }): ObservedReportCommand[] {
  return observeReportCommands(input).filter(({ request }) => request.kind === "invalid" || (request.kind === "report" && request.forward !== null));
}
