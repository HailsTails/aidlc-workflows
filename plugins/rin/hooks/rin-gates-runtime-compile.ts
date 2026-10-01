import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RIN_TRANSITION_WRAPPERS = /\brin-gates:promote\b/;

type JsonObject = Record<string, unknown>;

type EngineHookDispatch = (input: string) => number;

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const auditSyncPayload = (raw: string): string | null => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isJsonObject(parsed) || !isJsonObject(parsed["tool_input"])) {
      return null;
    }
    const toolInput = parsed["tool_input"];
    const command = toolInput["command"];
    if (typeof command !== "string" || !RIN_TRANSITION_WRAPPERS.test(command)) {
      return null;
    }
    return JSON.stringify({
      ...parsed,
      tool_input: { ...toolInput, source: "ide-audit-sync" },
    });
  } catch {
    return null;
  }
};

const engineHookInvocation = (): {
  readonly executable: string;
  readonly arguments: readonly string[];
} => {
  const compiledExecutable = process.env["AIDLC_COMPILED_EXECUTABLE"]?.trim();
  if (compiledExecutable) {
    return {
      executable: compiledExecutable,
      arguments: ["engine", "hook", "rebuild-stage-graph"],
    };
  }
  return {
    executable: process.execPath,
    arguments: [
      join(dirname(fileURLToPath(import.meta.url)), "..", "tools", "aidlc.ts"),
      "engine",
      "hook",
      "rebuild-stage-graph",
    ],
  };
};

const dispatchEngineHook: EngineHookDispatch = (input) => {
  const invocation = engineHookInvocation();
  try {
    const result = spawnSync(invocation.executable, [...invocation.arguments], {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8",
      input,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) {
      process.stderr.write(`${result.error.message}\n`);
      return 1;
    }
    return result.status ?? 1;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
};

const run = (
  raw: string,
  dispatch: EngineHookDispatch = dispatchEngineHook,
): number => {
  const payload = auditSyncPayload(raw);
  return payload === null ? 0 : dispatch(payload);
};

if (import.meta.main) {
  process.exit(run(await Bun.stdin.text()));
}

export { auditSyncPayload, engineHookInvocation, RIN_TRANSITION_WRAPPERS, run };
