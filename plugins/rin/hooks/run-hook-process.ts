import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { withoutInheritedGitBindings } from "../tools/hermetic-git/index.ts";

const hooksDirectory = dirname(fileURLToPath(import.meta.url));

const RAIL_ENVIRONMENT_VARIABLES: readonly string[] = ["RIN_GUARD_TRIAL"];

const shadowLogSinkPath = join(
  tmpdir(),
  `rin-hook-fixture-shadow-${process.pid}.jsonl`,
);

const scrubbedHookEnv = (): Record<string, string> => {
  const gitScrubbedEnvironment = withoutInheritedGitBindings();
  return {
    ...Object.fromEntries(
      Object.entries(gitScrubbedEnvironment).filter(
        ([name]) => !RAIL_ENVIRONMENT_VARIABLES.includes(name),
      ),
    ),
    ["RIN_GUARD_TRIAL_LOG"]: shadowLogSinkPath,
  };
};

type RanHookOutcome = {
  readonly kind: "ran";
  readonly exitCode: number;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
};

type HookOutcome =
  | RanHookOutcome
  | {
      readonly kind: "spawnFailed";
      readonly reason: string;
    };

const permissionDecisionSchema = z.object({
  hookSpecificOutput: z
    .object({
      hookEventName: z.string().optional(),
      permissionDecision: z.string().optional(),
      permissionDecisionReason: z.string().optional(),
    })
    .optional(),
});

type PermissionDecisionOutput = z.infer<typeof permissionDecisionSchema>;

type HookRunRequest = {
  readonly hookFileName: string;
  readonly hookPath?: string;
  readonly stdinPayload: string;
  readonly cwd?: string;
  readonly runtime: "node" | "bun";
  readonly env?: Readonly<Record<string, string>>;
};

const runHookProcess = ({
  hookFileName,
  hookPath,
  stdinPayload,
  cwd,
  runtime,
  env,
}: HookRunRequest): Promise<HookOutcome> =>
  new Promise((resolve) => {
    const child = spawn(
      runtime,
      [hookPath ?? join(hooksDirectory, hookFileName)],
      {
        cwd: cwd ?? hooksDirectory,
        stdio: ["pipe", "pipe", "pipe"],
        env: env ?? scrubbedHookEnv(),
      },
    );
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdoutChunks.push(chunk);
    });
    child.stderr.on("data", (chunk: string) => {
      stderrChunks.push(chunk);
    });
    child.on("error", (spawnError: Error) => {
      resolve({ kind: "spawnFailed", reason: spawnError.message });
    });
    child.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
      resolve({
        kind: "ran",
        exitCode: code ?? -1,
        signal,
        stdout: stdoutChunks.join(""),
        stderr: stderrChunks.join(""),
      });
    });
    child.stdin.end(stdinPayload);
  });

const ranOutcomeOrFixtureFailure = ({
  outcome,
}: {
  readonly outcome: HookOutcome;
}): RanHookOutcome => {
  if (outcome.kind === "spawnFailed") {
    throw new Error(`fixture: hook process never ran — ${outcome.reason}`);
  }
  return outcome;
};

const runRanHookProcess = async (
  hookRunRequest: HookRunRequest,
): Promise<RanHookOutcome> =>
  ranOutcomeOrFixtureFailure({ outcome: await runHookProcess(hookRunRequest) });

const HOOK_INPUT_FIELD_NAMES = [
  "toolName",
  "toolInput",
  "command",
  "filePath",
  "subagentType",
  "teamName",
  "path",
  "toolResponse",
  "stdout",
  "exitCode",
  "agentType",
  "lastAssistantMessage",
  "hookEventName",
  "transcriptPath",
  "cwd",
  "sessionId",
] as const;

type HookInputFieldName = (typeof HOOK_INPUT_FIELD_NAMES)[number];

type CamelCaseHookFields = {
  readonly [Field in HookInputFieldName]?:
    | string
    | number
    | CamelCaseHookFields;
};

type SnakeCaseHookFields = {
  readonly [wireName: string]: string | number | SnakeCaseHookFields;
};

const HOOK_WIRE_NAMES = {
  toolName: "tool_name",
  toolInput: "tool_input",
  command: "command",
  filePath: "file_path",
  subagentType: "subagent_type",
  teamName: "team_name",
  path: "path",
  toolResponse: "tool_response",
  stdout: "stdout",
  exitCode: "exit_code",
  agentType: "agent_type",
  lastAssistantMessage: "last_assistant_message",
  hookEventName: "hook_event_name",
  transcriptPath: "transcript_path",
  cwd: "cwd",
  sessionId: "session_id",
} as const satisfies Record<HookInputFieldName, string>;

const snakeCaseHookFieldsOf = ({
  fields,
}: {
  readonly fields: CamelCaseHookFields;
}): SnakeCaseHookFields =>
  Object.fromEntries(
    HOOK_INPUT_FIELD_NAMES.flatMap((field) => {
      const fieldContent = fields[field];
      if (fieldContent === undefined) {
        return [];
      }
      return [
        [
          HOOK_WIRE_NAMES[field],
          typeof fieldContent === "object"
            ? snakeCaseHookFieldsOf({ fields: fieldContent })
            : fieldContent,
        ],
      ];
    }),
  );

