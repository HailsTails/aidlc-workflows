// Isolated Claude startup contract: actual installed registrations and hook
// processes, driven by synthetic provider events. This is not a live host.
import { z } from "zod";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { commandWords, shellQuote } from "./scope-run.ts";
import { testGuardEnvironment } from "./runner-profile.ts";
import { NATIVE_STARTUP_TIMEOUT_MS, remainingOperationTimeoutMs } from "./test-budget.ts";

const settingsSchema = z.object({ hooks: z.record(z.string(), z.array(z.object({
  matcher: z.string().optional(), hooks: z.array(z.object({ type: z.string(), command: z.string() })),
}))) });
const hookOutputSchema = z.object({
  decision: z.string().optional(), continue: z.boolean().optional(),
  hookSpecificOutput: z.object({ permissionDecision: z.string().optional(), updatedInput: z.unknown().optional() }).optional(),
});
const directiveSchema = z.record(z.string(), z.unknown());
export interface HostCall {
  kind: "hook" | "tool";
  command: string;
  event?: string;
  status: number;
  stdout: string;
  stderr: string;
}
/** Validate protocol output only; never infer user approval or ignore input updates. */
export function assertStartupHookOutput(outputText: string): void {
  let decoded: unknown;
  try { decoded = JSON.parse(outputText); } catch { return; } // plain hook context
  const output = hookOutputSchema.parse(decoded);
  if ((output.decision !== undefined && !["allow", "approve"].includes(output.decision)) ||
      output.continue === false ||
      (output.hookSpecificOutput?.permissionDecision !== undefined && output.hookSpecificOutput.permissionDecision !== "allow")) {
    throw new Error(`Startup hook did not allow execution: ${outputText}`);
  }
  if (output.hookSpecificOutput?.updatedInput !== undefined) throw new Error("Startup hook updated input; this fixture does not model that route");
}

export interface ClaudeStartupHost {
  readonly project: string;
  readonly env: NodeJS.ProcessEnv;
  readonly calls: HostCall[];
  readonly session: string;
  event(event: string, hookInput?: Record<string, unknown>): void;
  start(): void;
  prompt(prompt: string): void;
  tool(name: string, toolArguments: string[]): HostCall;
  command(command: string): HostCall;
  next(toolArguments?: string[]): { result: HostCall; directive: Record<string, unknown> };
}

