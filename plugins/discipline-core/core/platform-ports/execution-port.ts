import { type SpawnSyncOptionsWithStringEncoding, type SpawnSyncReturns, spawnSync } from "node:child_process";
import { z } from "zod";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { Result } from "../values/result.ts";

export type ExecutionEnvironment = Readonly<Record<string, string | undefined>>;

export type ExecutionEnvironmentSnapshot = (
  request: Record<string, never>,
) => Result<ExecutionEnvironment, ExecutionFailure>;

export type ExecutionExit = {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type ExecutionFailure = {
  readonly kind:
    | "policy-invalid"
    | "launch-failed"
    | "timed-out"
    | "output-limit-exceeded"
    | "terminated"
    | "host-failed";
  readonly detail: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly code: string | undefined;
  readonly signal: string | undefined;
};

export type ExecutionRequest = {
  readonly arguments: readonly string[];
  readonly cwd?: AbsolutePath;
};

export type ExecutionPort = {
  readonly run: (request: ExecutionRequest) => Result<ExecutionExit, ExecutionFailure>;
};

export type ExecutionPolicy = {
  readonly executable: string;
  readonly environment: (request: { readonly ambient: ExecutionEnvironment }) => ExecutionEnvironment;
  readonly timeoutMilliseconds: number | undefined;
  readonly maximumOutputBytes: number;
};

export type ExecutionSpawn = (request: {
  readonly executable: string;
  readonly arguments: readonly string[];
  readonly cwd?: AbsolutePath;
  readonly environment: ExecutionEnvironment;
  readonly timeoutMilliseconds: number | undefined;
  readonly maximumOutputBytes: number;
}) => Result<ExecutionExit, ExecutionFailure>;

export type ExecutionSpawnProvider = (
  command: string,
  commandArguments: readonly string[],
  options: SpawnSyncOptionsWithStringEncoding,
) => SpawnSyncReturns<string>;

const executionEnvironmentSchema = z.record(z.string(), z.string().optional()).readonly();
const positiveSafeIntegerSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const capturedPolicySchema = z.object({
  executable: z.string().min(1),
  environment: executionEnvironmentSchema,
  timeoutMilliseconds: positiveSafeIntegerSchema.optional(),
  maximumOutputBytes: positiveSafeIntegerSchema,
}).readonly();

const hostDiagnosticsSchema = z.object({
  stdout: z.string().catch(""),
  stderr: z.string().catch(""),
  code: z.string().optional().catch(undefined),
  signal: z.string().optional().catch(undefined),
});

const EMPTY_DIAGNOSTICS = { stdout: "", stderr: "", code: undefined, signal: undefined };

const failedExecution = (error: ExecutionFailure): {
  readonly outcome: "failed";
  readonly error: ExecutionFailure;
} => ({ outcome: "failed", error });

const failureDetail = (request: { readonly thrown: unknown }): string =>
  request.thrown instanceof Error ? request.thrown.message : String(request.thrown);

const launchFailureKind = (request: { readonly code: string | undefined }): ExecutionFailure["kind"] => {
  if (request.code === "ETIMEDOUT") return "timed-out";
  if (request.code === "ENOBUFS") return "output-limit-exceeded";
  return "launch-failed";
};

const nativeOutcome = (request: {
  readonly spawned: SpawnSyncReturns<string>;
}): Result<ExecutionExit, ExecutionFailure> => {
  const { spawned } = request;
  const launchError: NodeJS.ErrnoException | undefined = spawned.error;
  const diagnostics = {
    stdout: typeof spawned.stdout === "string" ? spawned.stdout : "",
    stderr: typeof spawned.stderr === "string" ? spawned.stderr : "",
    code: launchError?.code,
    signal: spawned.signal ?? undefined,
  };
  if (launchError !== undefined) {
    return failedExecution({
      ...diagnostics,
      kind: launchFailureKind({ code: launchError.code }),
      detail: launchError.message,
    });
  }
  if (spawned.status === null) {
    return failedExecution({
      ...diagnostics,
      kind: spawned.signal === null ? "host-failed" : "terminated",
      detail: spawned.signal === null ? "the process reported no exit status or signal" : `the process was ended by signal ${spawned.signal}`,
    });
  }
  return { outcome: "ok", value: { status: spawned.status, stdout: diagnostics.stdout, stderr: diagnostics.stderr } };
};

export const createExecutionSpawn = (options: {
  readonly spawnProvider: ExecutionSpawnProvider;
}): ExecutionSpawn => (request) => {
  try {
    return nativeOutcome({ spawned: options.spawnProvider(request.executable, [...request.arguments], {
      encoding: "utf8",
      ...(request.cwd === undefined ? {} : { cwd: request.cwd }),
      env: request.environment,
      windowsHide: true,
      timeout: request.timeoutMilliseconds,
      killSignal: "SIGKILL",
      maxBuffer: request.maximumOutputBytes,
    }) });
  } catch (thrown) {
    const parsedDiagnostics = hostDiagnosticsSchema.safeParse(thrown);
    const diagnostics = parsedDiagnostics.success ? parsedDiagnostics.data : EMPTY_DIAGNOSTICS;
    return failedExecution({
      stdout: diagnostics.stdout,
      stderr: diagnostics.stderr,
      code: diagnostics.code,
      signal: diagnostics.signal,
      kind: "host-failed",
      detail: failureDetail({ thrown }),
    });
  }
};

const bindPolicy = (options: {
  readonly policy: ExecutionPolicy;
  readonly ambientEnvironment: ExecutionEnvironment;
}): Result<z.infer<typeof capturedPolicySchema>, ExecutionFailure> => {
  try {
    const parsedAmbient = executionEnvironmentSchema.safeParse(options.ambientEnvironment);
    if (!parsedAmbient.success) {
      return failedExecution({ ...EMPTY_DIAGNOSTICS, kind: "policy-invalid", detail: z.prettifyError(parsedAmbient.error) });
    }
    const { executable, environment, timeoutMilliseconds, maximumOutputBytes } = options.policy;
    const parsedPolicy = capturedPolicySchema.safeParse({
      executable,
      environment: environment({ ambient: parsedAmbient.data }),
      timeoutMilliseconds,
      maximumOutputBytes,
    });
    return parsedPolicy.success
      ? { outcome: "ok", value: parsedPolicy.data }
      : failedExecution({ ...EMPTY_DIAGNOSTICS, kind: "policy-invalid", detail: z.prettifyError(parsedPolicy.error) });
  } catch (thrown) {
    return failedExecution({ ...EMPTY_DIAGNOSTICS, kind: "policy-invalid", detail: failureDetail({ thrown }) });
  }
};

export const createExecutionPort = (options: {
  readonly spawn: ExecutionSpawn;
  readonly policy: ExecutionPolicy;
  readonly ambientEnvironment: ExecutionEnvironment;
}): ExecutionPort => {
  const bound = bindPolicy(options);
  return {
    run: (request) => bound.outcome === "failed" ? bound : options.spawn({
      ...bound.value,
      timeoutMilliseconds: bound.value.timeoutMilliseconds,
      arguments: [...request.arguments],
      ...(request.cwd === undefined ? {} : { cwd: request.cwd }),
    }),
  };
};

export const createDefaultExecutionPort = (options: {
  readonly policy: ExecutionPolicy;
  readonly ambientEnvironment?: ExecutionEnvironment;
}): ExecutionPort => createExecutionPort({
  spawn: createExecutionSpawn({ spawnProvider: spawnSync }),
  policy: options.policy,
  ambientEnvironment: options.ambientEnvironment ?? { ...process.env },
});

export const createExecutionEnvironmentSnapshot = (options: {
  readonly readEnvironment: () => NodeJS.ProcessEnv;
}): ExecutionEnvironmentSnapshot => () => {
  try {
    const parsed = executionEnvironmentSchema.safeParse(options.readEnvironment());
    return parsed.success
      ? { outcome: "ok", value: parsed.data }
      : failedExecution({ ...EMPTY_DIAGNOSTICS, kind: "host-failed", detail: z.prettifyError(parsed.error) });
  } catch (thrown) {
    return failedExecution({ ...EMPTY_DIAGNOSTICS, kind: "host-failed", detail: failureDetail({ thrown }) });
  }
};

export const defaultExecutionEnvironmentSnapshot: ExecutionEnvironmentSnapshot =
  createExecutionEnvironmentSnapshot({ readEnvironment: () => process.env });