const hookWireJson = ({
  fields,
}: {
  readonly fields: CamelCaseHookFields;
}): string => JSON.stringify(snakeCaseHookFieldsOf({ fields }));

const commandInvocationPayload = ({
  toolName,
  command,
}: {
  readonly toolName: string;
  readonly command: string;
}): string => hookWireJson({ fields: { toolName, toolInput: { command } } });

const bashInvocationPayload = ({
  command,
}: {
  readonly command: string;
}): string => commandInvocationPayload({ toolName: "Bash", command });

const fileInvocationPayload = ({
  toolName,
  filePath,
}: {
  readonly toolName: string;
  readonly filePath: string;
}): string => hookWireJson({ fields: { toolName, toolInput: { filePath } } });

const agentInvocationPayload = ({
  toolName,
  subagentType,
  teamName,
}: {
  readonly toolName: string;
  readonly subagentType: string;
  readonly teamName: string;
}): string =>
  hookWireJson({
    fields: { toolName, toolInput: { subagentType, teamName } },
  });

const gateRunPayload = ({
  cwd,
  command,
  output,
}: {
  readonly cwd: string;
  readonly command: string;
  readonly output: string;
}): string =>
  hookWireJson({
    fields: {
      toolName: "Bash",
      toolInput: { command },
      toolResponse: { stdout: output, exitCode: 0 },
      cwd,
    },
  });

const enterWorktreePayload = ({
  worktreePath,
  cwd,
}: {
  readonly worktreePath: string;
  readonly cwd?: string;
}): string =>
  hookWireJson({
    fields: {
      toolName: "EnterWorktree",
      toolInput: { path: worktreePath },
      ...(cwd === undefined ? {} : { cwd }),
    },
  });

const subagentStopPayload = ({
  agentType,
  lastAssistantMessage,
  cwd,
  sessionId,
}: {
  readonly agentType: string;
  readonly lastAssistantMessage: string;
  readonly cwd: string;
  readonly sessionId: string;
}): string =>
  hookWireJson({
    fields: { agentType, lastAssistantMessage, cwd, sessionId },
  });

const sessionStartPayload = ({ cwd }: { readonly cwd?: string } = {}): string =>
  hookWireJson({
    fields: {
      hookEventName: "SessionStart",
      ...(cwd === undefined ? {} : { cwd }),
    },
  });

const transcriptPayload = ({
  hookEventName,
  transcriptPath,
  cwd,
}: {
  readonly hookEventName: string;
  readonly transcriptPath?: string;
  readonly cwd?: string;
}): string =>
  hookWireJson({
    fields: {
      hookEventName,
      ...(transcriptPath === undefined ? {} : { transcriptPath }),
      ...(cwd === undefined ? {} : { cwd }),
    },
  });

const transcriptUserEntry = ({
  content,
  isMeta,
}: {
  readonly content: unknown;
  readonly isMeta?: boolean;
}): string =>
  JSON.stringify({
    type: "user",
    message: { role: "user", content },
    ...(isMeta === undefined ? {} : { isMeta }),
  });

const transcriptAssistantEntry = ({
  content,
}: {
  readonly content: unknown;
}): string =>
  JSON.stringify({
    type: "assistant",
    message: { role: "assistant", content },
  });

const invokeBashHook = ({
  hookFileName,
  hookPath,
  command,
  runtime,
  environmentAdditions,
}: {
  readonly hookFileName: string;
  readonly hookPath?: string;
  readonly command: string;
  readonly runtime: "node" | "bun";
  readonly environmentAdditions?: Readonly<Record<string, string>>;
}): Promise<RanHookOutcome> =>
  runRanHookProcess({
    hookFileName,
    ...(hookPath === undefined ? {} : { hookPath }),
    runtime,
    stdinPayload: bashInvocationPayload({ command }),
    ...(environmentAdditions === undefined
      ? {}
      : {
          env: { ...scrubbedHookEnv(), ...environmentAdditions },
        }),
  });

const invokeFileHook = ({
  hookFileName,
  toolName,
  filePath,
  runtime,
}: {
  readonly hookFileName: string;
  readonly toolName: string;
  readonly filePath: string;
  readonly runtime: "node" | "bun";
}): Promise<RanHookOutcome> =>
  runRanHookProcess({
    hookFileName,
    runtime,
    stdinPayload: fileInvocationPayload({ toolName, filePath }),
  });

const permissionDecisionFrom = ({
  stdout,
}: {
  readonly stdout: string;
}): PermissionDecisionOutput => {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    return {};
  }
  return permissionDecisionSchema.parse(JSON.parse(trimmed));
};

export type { HookOutcome, PermissionDecisionOutput, RanHookOutcome };
export {
  agentInvocationPayload,
  bashInvocationPayload,
  commandInvocationPayload,
  enterWorktreePayload,
  fileInvocationPayload,
  gateRunPayload,
  invokeBashHook,
  invokeFileHook,
  permissionDecisionFrom,
  runHookProcess,
  runRanHookProcess,
  scrubbedHookEnv,
  sessionStartPayload,
  subagentStopPayload,
  transcriptAssistantEntry,
  transcriptPayload,
  transcriptUserEntry,
};
