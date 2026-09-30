import {
  createDefaultVaultConfigurationReader,
  readVaultPolicy,
  type VaultConfigurationReader,
  type VaultPolicyReadFailure,
  type VaultWritePolicy,
} from "../tools/rin-harness-config.ts";

type HookInvocation = {
  readonly toolName: string | null;
  readonly filePath: string | null;
  readonly cwd: string | null;
};

type VaultWriteInput = {
  readonly toolName: string | null;
  readonly filePath: string | null;
};

type VaultGuardEnvironment = Readonly<Record<string, string | undefined>>;

type VaultGuardDecision =
  | { readonly outcome: "allowed" }
  | { readonly outcome: "denied"; readonly reason: string };

const editingTools: ReadonlySet<string> = new Set([
  "Write",
  "Edit",
  "MultiEdit",
  "NotebookEdit",
]);
const aidlcProjectDirectoryVariable = "AIDLC_PROJECT_DIR";
const claudeProjectDirectoryVariable = "CLAUDE_PROJECT_DIR";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const optionalString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const parseHookInvocation = ({
  raw,
}: {
  readonly raw: string;
}): HookInvocation | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const toolInput = isRecord(parsed["tool_input"])
    ? parsed["tool_input"]
    : null;
  return {
    toolName: optionalString(parsed["tool_name"]),
    filePath: optionalString(toolInput?.["file_path"]),
    cwd: optionalString(parsed["cwd"]),
  };
};

const projectDirectoryFor = ({
  invocation,
  environment,
  currentWorkingDirectory,
}: {
  readonly invocation: HookInvocation;
  readonly environment: VaultGuardEnvironment;
  readonly currentWorkingDirectory: string;
}): string =>
  invocation.cwd ??
  optionalString(environment[aidlcProjectDirectoryVariable]) ??
  optionalString(environment[claudeProjectDirectoryVariable]) ??
  currentWorkingDirectory;

const policyFailureReason = ({
  failure,
}: {
  readonly failure: VaultPolicyReadFailure;
}): string => {
  switch (failure.kind) {
    case "configuration-unreadable":
      return "Blocked: vault write policy configuration-unreadable.";
    case "configuration-malformed":
      return "Blocked: vault write policy configuration-malformed.";
    case "configuration-invalid":
      return `Blocked: vault write policy configuration-invalid at ${failure.invalidConfigField}.`;
  }
};

const vaultWriteDeniedReason =
  "Blocked: direct disk write into the Obsidian vault. Vault edits go through the Obsidian MCP (mcp__obsidian__* / obsidian_update_note). If the MCP is unavailable, keep output inline and report the MCP gap - never disk-write the vault.";

const evaluateVaultWrite = ({
  toolInput,
  vaultPolicy,
}: {
  readonly toolInput: VaultWriteInput;
  readonly vaultPolicy: VaultWritePolicy;
}): VaultGuardDecision => {
  if (toolInput.toolName === null || !editingTools.has(toolInput.toolName))
    return { outcome: "allowed" };
  if (toolInput.filePath === null || vaultPolicy.adapter === "unconfigured")
    return { outcome: "allowed" };
  return vaultPolicy.pathMarker.classifyPath({
    candidatePath: toolInput.filePath,
  }) === "vault-path"
    ? { outcome: "denied", reason: vaultWriteDeniedReason }
    : { outcome: "allowed" };
};

const handleVaultWriteInvocation = ({
  invocation,
  reader,
  environment,
  currentWorkingDirectory,
}: {
  readonly invocation: HookInvocation;
  readonly reader: VaultConfigurationReader;
  readonly environment: VaultGuardEnvironment;
  readonly currentWorkingDirectory: string;
}): VaultGuardDecision => {
  if (invocation.toolName === null || !editingTools.has(invocation.toolName))
    return { outcome: "allowed" };
  if (invocation.filePath === null) return { outcome: "allowed" };
  const resolution = readVaultPolicy({
    projectDir: projectDirectoryFor({
      invocation,
      environment,
      currentWorkingDirectory,
    }),
    reader,
  });
  if (resolution.outcome === "failed")
    return {
      outcome: "denied",
      reason: policyFailureReason({
        failure: resolution.vaultPolicyReadFailure,
      }),
    };
  return evaluateVaultWrite({
    toolInput: {
      toolName: invocation.toolName,
      filePath: invocation.filePath,
    },
    vaultPolicy: resolution.vaultPolicy,
  });
};

const readStdin = (): Promise<string> =>
  new Promise((resolve) => {
    const chunks: string[] = [];
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      chunks.push(chunk);
    });
    process.stdin.on("end", () => {
      resolve(chunks.join(""));
    });
  });

const main = async (): Promise<void> => {
  if (process.stdin.isTTY) return;
  const raw = await readStdin();
  if (raw.trim().length === 0) return;
  const invocation = parseHookInvocation({ raw });
  if (invocation === null) return;
  const decision = handleVaultWriteInvocation({
    invocation,
    reader: createDefaultVaultConfigurationReader(),
    environment: process.env,
    currentWorkingDirectory: process.cwd(),
  });
  if (decision.outcome === "allowed") return;
  process.stderr.write(decision.reason);
  process.exitCode = 2;
};

if (import.meta.main) {
  void main().catch(() => {
    process.exitCode = 1;
  });
}

export type {
  HookInvocation,
  VaultGuardDecision,
  VaultGuardEnvironment,
  VaultWriteInput,
};
export { evaluateVaultWrite, handleVaultWriteInvocation, parseHookInvocation };