export function createClaudeStartupHost(project: string, inherited: NodeJS.ProcessEnv = process.env): ClaudeStartupHost {
  const env = testGuardEnvironment(inherited, "production");
  const calls: HostCall[] = [];
  const session = "guarded-startup-session";
  [
    "AIDLC_PROJECT_DIR", "CLAUDE_PROJECT_DIR", "AIDLC_HARNESS_NAME", "AIDLC_HARNESS_DIR",
    "AIDLC_SESSION_OVERRIDE", "AIDLC_SESSION_OVERRIDE_SOURCE", "AIDLC_COPILOT_SESSION_ID",
    "AIDLC_COMPILED_EXECUTABLE", "AIDLC_RUNTIME_ROOT", "AIDLC_RUNTIME_HARNESS_ROOT", "AIDLC_DEV_SOURCE",
    "AIDLC_PLUGIN_ROOT", "CLAUDE_PLUGIN_ROOT", "PLUGIN_ROOT", "AWS_AIDLC_DEFAULT_SCOPE", "AIDLC_UNATTENDED",
  ].forEach((key) => { delete env[key]; });
  env.CLAUDE_PROJECT_DIR = project;
  // Payload-aware hooks resolve the nearest Git checkout before their explicit
  // project environment. Every fixture therefore owns a real repository root,
  // even when TEMP itself is nested below the source checkout.
  ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE", "GIT_CONFIG_COUNT"].forEach((key) => { delete env[key]; });
  env.GIT_CONFIG_NOSYSTEM = "1";
  env.GIT_CONFIG_GLOBAL = join(project, ".claude", "fixture-no-global-git-config");
  const repository = spawnSync("git", ["init", "--quiet", "--template="], {
    cwd: project, env, encoding: "utf-8",
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
  });
  if (repository.status !== 0) throw new Error(`Cannot initialize isolated startup repository: ${repository.stderr || repository.error?.message}`);

  function spawn(kind: HostCall["kind"], command: string, toolArguments: string[], event?: string, input?: string): HostCall {
    const processResult = spawnSync(process.execPath, toolArguments, {
      cwd: project, env, input, encoding: "utf-8",
      timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS, { phase: "Claude startup contract" }),
    });
    const call = { kind, command, event, status: processResult.status ?? -1, stdout: processResult.stdout ?? "", stderr: processResult.error ? `${processResult.stderr ?? ""}\n${processResult.error.message}` : processResult.stderr ?? "" };
    calls.push(call);
    return call;
  }

  /** Validate the entire matching set before executing any of its commands. */
  function event(event: string, hookInput: Record<string, unknown> = {}): void {
    const settings = settingsSchema.parse(JSON.parse(readFileSync(join(project, ".claude", "settings.json"), "utf-8")));
    const names = (settings.hooks[event] ?? []).flatMap((group) => {
      const matcher = group.matcher ?? "";
      if (matcher && !/^[A-Za-z]+(?:\|[A-Za-z]+)*$/.test(matcher)) throw new Error(`Unsupported startup matcher: ${matcher}`);
      if (matcher && !matcher.split("|").includes(String(hookInput.tool_name ?? ""))) return [];
      return group.hooks.map((hook) => {
        const match = /^bun "\$CLAUDE_PROJECT_DIR\/\.claude\/tools\/aidlc\.ts" engine hook ([a-z][a-z-]+)$/.exec(hook.command);
        if (hook.type !== "command" || !match) throw new Error(`Unsupported startup hook: ${hook.command}`);
        return { name: match[1], command: hook.command };
      });
    });
    if (names.length === 0) throw new Error(`No installed hooks matched ${event}`);
    names.forEach(({ name, command }) => {
      const call = spawn("hook", command,
        [join(project, ".claude", "tools", "aidlc.ts"), "engine", "hook", name], event,
        JSON.stringify({ ...hookInput, hook_event_name: event, session_id: session, cwd: project }));
      if (call.status !== 0) throw new Error(`Installed ${name} refused ${event} (${call.status}): ${call.stderr || call.stdout}`);
      assertStartupHookOutput(call.stdout);
    });
  }

  function start(): void { event("SessionStart", { source: "startup" }); }
  function prompt(prompt: string): void { event("UserPromptSubmit", { prompt }); }

  function tool(name: string, toolArguments: string[]): HostCall {
    if (!/^aidlc(?:-[a-z-]+)?\.ts$/.test(name)) throw new Error(`Unsupported installed tool: ${name}`);
    return command(["bun", `.claude/tools/${name}`, ...toolArguments].map(shellQuote).join(" "));
  }

  /** Only the installed Bun dispatcher/tool form, never a general shell. */
  function command(command: string): HostCall {
    // Deliberately narrower than a shell, including operators inside quotes.
    if (/[;&|<>`$%\r\n]/.test(command)) throw new Error(`Unsupported startup shell syntax: ${command}`);
    const words = commandWords(command);
    if (words[0] !== "bun" || !/^\.claude\/tools\/aidlc(?:-[a-z-]+)?\.ts$/.test(words[1] ?? "")) throw new Error(`Unsupported startup command: ${command}`);
    const tool_input = { command };
    event("PreToolUse", { tool_name: "Bash", tool_input });
    const call = spawn("tool", command, words.slice(1));
    // Failed tool calls have their own host event, outside this startup slice.
    if (call.status === 0) event("PostToolUse", {
      tool_name: "Bash", tool_input, tool_response: { stdout: call.stdout, stderr: call.stderr },
    });
    return call;
  }

  function next(toolArguments: string[] = []): { result: HostCall; directive: Record<string, unknown> } {
    let orchestration = tool("aidlc-orchestrate.ts", ["next", "--project-dir", project, ...toolArguments]);
    for (let attempts = 0; attempts < 1_000; attempts++) {
      if (orchestration.status !== 0) throw new Error(`Installed next failed: ${orchestration.stderr || orchestration.stdout}`);
      const directive = directiveSchema.parse(JSON.parse(orchestration.stdout));
      if (directive.kind !== "load-steering") return { result: orchestration, directive };
      if (typeof directive.receipt !== "string" || !directive.receipt) throw new Error("Steering directive has no receipt");
      orchestration = tool("aidlc-orchestrate.ts", ["continue", directive.receipt, "--project-dir", project]);
    }
    throw new Error("Startup steering continuation limit exceeded");
  }
  return { project, env, calls, session, event, start, prompt, tool, command, next };
}
